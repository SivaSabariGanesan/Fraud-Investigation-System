import logging
from datetime import datetime
from typing import Dict, Any, List, Optional

from app.agent.schemas import (
    InvestigationResult, EvidenceItem, EvidenceRequestResult
)
from app.agent.state import InvestigationState
from app.agent.tools import (
    get_case, get_case_transactions, get_transaction_card,
    get_customer, get_customer_cards, get_card_transactions,
    get_transaction_devices, get_transaction_regions, get_transaction_email_domains,
    get_connected_cases, get_evidence_requests
)
from app.services.tigergraph import tigergraph_service
from app.agent.evidence import collect_and_normalize_all
from app.agent.context import build_investigation_context, InvestigationContext
from app.agent.reasoning import analyze_investigation_context, InvestigationReasoningOutput
from app.agent.decision import evaluate_policy_rules, DecisionResult

logger = logging.getLogger(__name__)

class FraudInvestigatorAgent:
    """
    Main Orchestrator for the Fraud Investigation Agent.
    Executes a 12-step evidence-driven workflow:
    1. Load case from TigerGraph/SQLite
    2. Retrieve flagged transaction(s)
    3. Retrieve associated customer & card info
    4. Retrieve transaction history
    5. Retrieve devices, billing regions, & email domains
    6. Retrieve connected cases/cards
    7. Retrieve evidence requests
    8. Normalize information into evidence items
    9. Build InvestigationContext
    10. Send context to reasoning layer
    11. Pass reasoning to decision layer (R1-R10 policy evaluation)
    12. Return structured InvestigationResult
    """

    async def investigate(self, case_id: str, notes: Optional[str] = None) -> InvestigationResult:
        """
        Primary entry point for running a complete fraud investigation on a given case ID against real FraudGraph.
        Handles missing data, empty graph results, and tool errors gracefully.
        """
        start_time = datetime.utcnow()
        logger.info(f"FraudInvestigatorAgent: Starting 12-step investigation workflow for case_id='{case_id}'")
        
        # Initialize investigation state tracking
        state = InvestigationState(case_id=case_id, investigation_status="IN_PROGRESS")
        if notes:
            state.add_note(notes)

        # Step 1: Load case details
        case_info = await self._safe_tool_call(state, "get_case", get_case, case_id)
        db_case = None
        try:
            from app.services.database import SessionLocal
            from app.models.investigation import CaseModel
            _db = SessionLocal()
            db_case = _db.query(CaseModel).filter(CaseModel.case_id == case_id).first()
            _db.close()
        except Exception as db_err:
            logger.warning(f"Error querying CaseModel for case '{case_id}': {db_err}")

        if case_info and (case_info.get("id") or case_info.get("case_id")):
            c_id = case_info.get("id") or case_info.get("case_id")
            state.investigation_notes.append(f"Loaded case vertex: {c_id}")
        elif db_case:
            case_info = {
                "id": db_case.case_id,
                "case_id": db_case.case_id,
                "customer_id": db_case.customer_id,
                "transaction_id": getattr(db_case, "transaction_id", None),
                "trigger_type": getattr(db_case, "trigger_type", None),
                "trigger_text": getattr(db_case, "trigger_text", None),
                "status": db_case.status,
                "notes": db_case.notes,
            }
            state.investigation_notes.append(f"Loaded case record from SQLite DB: {case_id}")

        # Step 2: Retrieve case transactions
        txns = await self._safe_tool_call(state, "get_case_transactions", get_case_transactions, case_id) or []
        db_txn_id = getattr(db_case, "transaction_id", None) if db_case else (case_info.get("transaction_id") if case_info else None)
        if not txns and db_txn_id:
            from app.agent.tools import get_transaction
            direct_txn = await self._safe_tool_call(state, "get_transaction", get_transaction, str(db_txn_id))
            if direct_txn:
                txns = [direct_txn]

        all_txn_ids = [t.get("id") or t.get("TransactionID") for t in txns if (t.get("id") or t.get("TransactionID"))]
        state.transaction_ids = all_txn_ids
        state.flagged_transaction_ids = [t.get("id") or t.get("TransactionID") for t in txns if t.get("status") == "FLAGGED" or t.get("risk_score", 0) >= 0.3]

        # Step 3: Retrieve associated card & customer information
        cards_info = []
        customer_info = None
        for t_id in all_txn_ids:
            card = await self._safe_tool_call(state, "get_transaction_card", get_transaction_card, t_id)
            if card and (card.get("id") or card.get("card_id")):
                c_id = card.get("id") or card.get("card_id")
                if c_id not in [c.get("id") or c.get("card_id") for c in cards_info]:
                    cards_info.append(card)

        card_ids = [c.get("id") or c.get("card_id") for c in cards_info if (c.get("id") or c.get("card_id"))]
        state.card_ids = card_ids

        # Retrieve subgraph entities first for quick entity resolution
        try:
            subgraph = await tigergraph_service.fetch_case_subgraph(case_id)
        except Exception as e:
            logger.warning(f"Subgraph fetch failed for case '{case_id}': {str(e)}")
            subgraph = {"entities": {}, "relationships": []}

        # Step 3: Retrieve associated card & customer information
        cards_info = subgraph.get("entities", {}).get("Card", [])
        for t_id in all_txn_ids:
            card = await self._safe_tool_call(state, "get_transaction_card", get_transaction_card, t_id)
            if card and (card.get("id") or card.get("card_id")):
                c_id = card.get("id") or card.get("card_id")
                if c_id not in [c.get("id") or c.get("card_id") for c in cards_info]:
                    cards_info.append(card)

        card_ids = [c.get("id") or c.get("card_id") for c in cards_info if (c.get("id") or c.get("card_id"))]
        state.card_ids = card_ids

        # Retrieve customer from case_info, db_case, subgraph, or card owner
        target_cust_id = case_info.get("customer_id") if case_info else None
        if not target_cust_id and db_case and db_case.customer_id:
            target_cust_id = db_case.customer_id
        if not target_cust_id:
            custs_in_subgraph = subgraph.get("entities", {}).get("Customer", [])
            if custs_in_subgraph:
                target_cust_id = custs_in_subgraph[0].get("id") or custs_in_subgraph[0].get("customer_id")

        if not target_cust_id and card_ids:
            for c_id in card_ids:
                try:
                    cust_edges = await tigergraph_service.get_edges("Card", c_id, "reverse_OWNS")
                    if cust_edges and cust_edges[0].get("to_id"):
                        target_cust_id = cust_edges[0].get("to_id")
                        break
                except Exception:
                    pass

        if target_cust_id:
            customer_info = await self._safe_tool_call(state, "get_customer", get_customer, target_cust_id)
            if customer_info and (customer_info.get("id") or customer_info.get("customer_id")):
                state.customer_id = customer_info.get("id") or customer_info.get("customer_id")
                cust_cards = await self._safe_tool_call(state, "get_customer_cards", get_customer_cards, state.customer_id) or []
                for cc in cust_cards:
                    cc_id = cc.get("id") or cc.get("card_id")
                    if cc_id and cc_id not in [c.get("id") or c.get("card_id") for c in cards_info]:
                        cards_info.append(cc)
            else:
                state.customer_id = target_cust_id
                customer_info = {"id": target_cust_id, "customer_id": target_cust_id}

        # Step 4: Retrieve relevant transaction history across cards
        history_txns = []
        for c_id in card_ids[:3]:
            c_txns = await self._safe_tool_call(state, "get_card_transactions", get_card_transactions, c_id) or []
            for ct in c_txns:
                ct_id = ct.get("id") or ct.get("TransactionID")
                if ct_id and ct_id not in all_txn_ids:
                    history_txns.append(ct)
        
        all_txns = txns + history_txns
        full_txn_ids = [t.get("id") or t.get("TransactionID") for t in all_txns if (t.get("id") or t.get("TransactionID"))]

        # Step 5: Retrieve devices, billing regions, and email domains
        devices_info = await self._safe_tool_call(state, "get_transaction_devices", get_transaction_devices, full_txn_ids) or []
        regions_info = await self._safe_tool_call(state, "get_transaction_regions", get_transaction_regions, full_txn_ids) or []
        domains_info = await self._safe_tool_call(state, "get_transaction_email_domains", get_transaction_email_domains, full_txn_ids) or []

        state.device_ids = [d.get("id") or d.get("device_id") for d in devices_info if (d.get("id") or d.get("device_id"))]
        state.billing_regions = [r.get("id") or r.get("region_id") for r in regions_info if (r.get("id") or r.get("region_id"))]
        state.email_domains = [dom.get("id") or dom.get("domain_name") for dom in domains_info if (dom.get("id") or dom.get("domain_name"))]

        # Step 6: Retrieve connected cases/cards
        connected_cases_info = await self._safe_tool_call(state, "get_connected_cases", get_connected_cases, card_ids) or []
        state.connected_case_ids = [cc.get("id") or cc.get("case_id") for cc in connected_cases_info if (cc.get("id") or cc.get("case_id"))]

        # Step 7: Retrieve evidence requests (strictly filtered to case_id)
        evidence_reqs_info = await self._safe_tool_call(state, "get_evidence_requests", get_evidence_requests, case_id) or []
        if not evidence_reqs_info:
            raw_subgraph_reqs = subgraph.get("entities", {}).get("EvidenceRequest", [])
            evidence_reqs_info = []
            for req in raw_subgraph_reqs:
                req_c_id = req.get("case_id") or req.get("for_case") or req.get("details", {}).get("case_id")
                req_id = req.get("id") or req.get("request_id") or ""
                if req_c_id == case_id or (case_id in req_id and not ("003" in req_id and case_id != "HHG-003")):
                    evidence_reqs_info.append(req)

        # Extra safety check to eliminate leaked requests from other cases
        filtered_evidence_reqs = []
        for req in evidence_reqs_info:
            req_c_id = req.get("case_id") or req.get("for_case") or req.get("details", {}).get("case_id")
            req_id = req.get("id") or req.get("request_id") or ""
            if "003" in req_id and case_id != "HHG-003":
                continue
            if req_c_id and req_c_id != case_id:
                continue
            filtered_evidence_reqs.append(req)
        evidence_reqs_info = filtered_evidence_reqs
        state.evidence_requests = evidence_reqs_info

        # Step 8: Normalize retrieved information into structured evidence items
        normalized_evidence_items = collect_and_normalize_all(
            case_data=case_info,
            transactions=all_txns,
            customer=customer_info,
            cards=cards_info,
            devices=devices_info,
            regions=regions_info,
            domains=domains_info,
            connected_cases=connected_cases_info,
            evidence_requests=evidence_reqs_info
        )
        state.evidence_items = [
            {
                "id": e.evidence_id,
                "entity_type": e.evidence_type,
                "details": e.raw_data,
                "risk_signal": e.strength
            }
            for e in normalized_evidence_items
        ]

        # Step 9: Build InvestigationContext
        investigation_context = build_investigation_context(
            state=state,
            case_info=case_info,
            transactions=all_txns,
            customer_info=customer_info,
            cards_info=cards_info,
            devices_info=devices_info,
            billing_regions_info=regions_info,
            email_domains_info=domains_info,
            connected_cases_info=connected_cases_info,
            evidence_requests_info=evidence_reqs_info,
            normalized_evidence=normalized_evidence_items
        )

        # Step 10: Send context to reasoning layer
        reasoning_output = analyze_investigation_context(investigation_context)

        # Step 11: Pass reasoning result to decision layer (R1-R10 rules)
        decision_result: DecisionResult = evaluate_policy_rules(reasoning_output, investigation_context)

        # Check for pending required evidence request strictly for current case
        has_pending_ev_req = any(
            str(r.get("status", "")).lower() in ("pending", "submitted") for r in evidence_reqs_info
        )

        # Update state final metrics
        state.investigation_status = decision_result.decision_state
        state.verification_status = decision_result.verification_status
        state.verdict = decision_result.verdict
        state.fraud_probability = decision_result.fraud_probability
        state.pattern = decision_result.primary_pattern
        state.exposure = reasoning_output.exposure

        latency = (datetime.utcnow() - start_time).total_seconds()

        # Step 12: Return structured InvestigationResult
        evidence_api_list = [
            EvidenceItem(
                evidence_id=e.evidence_id,
                evidence_type=e.evidence_type,
                source=e.source,
                description=e.description,
                related_entity=e.related_entity,
                transaction_id=e.transaction_id,
                card_id=e.card_id,
                strength=e.strength,
                raw_data=e.raw_data,
                timestamp=e.timestamp
            )
            for e in normalized_evidence_items
        ]

        evidence_req_results = [
            EvidenceRequestResult(
                request_id=r.get("id") or r.get("request_id") or f"REQ-{case_id}",
                case_id=case_id,
                request_type=r.get("type") or r.get("request_type") or "customer_transaction_confirmation",
                status=r.get("status", "pending"),
                details=r
            )
            for r in evidence_reqs_info
        ]

        # SAR evaluation: risk_score alone does NOT trigger SAR eligibility.
        # Derived strictly from R1-R10 conditions and confirmed fraud verdict.
        if decision_result.verdict == "DECLINED":
            sar_status = "RECOMMENDED"
            sar_reason = decision_result.decision_explanation
        elif has_pending_ev_req:
            sar_status = "NOT_RECOMMENDED"
            sar_reason = "Pending customer verification request. Insufficient evidence to establish suspicious activity."
        elif decision_result.verdict == "NEEDS_REVIEW":
            sar_status = "NOT_RECOMMENDED"
            sar_reason = "Case is under active review. Insufficient evidence for SAR filing."
        else:
            sar_status = "NOT_REQUIRED"
            sar_reason = "No confirmed fraud policy triggers met."

        sar_payload = {
            "status": sar_status,
            "reason": sar_reason
        }

        # Determine stop_reason: pending evidence request produces PENDING_EVIDENCE_RESPONSE
        stop_reason = "PENDING_EVIDENCE_RESPONSE" if has_pending_ev_req else "WORKFLOW_COMPLETE"

        # Determine case status and status badge for pending evidence
        final_case_status = "UNDER_INVESTIGATION" if has_pending_ev_req else decision_result.decision_state
        final_status = "VERIFICATION_PENDING" if has_pending_ev_req else decision_result.decision_state
        final_verdict = "NEEDS_REVIEW" if has_pending_ev_req and decision_result.verdict != "DECLINED" else decision_result.verdict

        rules_eval_list = [
            {
                "rule_id": r.rule_id,
                "rule_name": r.rule_name,
                "triggered": r.triggered,
                "status": getattr(r, "status", None) or ("TRIGGERED" if r.triggered else "NOT_TRIGGERED"),
                "description": r.description,
                "severity": r.severity
            }
            for r in decision_result.rules_evaluated
        ]

        written_to_graph_status = False
        if tigergraph_service.is_configured():
            try:
                written_to_graph_status = await tigergraph_service.write_case_decision(case_id, final_case_status, final_verdict)
            except Exception as tg_w_err:
                logger.warning(f"TigerGraph write-back error for case '{case_id}': {tg_w_err}")
                written_to_graph_status = False

        return InvestigationResult(
            case_id=case_id,
            customer_id=state.customer_id,
            case_status=final_case_status,
            status=final_status,
            verdict=final_verdict,
            fraud_probability=decision_result.fraud_probability,
            pattern=decision_result.primary_pattern,
            evidence=evidence_api_list,
            affected_transaction_ids=full_txn_ids or reasoning_output.affected_transaction_ids,
            connected_card_ids=card_ids or reasoning_output.potentially_connected_cards,
            connected_device_ids=state.device_ids or reasoning_output.potentially_connected_devices,
            exposure=reasoning_output.exposure,
            similar_prior_cases=state.connected_case_ids,
            written_to_graph=written_to_graph_status,
            evidence_requests=evidence_req_results,
            next_best_actions_initial=["COLLECT_GRAPH_EVIDENCE", "EXTRACT_SUBGRAPH_SIGNALS"],
            next_best_actions_final=decision_result.recommended_actions,
            rules_evaluated=rules_eval_list,
            SAR=sar_payload,
            stop_reason=stop_reason,
            tool_calls=[tc.model_dump() for tc in state.tool_calls],
            tokens=reasoning_output.llm_tokens if reasoning_output.llm_tokens else {"prompt": 0, "completion": 0, "total": 0},
            latency=reasoning_output.llm_latency if reasoning_output.llm_latency > 0 else latency,
            reasoning_summary=reasoning_output.analytical_summary,
            llm_fallback=getattr(reasoning_output, "llm_fallback", False)
        )

    # Method alias for API endpoint compatibility
    investigate_case = investigate

    async def _safe_tool_call(
        self, 
        state: InvestigationState, 
        tool_name: str, 
        tool_func: Any, 
        *args: Any
    ) -> Any:
        """
        Safely executes a tool function, logging invocation, tracking errors, and avoiding crashes.
        """
        try:
            result = await tool_func(*args)
            state.log_tool_call(tool_name=tool_name, arguments={"args": args}, result=result)
            return result
        except Exception as e:
            logger.error(f"Tool failure in '{tool_name}' for case '{state.case_id}': {str(e)}")
            state.add_error(f"Tool '{tool_name}' failed: {str(e)}")
            state.log_tool_call(tool_name=tool_name, arguments={"args": args}, error=str(e))
            return None

investigator_agent = FraudInvestigatorAgent()

async def investigate(case_id: str, notes: Optional[str] = None) -> InvestigationResult:
    """
    Convenience functional entry point for running a fraud investigation on a case ID.
    """
    return await investigator_agent.investigate(case_id, notes)
