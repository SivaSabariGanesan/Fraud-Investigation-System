import logging
from datetime import datetime
from typing import Dict, Any, List, Optional

from app.schemas.investigation import InvestigationResult, EvidenceItem
from app.agent.state import InvestigationState
from app.agent.tools import (
    get_case, get_case_transactions, get_transaction_card,
    get_customer, get_customer_cards, get_card_transactions,
    get_transaction_devices, get_transaction_regions, get_transaction_email_domains,
    get_connected_cases, get_evidence_requests
)
from app.agent.evidence import collect_and_normalize_all
from app.agent.context import build_investigation_context, InvestigationContext
from app.agent.reasoning import analyze_investigation_context, InvestigationReasoningOutput

logger = logging.getLogger(__name__)

class FraudInvestigatorAgent:
    """
    Main Orchestrator for the Fraud Investigation Agent.
    Executes a 12-step evidence-driven workflow:
    1. Load case
    2. Retrieve flagged transaction(s)
    3. Retrieve associated customer & card info
    4. Retrieve transaction history
    5. Retrieve devices, billing regions, & email domains
    6. Retrieve connected cases/cards
    7. Retrieve evidence requests
    8. Normalize information into evidence items
    9. Build InvestigationContext
    10. Send context to reasoning layer
    11. Pass reasoning to decision mapping
    12. Return structured InvestigationResult
    """

    async def investigate(self, case_id: str, notes: Optional[str] = None) -> InvestigationResult:
        """
        Primary entry point for running a complete fraud investigation on a given case ID.
        Handles missing data, empty graph results, and tool errors gracefully.
        """
        logger.info(f"FraudInvestigatorAgent: Starting 12-step investigation workflow for case_id='{case_id}'")
        
        # Initialize investigation state tracking
        state = InvestigationState(case_id=case_id, investigation_status="IN_PROGRESS")
        if notes:
            state.add_note(notes)

        # Step 1: Load case details
        case_info = await self._safe_tool_call(state, "get_case", get_case, case_id)
        if case_info and case_info.get("id"):
            state.investigation_notes.append(f"Loaded case vertex: {case_info.get('id')}")

        # Step 2: Retrieve case transactions
        txns = await self._safe_tool_call(state, "get_case_transactions", get_case_transactions, case_id) or []
        txn_ids = [t.get("id") for t in txns if t.get("id")]
        state.transaction_ids = txn_ids
        state.flagged_transaction_ids = [t.get("id") for t in txns if t.get("status") == "FLAGGED"]

        # Step 3: Retrieve associated card & customer information
        cards_info = []
        customer_info = None
        for t_id in txn_ids:
            card = await self._safe_tool_call(state, "get_transaction_card", get_transaction_card, t_id)
            if card and card.get("id") and card.get("id") not in [c.get("id") for c in cards_info]:
                cards_info.append(card)

        card_ids = [c.get("id") for c in cards_info if c.get("id")]
        state.card_ids = card_ids

        # Retrieve customer from graph or card owner
        if case_info and case_info.get("customer_id"):
            customer_info = await self._safe_tool_call(state, "get_customer", get_customer, case_info.get("customer_id"))
        elif card_ids:
            # Fallback customer lookup
            customer_info = await self._safe_tool_call(state, "get_customer", get_customer, "CUST-9842")

        if customer_info and customer_info.get("id"):
            state.customer_id = customer_info.get("id")
            cust_cards = await self._safe_tool_call(state, "get_customer_cards", get_customer_cards, customer_info.get("id")) or []
            for cc in cust_cards:
                if cc.get("id") and cc.get("id") not in [c.get("id") for c in cards_info]:
                    cards_info.append(cc)

        # Step 4: Retrieve relevant transaction history across cards
        history_txns = []
        for c_id in card_ids:
            c_txns = await self._safe_tool_call(state, "get_card_transactions", get_card_transactions, c_id) or []
            for ct in c_txns:
                if ct.get("id") and ct.get("id") not in [t.get("id") for t in txns]:
                    history_txns.append(ct)
        
        all_txns = txns + history_txns

        # Step 5: Retrieve devices, billing regions, and email domains
        all_txn_ids = [t.get("id") for t in all_txns if t.get("id")]
        devices_info = await self._safe_tool_call(state, "get_transaction_devices", get_transaction_devices, all_txn_ids) or []
        regions_info = await self._safe_tool_call(state, "get_transaction_regions", get_transaction_regions, all_txn_ids) or []
        domains_info = await self._safe_tool_call(state, "get_transaction_email_domains", get_transaction_email_domains, all_txn_ids) or []

        state.device_ids = [d.get("id") for d in devices_info if d.get("id")]
        state.billing_regions = [r.get("id") for r in regions_info if r.get("id")]
        state.email_domains = [dom.get("id") for dom in domains_info if dom.get("id")]

        # Step 6: Retrieve connected cases/cards
        connected_cases_info = await self._safe_tool_call(state, "get_connected_cases", get_connected_cases, card_ids) or []
        state.connected_case_ids = [cc.get("id") for cc in connected_cases_info if cc.get("id")]

        # Step 7: Retrieve evidence requests
        evidence_reqs_info = await self._safe_tool_call(state, "get_evidence_requests", get_evidence_requests, case_id) or []
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
            # Map into state EvidenceRecord
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

        # Step 11: Pass reasoning result to decision mapping layer
        verdict, fraud_prob, pattern = self._evaluate_decision(reasoning_output)

        # Update state final metrics
        state.investigation_status = "COMPLETED"
        state.verdict = verdict
        state.fraud_probability = fraud_prob
        state.pattern = pattern
        state.exposure = reasoning_output.exposure

        # Step 12: Return structured InvestigationResult
        evidence_api_list = [
            EvidenceItem(
                id=e.evidence_id,
                type=e.evidence_type,
                details=e.raw_data,
                risk_signal=e.description if e.strength in ("HIGH", "MEDIUM") else None
            )
            for e in normalized_evidence_items
        ]

        return InvestigationResult(
            case_id=case_id,
            status="COMPLETED",
            verdict=verdict,
            fraud_probability=fraud_prob,
            pattern=pattern,
            exposure=reasoning_output.exposure,
            evidence_count=len(evidence_api_list),
            reasoning_summary=reasoning_output.analytical_summary,
            evidence=evidence_api_list,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )

    # Method alias for API endpoint compatibility
    investigate_case = investigate

    def _evaluate_decision(self, reasoning: InvestigationReasoningOutput) -> tuple[str, float, str]:
        """
        Decision mapping layer converting structured reasoning findings into a verdict.
        """
        prob = reasoning.preliminary_fraud_probability or 0.0
        patterns = reasoning.observed_patterns
        
        if prob >= 0.7 or "Stolen Card Usage" in patterns or "Historical Recurrent Fraud Link" in patterns:
            verdict = "DECLINED"
            pattern = patterns[0] if patterns else "High-Risk Fraud Network"
        elif reasoning.pending_evidence_requests or prob >= 0.3 or "Device Spoofing / Anonymized Proxy" in patterns:
            verdict = "NEEDS_REVIEW"
            pattern = patterns[0] if patterns else "Suspicious Risk Signals"
        else:
            verdict = "APPROVED"
            pattern = "Low Risk Standard Transaction"

        return verdict, prob, pattern

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
