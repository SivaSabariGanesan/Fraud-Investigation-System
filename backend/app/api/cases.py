from uuid import uuid4
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional

from app.services.database import get_db
from app.models.investigation import CaseModel, InvestigationModel, AuditEventModel, EvidenceRequestModel
from app.schemas.investigation import (
    CaseResponse,
    ManualCaseCreateRequest,
    InvestigationHistoryResponse,
    InvestigationHistoryItem,
    AuditEventItem,
    GraphNode,
    GraphEdge,
    CaseGraphResponse
)
from app.agent.schemas import InvestigationResult
from app.agent.investigator import investigator_agent
from app.services.history_service import create_audit_event, persist_investigation_run
from app.services.evidence_request_service import sync_tigergraph_requests
from app.services.tigergraph import tigergraph_service
from app.agent.tools import is_valid_transaction

router = APIRouter(prefix="/api/cases", tags=["Cases"])

@router.get("", response_model=List[CaseResponse])
async def list_cases(db: Session = Depends(get_db)):
    """
    Get list of all fraud investigation cases.
    """
    cases = db.query(CaseModel).order_by(CaseModel.created_at.desc()).all()
    return cases

@router.post("/manual", response_model=InvestigationResult)
async def create_manual_case(
    body: ManualCaseCreateRequest,
    db: Session = Depends(get_db)
):
    """
    Manually create a new fraud case and run the real investigation pipeline.
    Validates request, prevents duplicate Case IDs, persists manual trigger info,
    and runs the 12-step investigator workflow against TigerGraph & Groq.
    """
    case_id = body.case_id.strip()
    if not case_id:
        raise HTTPException(status_code=400, detail="Case ID is required.")

    transaction_id = body.transaction_id.strip()
    if not transaction_id:
        raise HTTPException(status_code=400, detail="Transaction ID is required.")

    trigger_type = body.trigger_type.strip()
    valid_triggers = ["customer_report", "fraud_signal", "analyst_review"]
    if trigger_type not in valid_triggers:
        raise HTTPException(status_code=400, detail=f"Trigger type must be one of: {', '.join(valid_triggers)}")

    trigger_text = body.trigger_text.strip()
    if not trigger_text:
        raise HTTPException(status_code=400, detail="Customer Report / Analyst Notes is required.")

    # 1. Prevent duplicate Case IDs
    existing_case = db.query(CaseModel).filter(CaseModel.case_id == case_id).first()
    if existing_case:
        raise HTTPException(status_code=400, detail=f"Case ID '{case_id}' already exists.")

    try:
        tg_case_v = await tigergraph_service.get_vertex("ClosedCase", case_id)
        if tg_case_v:
            raise HTTPException(status_code=400, detail=f"Case ID '{case_id}' already exists in graph.")
    except Exception:
        pass

    investigation_id = f"INV-{uuid4().hex[:8].upper()}"

    # 2. Create/persist case in SQLite
    customer_id = body.customer_id.strip() if body.customer_id and body.customer_id.strip() else None

    new_case = CaseModel(
        case_id=case_id,
        customer_id=customer_id,
        transaction_id=transaction_id,
        trigger_type=trigger_type,
        trigger_text=trigger_text,
        status="INVESTIGATING",
        exposure=body.amount if body.amount is not None else 0.0,
        notes=f"[{trigger_type.upper()}] {trigger_text}",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(new_case)
    db.commit()
    db.refresh(new_case)

    # 3. Create Audit Events
    create_audit_event(
        db, case_id=case_id, investigation_id=investigation_id,
        event_type="CASE_OPENED",
        description=f"Manual fraud case '{case_id}' created by analyst with trigger '{trigger_type}'.",
        actor="ANALYST"
    )

    create_audit_event(
        db, case_id=case_id, investigation_id=investigation_id,
        event_type="INVESTIGATION_STARTED",
        description=f"Investigation run '{investigation_id}' started for manual case '{case_id}'.",
        actor="AGENT"
    )

    try:
        # 4. Run real investigation workflow
        notes = f"Trigger ({trigger_type}): {trigger_text}"
        agent_output = await investigator_agent.investigate(case_id, notes)
        agent_output.investigation_id = investigation_id

        # 5. Sync TigerGraph EvidenceRequests if any
        raw_er_list = []
        for er in agent_output.evidence_requests:
            if hasattr(er, "model_dump"):
                d = er.model_dump()
                if d.get("details"):
                    d.update(d["details"])
                raw_er_list.append(d)
        sync_tigergraph_requests(db, case_id, raw_er_list)

        # Audit events
        create_audit_event(
            db, case_id=case_id, investigation_id=investigation_id,
            event_type="EVIDENCE_COLLECTED",
            description=f"Retrieved & normalized {len(agent_output.evidence)} evidence items from TigerGraph.",
            actor="AGENT"
        )
        create_audit_event(
            db, case_id=case_id, investigation_id=investigation_id,
            event_type="LLM_REASONING_COMPLETED",
            description="Groq AI reasoning analysis completed.",
            actor="AGENT",
            metadata=agent_output.tokens
        )
        trig_rules = [r.get("rule_id") for r in agent_output.rules_evaluated if r.get("triggered")]
        create_audit_event(
            db, case_id=case_id, investigation_id=investigation_id,
            event_type="POLICY_EVALUATED",
            description=f"Evaluated policy rules R1-R10. Triggered rules: {', '.join(trig_rules) if trig_rules else 'None'}.",
            actor="AGENT"
        )
        create_audit_event(
            db, case_id=case_id, investigation_id=investigation_id,
            event_type="DECISION_GENERATED",
            description=f"Generated decision state '{agent_output.status}' with verdict '{agent_output.verdict}'.",
            actor="AGENT"
        )

        # 6. Immutably persist investigation run
        persist_investigation_run(
            db, investigation_id=investigation_id, result=agent_output, decision_rules=agent_output.rules_evaluated
        )

        # 7. Sync SAR candidate evaluation
        try:
            from app.services.sar_service import sync_sar_candidate_from_result
            sync_sar_candidate_from_result(db, case_id=case_id, investigation_id=investigation_id, agent_output=agent_output)
        except Exception:
            pass

        create_audit_event(
            db, case_id=case_id, investigation_id=investigation_id,
            event_type="INVESTIGATION_COMPLETED",
            description=f"Investigation '{investigation_id}' completed successfully.",
            actor="AGENT"
        )

        # 8. Update CaseModel summary
        if agent_output.customer_id:
            new_case.customer_id = agent_output.customer_id
        new_case.status = agent_output.case_status
        new_case.verdict = agent_output.verdict
        new_case.fraud_probability = agent_output.fraud_probability
        new_case.pattern = agent_output.pattern
        if agent_output.exposure and agent_output.exposure > 0:
            new_case.exposure = agent_output.exposure
        new_case.updated_at = datetime.utcnow()
        db.commit()

        return agent_output

    except Exception as e:
        create_audit_event(
            db, case_id=case_id, investigation_id=investigation_id,
            event_type="INVESTIGATION_FAILED",
            description=f"Investigation workflow failed: {str(e)}",
            actor="AGENT"
        )
        new_case.status = "UNDER_INVESTIGATION"
        new_case.updated_at = datetime.utcnow()
        db.commit()
        raise HTTPException(status_code=500, detail=f"Investigation failed for case '{case_id}': {str(e)}")

@router.get("/{case_id}", response_model=CaseResponse)
async def get_case(case_id: str, db: Session = Depends(get_db)):
    """
    Get detailed information for a single fraud case by ID.
    """
    case = db.query(CaseModel).filter(CaseModel.case_id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail=f"Case with ID '{case_id}' not found.")
    return case

@router.get("/{case_id}/investigations", response_model=InvestigationHistoryResponse)
async def get_case_investigation_history(case_id: str, db: Session = Depends(get_db)):
    """
    Get list of all historical investigation runs for a specific case ID, ordered newest first.
    """
    runs = db.query(InvestigationModel).filter(
        InvestigationModel.case_id == case_id
    ).order_by(InvestigationModel.created_at.desc()).all()

    items = [
        InvestigationHistoryItem(
            investigation_id=r.investigation_id,
            case_id=r.case_id,
            customer_id=r.customer_id,
            case_status=r.case_status,
            status=r.status,
            verdict=r.verdict,
            created_at=r.created_at,
            completed_at=r.completed_at,
            reasoning_summary=r.reasoning_summary,
            stop_reason=r.stop_reason
        )
        for r in runs
    ]

    return InvestigationHistoryResponse(case_id=case_id, investigations=items)

@router.get("/{case_id}/audit", response_model=List[AuditEventItem])
async def get_case_audit_trail(case_id: str, db: Session = Depends(get_db)):
    """
    Get chronological audit trail events for a case ID.
    """
    events = db.query(AuditEventModel).filter(
        AuditEventModel.case_id == case_id
    ).order_by(AuditEventModel.created_at.asc()).all()

    return events


@router.get("/{case_id}/graph", response_model=CaseGraphResponse)
async def get_case_graph(case_id: str, db: Session = Depends(get_db)):
    """
    Retrieve real TigerGraph FraudGraph evidence for a specific case ID
    and return normalized nodes and edges for visual network rendering.
    """
    db_case = db.query(CaseModel).filter(CaseModel.case_id == case_id).first()
    tg_case_v = None
    try:
        tg_case_v = await tigergraph_service.get_vertex("ClosedCase", case_id)
    except Exception:
        pass

    if not db_case and not tg_case_v and not case_id.startswith("HHG-"):
        raise HTTPException(status_code=404, detail=f"Case with ID '{case_id}' not found.")

    try:
        subgraph = await tigergraph_service.fetch_case_subgraph(case_id)
    except Exception:
        subgraph = {"entities": {}, "relationships": []}

    entities = subgraph.get("entities", {})
    relationships = subgraph.get("relationships", [])

    nodes_map: Dict[str, GraphNode] = {}
    edges_map: Dict[str, GraphEdge] = {}

    # Current Case node
    case_node_id = f"ClosedCase:{case_id}"
    nodes_map[case_node_id] = GraphNode(
        id=case_node_id,
        type="ClosedCase",
        label=case_id,
        properties={
            "case_id": case_id,
            "is_current_case": True,
            "status": db_case.status if db_case else "UNDER_INVESTIGATION",
            "verdict": db_case.verdict if db_case else "NEEDS_REVIEW",
            "pattern": db_case.pattern if db_case else None,
            "exposure": db_case.exposure if db_case else None,
        }
    )

    # Historical ClosedCases
    for c in entities.get("ClosedCase", []):
        c_id = c.get("id") or c.get("case_id")
        if c_id and c_id != case_id:
            nid = f"ClosedCase:{c_id}"
            nodes_map[nid] = GraphNode(
                id=nid,
                type="ClosedCase",
                label=str(c_id),
                properties={
                    "case_id": c_id,
                    "is_current_case": False,
                    "outcome": c.get("outcome") or c.get("status"),
                    "pattern": c.get("pattern"),
                    "exposure": c.get("exposure"),
                    "opened_at": c.get("opened_at"),
                    "closed_at": c.get("closed_at")
                }
            )

    # Customers
    for cust in entities.get("Customer", []):
        cid = cust.get("id") or cust.get("customer_id")
        if cid:
            nid = f"Customer:{cid}"
            nodes_map[nid] = GraphNode(
                id=nid,
                type="Customer",
                label=f"Customer {cid}",
                properties={
                    "customer_id": cid,
                    "name": cust.get("name") or f"Customer {cid}",
                    "risk_level": cust.get("risk_level", "NEUTRAL")
                }
            )

    # Cards
    for card in entities.get("Card", []):
        card_id = card.get("id") or card.get("card_id")
        if card_id:
            nid = f"Card:{card_id}"
            nodes_map[nid] = GraphNode(
                id=nid,
                type="Card",
                label=f"Card {card_id}",
                properties={
                    "card_id": card_id,
                    "brand": card.get("brand"),
                    "customer_id": card.get("customer_id")
                }
            )

    # Transactions (safe filtering applied)
    for txn in entities.get("Transaction", []):
        if not is_valid_transaction(txn):
            continue
        t_id = str(txn.get("id") or txn.get("TransactionID") or txn.get("transaction_id"))
        if t_id:
            nid = f"Transaction:{t_id}"
            risk_sig = txn.get("risk_score") if txn.get("risk_score") is not None else txn.get("risk_signal")
            nodes_map[nid] = GraphNode(
                id=nid,
                type="Transaction",
                label=f"Txn {t_id}",
                properties={
                    "transaction_id": t_id,
                    "amount": txn.get("amount"),
                    "timestamp": str(txn.get("timestamp") or txn.get("ts") or ""),
                    "channel": txn.get("channel"),
                    "product_code": txn.get("product_code") or txn.get("product"),
                    "risk_signal": risk_sig,
                    "case_relationship": "INVOLVES"
                }
            )

    # DeviceProfiles
    for dev in entities.get("DeviceProfile", []):
        d_id = str(dev.get("id") or dev.get("device_id"))
        if d_id:
            nid = f"DeviceProfile:{d_id}"
            nodes_map[nid] = GraphNode(
                id=nid,
                type="DeviceProfile",
                label=f"Device {d_id}",
                properties={
                    "device_id": d_id,
                    "device_type": dev.get("device_type"),
                    "ip_address": dev.get("ip_address"),
                    "os": dev.get("os")
                }
            )

    # EmailDomains
    for email in entities.get("EmailDomain", []):
        e_id = str(email.get("id") or email.get("domain_name"))
        if e_id:
            nid = f"EmailDomain:{e_id}"
            nodes_map[nid] = GraphNode(
                id=nid,
                type="EmailDomain",
                label=e_id,
                properties={
                    "domain_name": e_id
                }
            )

    # BillingRegions
    for reg in entities.get("BillingRegion", []):
        r_id = str(reg.get("id") or reg.get("region_id"))
        if r_id:
            nid = f"BillingRegion:{r_id}"
            nodes_map[nid] = GraphNode(
                id=nid,
                type="BillingRegion",
                label=f"Region {r_id}",
                properties={
                    "region_id": r_id
                }
            )

    # EvidenceRequests
    db_reqs = db.query(EvidenceRequestModel).filter(EvidenceRequestModel.case_id == case_id).all()
    all_reqs_map: Dict[str, Dict[str, Any]] = {}
    for req in entities.get("EvidenceRequest", []):
        req_id = req.get("id") or req.get("request_id")
        if req_id:
            all_reqs_map[req_id] = {
                "request_id": req_id,
                "request_type": req.get("request_type", "customer_verification"),
                "status": req.get("status", "PENDING"),
                "request_text": req.get("request_text"),
                "requested_at": str(req.get("created_at") or ""),
                "response": req.get("response"),
                "transaction_id": req.get("transaction_id")
            }
    for r in db_reqs:
        all_reqs_map[r.request_id] = {
            "request_id": r.request_id,
            "request_type": r.request_type,
            "status": r.status,
            "request_text": r.request_text,
            "requested_at": str(r.created_at.isoformat() if r.created_at else ""),
            "response": r.response,
            "transaction_id": r.transaction_id
        }

    for req_id, req_data in all_reqs_map.items():
        nid = f"EvidenceRequest:{req_id}"
        nodes_map[nid] = GraphNode(
            id=nid,
            type="EvidenceRequest",
            label=req_id,
            properties=req_data
        )

    # Resolve entity IDs helper
    def resolve_node_id(raw_id: str) -> Optional[str]:
        if not raw_id:
            return None
        for nid in nodes_map:
            if nid == raw_id or nid.endswith(f":{raw_id}"):
                return nid
        return None

    # Process relationships from TigerGraph
    for rel in relationships:
        from_raw = str(rel.get("from"))
        to_raw = str(rel.get("to"))
        rel_type = str(rel.get("rel"))

        src_nid = resolve_node_id(from_raw)
        tgt_nid = resolve_node_id(to_raw)

        if src_nid and tgt_nid and src_nid != tgt_nid:
            eid = f"{rel_type.lower()}:{src_nid}-{tgt_nid}"
            edges_map[eid] = GraphEdge(
                id=eid,
                source=src_nid,
                target=tgt_nid,
                type=rel_type,
                label=rel_type
            )

    # Add canonical edges where entities exist
    cust_nodes = [nid for nid, n in nodes_map.items() if n.type == "Customer"]
    card_nodes = [nid for nid, n in nodes_map.items() if n.type == "Card"]
    txn_nodes = [nid for nid, n in nodes_map.items() if n.type == "Transaction"]
    dev_nodes = [nid for nid, n in nodes_map.items() if n.type == "DeviceProfile"]
    email_nodes = [nid for nid, n in nodes_map.items() if n.type == "EmailDomain"]
    region_nodes = [nid for nid, n in nodes_map.items() if n.type == "BillingRegion"]
    req_nodes = [nid for nid, n in nodes_map.items() if n.type == "EvidenceRequest"]

    for cn in cust_nodes:
        for crdn in card_nodes:
            eid = f"owns:{cn}-{crdn}"
            if eid not in edges_map:
                edges_map[eid] = GraphEdge(id=eid, source=cn, target=crdn, type="OWNS", label="OWNS")

    for crdn in card_nodes:
        for tn in txn_nodes:
            eid = f"made:{crdn}-{tn}"
            if eid not in edges_map:
                edges_map[eid] = GraphEdge(id=eid, source=crdn, target=tn, type="MADE", label="MADE")

    for tn in txn_nodes:
        eid = f"involves:{case_node_id}-{tn}"
        if eid not in edges_map:
            edges_map[eid] = GraphEdge(id=eid, source=case_node_id, target=tn, type="INVOLVES", label="INVOLVES")

        for devn in dev_nodes:
            eid = f"from_device:{tn}-{devn}"
            if eid not in edges_map:
                edges_map[eid] = GraphEdge(id=eid, source=tn, target=devn, type="FROM_DEVICE", label="FROM_DEVICE")

        for emn in email_nodes:
            eid = f"purchaser_email:{tn}-{emn}"
            if eid not in edges_map:
                edges_map[eid] = GraphEdge(id=eid, source=tn, target=emn, type="PURCHASER_EMAIL", label="PURCHASER_EMAIL")

        for rgn in region_nodes:
            eid = f"billed_in:{tn}-{rgn}"
            if eid not in edges_map:
                edges_map[eid] = GraphEdge(id=eid, source=tn, target=rgn, type="BILLED_IN", label="BILLED_IN")

    for rqn in req_nodes:
        eid = f"for_case:{rqn}-{case_node_id}"
        if eid not in edges_map:
            edges_map[eid] = GraphEdge(id=eid, source=rqn, target=case_node_id, type="FOR_CASE", label="FOR_CASE")

        req_props = nodes_map[rqn].properties
        tx_link = req_props.get("transaction_id")
        if tx_link:
            tx_nid = resolve_node_id(str(tx_link))
            if tx_nid:
                eid2 = f"for_transaction:{rqn}-{tx_nid}"
                if eid2 not in edges_map:
                    edges_map[eid2] = GraphEdge(id=eid2, source=rqn, target=tx_nid, type="FOR_TRANSACTION", label="FOR_TRANSACTION")

    return CaseGraphResponse(
        case_id=case_id,
        nodes=list(nodes_map.values()),
        edges=list(edges_map.values())
    )

