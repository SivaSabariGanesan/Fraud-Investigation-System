import json
import logging
from datetime import datetime
from uuid import uuid4
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session

from app.models.investigation import (
    CaseModel,
    InvestigationModel,
    InvestigationEvidenceModel,
    InvestigationActionModel,
    InvestigationRuleModel,
    AuditEventModel
)
from app.agent.schemas import InvestigationResult

logger = logging.getLogger(__name__)

def create_audit_event(
    db: Session,
    case_id: str,
    event_type: str,
    description: str,
    investigation_id: Optional[str] = None,
    actor: str = "AGENT",
    metadata: Optional[Dict[str, Any]] = None
) -> AuditEventModel:
    """
    Creates and commits a chronological audit log event without storing secrets or tokens.
    """
    safe_meta = None
    if metadata:
        # Strip sensitive keys (secrets, keys, bearer tokens)
        safe_dict = {
            k: str(v) for k, v in metadata.items()
            if not any(s in k.lower() for s in ("secret", "key", "token", "auth", "password"))
        }
        safe_meta = json.dumps(safe_dict)

    event = AuditEventModel(
        case_id=case_id,
        investigation_id=investigation_id,
        event_type=event_type,
        description=description,
        actor=actor,
        metadata_json=safe_meta,
        created_at=datetime.utcnow()
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def persist_investigation_run(
    db: Session,
    investigation_id: str,
    result: InvestigationResult,
    decision_rules: Optional[List[Dict[str, Any]]] = None
) -> InvestigationModel:
    """
    Immutably persists an investigation run result, evidence snapshot, evaluated rules,
    recommended actions, and LLM metrics into SQLite.
    """
    now = datetime.utcnow()
    tokens = result.tokens or {}
    sar = result.SAR or {}

    inv = InvestigationModel(
        investigation_id=investigation_id,
        case_id=result.case_id,
        customer_id=result.customer_id,
        case_status=result.case_status,
        status=result.status,
        verdict=result.verdict,
        fraud_probability=result.fraud_probability,
        pattern=result.pattern,
        reasoning_summary=result.reasoning_summary,
        stop_reason=result.stop_reason,
        exposure=result.exposure,
        sar_status=sar.get("status"),
        sar_reason=sar.get("reason"),
        llm_provider="groq",
        llm_model="openai/gpt-oss-120b",
        llm_latency=result.latency,
        prompt_tokens=tokens.get("prompt", 0),
        completion_tokens=tokens.get("completion", 0),
        total_tokens=tokens.get("total", 0),
        created_at=now,
        completed_at=now
    )
    db.add(inv)
    db.commit()

    # Save evidence snapshot immutably
    for ev in result.evidence:
        raw_json = json.dumps(ev.raw_data or ev.details or {})
        
        # Link evidence request details if present
        req_id = None
        req_type = None
        req_status = None
        req_text = None
        req_response = None
        requested_at = None
        responded_at = None
        
        if ev.evidence_type in ("EvidenceRequest", "customer_verification"):
            raw_d = ev.raw_data or {}
            req_id = raw_d.get("id") or raw_d.get("request_id")
            req_type = raw_d.get("type") or raw_d.get("request_type")
            req_status = raw_d.get("status")
            req_text = raw_d.get("request_text")
            req_response = raw_d.get("response")
            requested_at = str(raw_d.get("requested_at")) if raw_d.get("requested_at") else None
            responded_at = str(raw_d.get("responded_at")) if raw_d.get("responded_at") else None

        ev_record = InvestigationEvidenceModel(
            investigation_id=investigation_id,
            evidence_id=ev.evidence_id,
            evidence_type=ev.evidence_type,
            source=ev.source or "TigerGraph",
            description=ev.description,
            strength=ev.strength,
            related_transaction_id=ev.transaction_id,
            related_card_id=ev.card_id,
            risk_signal=ev.risk_signal,
            raw_data=raw_json,
            timestamp=str(ev.timestamp) if ev.timestamp else None,
            request_id=req_id,
            request_type=req_type,
            request_status=req_status,
            request_text=req_text,
            request_response=req_response,
            requested_at=requested_at,
            responded_at=responded_at
        )
        db.add(ev_record)

    # Save initial & final actions
    for act in result.next_best_actions_initial:
        db.add(InvestigationActionModel(
            investigation_id=investigation_id,
            action=act,
            phase="INITIAL",
            created_at=now
        ))
    for act in result.next_best_actions_final:
        db.add(InvestigationActionModel(
            investigation_id=investigation_id,
            action=act,
            phase="FINAL",
            created_at=now
        ))

    # Save rule evaluation snapshot
    if decision_rules:
        for r in decision_rules:
            db.add(InvestigationRuleModel(
                investigation_id=investigation_id,
                rule_id=r.get("rule_id", "R_UNKNOWN"),
                triggered=bool(r.get("triggered", False)),
                reason=r.get("description") or r.get("reason", ""),
                created_at=now
            ))

    db.commit()
    return inv


def get_investigation_detail(db: Session, investigation_id: str) -> Optional[Dict[str, Any]]:
    """
    Retrieves historical investigation detail snapshot directly from SQLite.
    Does NOT call TigerGraph or Groq.
    """
    inv = db.query(InvestigationModel).filter(InvestigationModel.investigation_id == investigation_id).first()
    if not inv:
        return None

    evidence_records = db.query(InvestigationEvidenceModel).filter(InvestigationEvidenceModel.investigation_id == investigation_id).all()
    actions_records = db.query(InvestigationActionModel).filter(InvestigationActionModel.investigation_id == investigation_id).all()
    rules_records = db.query(InvestigationRuleModel).filter(InvestigationRuleModel.investigation_id == investigation_id).all()
    audit_records = db.query(AuditEventModel).filter(AuditEventModel.investigation_id == investigation_id).order_by(AuditEventModel.created_at.asc()).all()

    evidence_list = []
    for ev in evidence_records:
        raw_d = {}
        if ev.raw_data:
            try:
                raw_d = json.loads(ev.raw_data)
            except Exception:
                raw_d = {}
        evidence_list.append({
            "evidence_id": ev.evidence_id,
            "evidence_type": ev.evidence_type,
            "source": ev.source,
            "description": ev.description,
            "strength": ev.strength,
            "transaction_id": ev.related_transaction_id,
            "card_id": ev.related_card_id,
            "risk_signal": ev.risk_signal,
            "raw_data": raw_d,
            "timestamp": ev.timestamp,
            "request_id": ev.request_id,
            "request_type": ev.request_type,
            "request_status": ev.request_status,
            "request_text": ev.request_text,
            "request_response": ev.request_response,
            "requested_at": ev.requested_at,
            "responded_at": ev.responded_at
        })

    initial_actions = [a.action for a in actions_records if a.phase == "INITIAL"]
    final_actions = [a.action for a in actions_records if a.phase == "FINAL"]

    rules_list = [{
        "rule_id": r.rule_id,
        "triggered": r.triggered,
        "reason": r.reason,
        "created_at": r.created_at.isoformat() if r.created_at else None
    } for r in rules_records]

    audit_list = [{
        "id": a.id,
        "case_id": a.case_id,
        "investigation_id": a.investigation_id,
        "event_type": a.event_type,
        "description": a.description,
        "actor": a.actor,
        "metadata_json": a.metadata_json,
        "created_at": a.created_at
    } for a in audit_records]

    return {
        "investigation_id": inv.investigation_id,
        "case_id": inv.case_id,
        "customer_id": inv.customer_id,
        "case_status": inv.case_status,
        "status": inv.status,
        "verdict": inv.verdict,
        "fraud_probability": inv.fraud_probability,
        "pattern": inv.pattern,
        "reasoning_summary": inv.reasoning_summary,
        "stop_reason": inv.stop_reason,
        "exposure": inv.exposure,
        "sar_status": inv.sar_status,
        "sar_reason": inv.sar_reason,
        "llm_provider": inv.llm_provider,
        "llm_model": inv.llm_model,
        "llm_latency": inv.llm_latency,
        "prompt_tokens": inv.prompt_tokens,
        "completion_tokens": inv.completion_tokens,
        "total_tokens": inv.total_tokens,
        "created_at": inv.created_at,
        "completed_at": inv.completed_at,
        "evidence": evidence_list,
        "actions_initial": initial_actions,
        "actions_final": final_actions,
        "rules": rules_list,
        "audit_events": audit_list
    }
