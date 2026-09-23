import json
import logging
from uuid import uuid4
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.models.investigation import (
    CaseModel,
    SarRecordModel,
    InvestigationModel,
    InvestigationEvidenceModel,
    InvestigationRuleModel,
    AuditEventModel
)
from app.schemas.investigation import (
    SarReviewRequest,
    SarPrepareRequest,
    SarSubmissionStatusRequest,
    SarRecordResponse
)
from app.services.history_service import create_audit_event

logger = logging.getLogger(__name__)

# Valid state machine transitions
_VALID_TRANSITIONS: Dict[str, List[str]] = {
    "NOT_RECOMMENDED": ["CANDIDATE"],
    "CANDIDATE": ["UNDER_REVIEW", "APPROVED", "NOT_FILED"],
    "UNDER_REVIEW": ["APPROVED", "NOT_FILED"],
    "APPROVED": ["PREPARED"],
    "PREPARED": ["SUBMISSION_PENDING"],
    "SUBMISSION_PENDING": ["FILED"],
    "NOT_FILED": [],
    "FILED": []
}


def validate_sar_transition(current_status: str, target_status: str) -> None:
    """
    Validates if a status transition is permitted in the SAR lifecycle state machine.
    Raises ValueError for invalid transitions.
    """
    allowed = _VALID_TRANSITIONS.get(current_status, [])
    if target_status not in allowed:
        raise ValueError(
            f"Cannot transition SAR from '{current_status}' to '{target_status}'. "
            f"Allowed transitions from '{current_status}': {allowed or 'none'}."
        )


def _format_sar_response(model: SarRecordModel) -> SarRecordResponse:
    """Formats SarRecordModel into SarRecordResponse schema."""
    def _safe_parse_json(text: Optional[str], default: Any) -> Any:
        if not text:
            return default
        try:
            return json.loads(text)
        except Exception:
            return default

    report_draft = _safe_parse_json(model.report_draft_json, None)

    return SarRecordResponse(
        sar_id=model.sar_id,
        case_id=model.case_id,
        investigation_id=model.investigation_id,
        status=model.status,
        eligibility=model.eligibility,
        eligibility_reason=model.eligibility_reason,
        exposure_usd=model.exposure_usd,
        related_transaction_ids=_safe_parse_json(model.related_transaction_ids, []),
        related_card_ids=_safe_parse_json(model.related_card_ids, []),
        related_customer_ids=_safe_parse_json(model.related_customer_ids, []),
        related_device_ids=_safe_parse_json(model.related_device_ids, []),
        related_regions=_safe_parse_json(model.related_regions, []),
        related_closed_case_ids=_safe_parse_json(model.related_closed_case_ids, []),
        supporting_evidence=_safe_parse_json(model.supporting_evidence, []),
        policy_rules=_safe_parse_json(model.policy_rules, []),
        analyst_decision=model.analyst_decision,
        analyst_notes=model.analyst_notes,
        reviewer_id=model.reviewer_id,
        report_reference=model.report_reference,
        report_draft_json=report_draft,
        created_at=model.created_at,
        updated_at=model.updated_at,
        reviewed_at=model.reviewed_at,
        prepared_at=model.prepared_at,
        submitted_at=model.submitted_at
    )


def sync_sar_candidate_from_result(
    db: Session,
    case_id: str,
    investigation_id: str,
    agent_output: Any
) -> SarRecordResponse:
    """
    Evaluates SAR eligibility deterministically from InvestigationResult schema.
    Persists or updates SarRecordModel with immutable investigation_id snapshot.
    If eligible, sets status to CANDIDATE and emits audit event SAR_CANDIDATE_CREATED.
    """
    rules = getattr(agent_output, "rules_evaluated", []) or []
    trig_rules = []
    for r in rules:
        if isinstance(r, dict):
            if r.get("triggered"):
                trig_rules.append(r.get("rule_id", ""))
        elif getattr(r, "triggered", False):
            trig_rules.append(getattr(r, "rule_id", ""))

    verdict = getattr(agent_output, "verdict", "NEEDS_REVIEW")
    status = getattr(agent_output, "status", "UNDER_INVESTIGATION")
    exposure = getattr(agent_output, "exposure", 0.0) or 0.0
    stop_reason = getattr(agent_output, "stop_reason", "") or ""
    evidence_reqs = getattr(agent_output, "evidence_requests", []) or []

    has_pending_req = stop_reason == "PENDING_EVIDENCE_RESPONSE" or any(
        str(r.get("status") if isinstance(r, dict) else getattr(r, "status", "")).lower() == "pending"
        for r in evidence_reqs
    )

    is_eligible = False
    eligibility_status = "NOT_ELIGIBLE"
    reason = "No confirmed fraud policy triggers met."

    if has_pending_req:
        is_eligible = False
        eligibility_status = "INCONCLUSIVE"
        reason = "Pending customer verification request exists. Insufficient grounded evidence to establish SAR eligibility."
    elif verdict == "DECLINED" or status == "CONFIRMED_FRAUD" or "R4" in trig_rules or "R8" in trig_rules:
        is_eligible = True
        eligibility_status = "ELIGIBLE"
        reason = (
            f"Confirmed fraud pattern detected for case '{case_id}' based on critical policy rule triggers: "
            f"{', '.join(trig_rules) if trig_rules else 'Stolen Card / High Velocity'}. Total exposure: ${exposure:.2f}."
        )
    elif ("R7" in trig_rules or "R5" in trig_rules) and exposure > 1000.0:
        is_eligible = True
        eligibility_status = "ELIGIBLE"
        reason = f"High exposure financial fraud risk linked to historical fraud network or spoofing. Exposure: ${exposure:.2f}."

    target_status = "CANDIDATE" if is_eligible else "NOT_RECOMMENDED"

    existing_sar = db.query(SarRecordModel).filter(SarRecordModel.case_id == case_id).first()

    if existing_sar and existing_sar.status in ("APPROVED", "PREPARED", "SUBMISSION_PENDING", "FILED", "NOT_FILED"):
        return _format_sar_response(existing_sar)

    sar_id = existing_sar.sar_id if existing_sar else f"SAR-{uuid4().hex[:8].upper()}"
    now = datetime.utcnow()

    tx_ids = getattr(agent_output, "affected_transaction_ids", []) or []
    card_ids = getattr(agent_output, "connected_card_ids", []) or []
    cust_id = getattr(agent_output, "customer_id", None)
    cust_ids = [cust_id] if cust_id else []
    dev_ids = getattr(agent_output, "connected_device_ids", []) or []
    reg_ids = []
    closed_case_ids = getattr(agent_output, "similar_prior_cases", []) or []

    evidence_list = getattr(agent_output, "evidence", []) or []
    evidence_snap = [
        {
            "id": getattr(e, "evidence_id", None) or getattr(e, "id", None),
            "type": getattr(e, "evidence_type", None) or getattr(e, "type", None),
            "description": getattr(e, "description", None) or str(e),
            "strength": getattr(e, "strength", None) or getattr(e, "risk_signal", None)
        }
        for e in evidence_list
    ]

    rules_snap = [
        {
            "rule_id": r.get("rule_id") if isinstance(r, dict) else getattr(r, "rule_id", ""),
            "triggered": r.get("triggered") if isinstance(r, dict) else getattr(r, "triggered", False),
            "description": r.get("description") if isinstance(r, dict) else getattr(r, "description", "")
        }
        for r in rules
    ]

    if not existing_sar:
        sar_record = SarRecordModel(
            sar_id=sar_id,
            case_id=case_id,
            investigation_id=investigation_id,
            status=target_status,
            eligibility=eligibility_status,
            eligibility_reason=reason,
            exposure_usd=exposure,
            related_transaction_ids=json.dumps(tx_ids),
            related_card_ids=json.dumps(card_ids),
            related_customer_ids=json.dumps(cust_ids),
            related_device_ids=json.dumps(dev_ids),
            related_regions=json.dumps(reg_ids),
            related_closed_case_ids=json.dumps(closed_case_ids),
            supporting_evidence=json.dumps(evidence_snap),
            policy_rules=json.dumps(rules_snap),
            created_at=now,
            updated_at=now
        )
        db.add(sar_record)
        db.commit()
        db.refresh(sar_record)

        if is_eligible:
            create_audit_event(
                db,
                case_id=case_id,
                investigation_id=investigation_id,
                event_type="SAR_CANDIDATE_CREATED",
                description=f"Generated SAR candidate '{sar_id}' for case '{case_id}' linked to investigation '{investigation_id}'. Reason: {reason}",
                actor="SYSTEM",
                metadata={"sar_id": sar_id, "exposure_usd": exposure, "eligibility": eligibility_status}
            )
        return _format_sar_response(sar_record)
    else:
        existing_sar.investigation_id = investigation_id
        existing_sar.status = target_status
        existing_sar.eligibility = eligibility_status
        existing_sar.eligibility_reason = reason
        existing_sar.exposure_usd = exposure
        existing_sar.related_transaction_ids = json.dumps(tx_ids)
        existing_sar.related_card_ids = json.dumps(card_ids)
        existing_sar.related_customer_ids = json.dumps(cust_ids)
        existing_sar.related_device_ids = json.dumps(dev_ids)
        existing_sar.related_regions = json.dumps(reg_ids)
        existing_sar.related_closed_case_ids = json.dumps(closed_case_ids)
        existing_sar.supporting_evidence = json.dumps(evidence_snap)
        existing_sar.policy_rules = json.dumps(rules_snap)
        existing_sar.updated_at = now
        db.commit()
        db.refresh(existing_sar)

        if is_eligible and existing_sar.status == "CANDIDATE":
            create_audit_event(
                db,
                case_id=case_id,
                investigation_id=investigation_id,
                event_type="SAR_CANDIDATE_CREATED",
                description=f"Updated SAR candidate '{sar_id}' for case '{case_id}' linked to investigation '{investigation_id}'.",
                actor="SYSTEM",
                metadata={"sar_id": sar_id, "exposure_usd": exposure}
            )

        return _format_sar_response(existing_sar)



def get_sar_record(db: Session, case_id: str) -> Optional[SarRecordResponse]:
    """Retrieves current SAR record for a case ID."""
    sar = db.query(SarRecordModel).filter(SarRecordModel.case_id == case_id).first()
    if not sar:
        return None
    return _format_sar_response(sar)


def review_sar_record(db: Session, case_id: str, payload: SarReviewRequest) -> SarRecordResponse:
    """
    Executes analyst review of a SAR candidate (Approve -> APPROVED or Do Not File -> NOT_FILED).
    Validates lifecycle transition and logs audit trail events.
    """
    sar = db.query(SarRecordModel).filter(SarRecordModel.case_id == case_id).first()
    if not sar:
        raise ValueError(f"No SAR record exists for case '{case_id}'.")

    decision = payload.decision.lower().strip()
    if decision not in ("approve", "do_not_file"):
        raise ValueError(f"Invalid review decision '{payload.decision}'. Allowed: 'approve' or 'do_not_file'.")

    target_status = "APPROVED" if decision == "approve" else "NOT_FILED"
    validate_sar_transition(sar.status, target_status)

    now = datetime.utcnow()
    actor = payload.reviewer_id or "ANALYST"

    # Audit: SAR_REVIEW_STARTED
    create_audit_event(
        db,
        case_id=case_id,
        investigation_id=sar.investigation_id,
        event_type="SAR_REVIEW_STARTED",
        description=f"Analyst '{actor}' initiated review of SAR '{sar.sar_id}'.",
        actor=actor,
        metadata={"sar_id": sar.sar_id, "decision": decision}
    )

    sar.status = target_status
    sar.analyst_decision = "APPROVE" if decision == "approve" else "DO_NOT_FILE"
    if payload.analyst_notes:
        sar.analyst_notes = payload.analyst_notes
    sar.reviewer_id = actor
    sar.reviewed_at = now
    sar.updated_at = now
    db.commit()
    db.refresh(sar)

    # Audit: SAR_APPROVED or SAR_NOT_FILED
    audit_type = "SAR_APPROVED" if decision == "approve" else "SAR_NOT_FILED"
    create_audit_event(
        db,
        case_id=case_id,
        investigation_id=sar.investigation_id,
        event_type=audit_type,
        description=f"SAR '{sar.sar_id}' status set to '{target_status}' by analyst '{actor}'. Notes: {payload.analyst_notes or 'None'}",
        actor=actor,
        metadata={"sar_id": sar.sar_id, "status": target_status}
    )

    return _format_sar_response(sar)


def prepare_sar_report(db: Session, case_id: str, payload: SarPrepareRequest) -> SarRecordResponse:
    """
    Generates a structured internal SAR report draft for an APPROVED SAR record.
    Transitions status to PREPARED and logs audit event SAR_PREPARED.
    """
    sar = db.query(SarRecordModel).filter(SarRecordModel.case_id == case_id).first()
    if not sar:
        raise ValueError(f"No SAR record exists for case '{case_id}'.")

    validate_sar_transition(sar.status, "PREPARED")

    now = datetime.utcnow()
    actor = payload.actor or "ANALYST"
    ref_id = f"SAR-REP-{case_id}-{uuid4().hex[:6].upper()}"

    def _safe_parse_json(text: Optional[str], default: Any) -> Any:
        if not text:
            return default
        try:
            return json.loads(text)
        except Exception:
            return default

    draft_data = {
        "report_id": ref_id,
        "case_id": case_id,
        "investigation_id": sar.investigation_id,
        "sar_id": sar.sar_id,
        "status": "PREPARED",
        "suspicious_activity_summary": sar.eligibility_reason,
        "total_exposure_usd": sar.exposure_usd,
        "involved_customer_ids": _safe_parse_json(sar.related_customer_ids, []),
        "involved_card_ids": _safe_parse_json(sar.related_card_ids, []),
        "involved_transaction_ids": _safe_parse_json(sar.related_transaction_ids, []),
        "involved_device_ids": _safe_parse_json(sar.related_device_ids, []),
        "involved_billing_regions": _safe_parse_json(sar.related_regions, []),
        "connected_historical_cases": _safe_parse_json(sar.related_closed_case_ids, []),
        "applicable_policy_rules": _safe_parse_json(sar.policy_rules, []),
        "supporting_evidence": _safe_parse_json(sar.supporting_evidence, []),
        "analyst_notes": sar.analyst_notes or payload.notes,
        "reviewer_id": sar.reviewer_id,
        "prepared_at": now.isoformat(),
        "filing_notice": "External SAR filing integration not configured. Report draft prepared for internal compliance record."
    }

    sar.status = "PREPARED"
    sar.report_reference = ref_id
    sar.report_draft_json = json.dumps(draft_data)
    sar.prepared_at = now
    sar.updated_at = now
    db.commit()
    db.refresh(sar)

    create_audit_event(
        db,
        case_id=case_id,
        investigation_id=sar.investigation_id,
        event_type="SAR_PREPARED",
        description=f"Prepared internal SAR report draft '{ref_id}' for case '{case_id}'.",
        actor=actor,
        metadata={"sar_id": sar.sar_id, "report_reference": ref_id}
    )

    return _format_sar_response(sar)


def update_submission_status(db: Session, case_id: str, payload: SarSubmissionStatusRequest) -> SarRecordResponse:
    """
    Updates internal submission tracking status for a PREPARED SAR record.
    Prevents setting status to FILED if no external filing integration exists.
    """
    sar = db.query(SarRecordModel).filter(SarRecordModel.case_id == case_id).first()
    if not sar:
        raise ValueError(f"No SAR record exists for case '{case_id}'.")

    target_status = payload.status.upper().strip()
    if target_status == "FILED":
        raise ValueError("External filing integration not configured. Status cannot be set to FILED automatically.")

    validate_sar_transition(sar.status, target_status)

    now = datetime.utcnow()
    actor = payload.actor or "ANALYST"

    sar.status = target_status
    sar.updated_at = now
    if target_status == "SUBMISSION_PENDING":
        sar.submitted_at = None  # Pending internal submission tracking

    db.commit()
    db.refresh(sar)

    create_audit_event(
        db,
        case_id=case_id,
        investigation_id=sar.investigation_id,
        event_type=f"SAR_{target_status}",
        description=f"Updated SAR '{sar.sar_id}' status to '{target_status}'.",
        actor=actor,
        metadata={"sar_id": sar.sar_id, "status": target_status}
    )

    return _format_sar_response(sar)
