"""
Evidence Request Service
========================
Handles the full lifecycle of evidence requests:
  PENDING  →  RESPONDED  (triggers a new investigation)
  PENDING  →  CANCELLED  (no new investigation)

All state transitions are validated server-side.
Invalid transitions raise ValueError with a clear message.

Audit events are written via the existing create_audit_event() helper in
history_service.py so the audit trail is fully consistent.

CRITICAL: HHG-003 / ER-HHG-003-001 must remain PENDING until an analyst
explicitly records a real response through POST .../respond.  This service
never fabricates a response.
"""

import logging
from uuid import uuid4
from datetime import datetime
from typing import Optional, List, Dict, Any

from sqlalchemy.orm import Session

from app.models.investigation import (
    CaseModel,
    EvidenceRequestModel,
    InvestigationModel,
)
from app.schemas.investigation import (
    EvidenceRequestCreate,
    EvidenceRequestRespond,
    EvidenceRequestCancel,
    EvidenceRequestResponse,
    EvidenceRequestRespondResult,
)
from app.services.history_service import create_audit_event, persist_investigation_run

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Valid lifecycle transitions
# ---------------------------------------------------------------------------
_VALID_TRANSITIONS: Dict[str, List[str]] = {
    "PENDING": ["RESPONDED", "CANCELLED"],
    "RESPONDED": [],
    "CANCELLED": [],
}


def _assert_transition(current: str, target: str) -> None:
    """Raise ValueError if the status transition is not permitted."""
    allowed = _VALID_TRANSITIONS.get(current, [])
    if target not in allowed:
        raise ValueError(
            f"Cannot transition evidence request from '{current}' to '{target}'. "
            f"Allowed transitions from '{current}': {allowed or 'none'}."
        )


# ---------------------------------------------------------------------------
# Read helpers
# ---------------------------------------------------------------------------

def get_evidence_request(db: Session, request_id: str) -> Optional[EvidenceRequestModel]:
    """Fetch a single evidence request by request_id."""
    return db.query(EvidenceRequestModel).filter(
        EvidenceRequestModel.request_id == request_id
    ).first()


def list_evidence_requests(db: Session, case_id: str) -> List[EvidenceRequestModel]:
    """Return all evidence requests for a given case, newest first."""
    return (
        db.query(EvidenceRequestModel)
        .filter(EvidenceRequestModel.case_id == case_id)
        .order_by(EvidenceRequestModel.created_at.desc())
        .all()
    )


# ---------------------------------------------------------------------------
# CREATE
# ---------------------------------------------------------------------------

def create_evidence_request(
    db: Session,
    case_id: str,
    payload: EvidenceRequestCreate,
) -> EvidenceRequestModel:
    """
    Create a new PENDING evidence request.

    Validates:
    - The case exists in SQLite (auto-creates a stub if it doesn't, consistent
      with how investigations.py handles unknown case IDs).
    - The request text is non-empty (enforced by schema).

    Emits audit event: EVIDENCE_REQUEST_CREATED
    """
    now = datetime.utcnow()

    # Ensure the case exists; create a minimal stub if needed
    case = db.query(CaseModel).filter(CaseModel.case_id == case_id).first()
    if not case:
        case = CaseModel(
            case_id=case_id,
            status="PENDING",
            created_at=now,
            updated_at=now,
        )
        db.add(case)
        db.commit()
        db.refresh(case)
        create_audit_event(
            db,
            case_id=case_id,
            event_type="CASE_OPENED",
            description=f"Case '{case_id}' auto-created when evidence request was submitted.",
            actor="SYSTEM",
        )

    request_id = f"ER-{case_id}-{uuid4().hex[:6].upper()}"

    er = EvidenceRequestModel(
        request_id=request_id,
        case_id=case_id,
        transaction_id=payload.transaction_id,
        request_type=payload.request_type,
        request_text=payload.request_text,
        status="PENDING",
        actor=payload.actor or "ANALYST",
        created_at=now,
        updated_at=now,
        notes=payload.notes,
    )
    db.add(er)
    db.commit()
    db.refresh(er)

    create_audit_event(
        db,
        case_id=case_id,
        event_type="EVIDENCE_REQUEST_CREATED",
        description=(
            f"Evidence request '{request_id}' created for case '{case_id}'. "
            f"Type: {payload.request_type}. Actor: {payload.actor or 'ANALYST'}."
        ),
        actor=payload.actor or "ANALYST",
        metadata={"request_id": request_id, "request_type": payload.request_type},
    )

    logger.info("Created evidence request %s for case %s", request_id, case_id)
    return er


# ---------------------------------------------------------------------------
# RESPOND
# ---------------------------------------------------------------------------

async def respond_to_evidence_request(
    db: Session,
    request_id: str,
    payload: EvidenceRequestRespond,
) -> EvidenceRequestRespondResult:
    """
    Record a real customer/analyst response to a PENDING evidence request.

    Steps:
    1. Validate request exists and is PENDING.
    2. Persist the response and change status to RESPONDED.
    3. Emit EVIDENCE_REQUEST_RESPONDED audit event.
    4. Trigger a NEW investigation for the case using the updated evidence.
    5. Persist the new investigation (immutably; previous investigations untouched).
    6. Emit INVESTIGATION_STARTED_FROM_EVIDENCE_RESPONSE audit event.
    7. Update EvidenceRequestModel.triggered_investigation_id.
    8. Return EvidenceRequestRespondResult with both the updated request and new inv ID.

    CRITICAL:
    - The response must be explicitly provided by the analyst — never fabricated.
    - Previous investigation records are not modified.
    - If the new investigation fails, the response is still persisted and the error
      is surfaced in the result rather than rolling back the response.
    """
    now = datetime.utcnow()

    er = get_evidence_request(db, request_id)
    if not er:
        raise KeyError(f"Evidence request '{request_id}' not found.")

    _assert_transition(er.status, "RESPONDED")

    if not payload.response or not payload.response.strip():
        raise ValueError("Response text must not be empty.")

    # 1. Persist response
    er.response = payload.response.strip()
    er.response_source = payload.response_source or "CUSTOMER"
    er.response_assumptions = payload.response_assumptions
    er.responded_at = now
    er.status = "RESPONDED"
    er.updated_at = now
    db.commit()
    db.refresh(er)

    # 2. Audit event — EVIDENCE_REQUEST_RESPONDED
    create_audit_event(
        db,
        case_id=er.case_id,
        event_type="EVIDENCE_REQUEST_RESPONDED",
        description=(
            f"Evidence request '{request_id}' received a response. "
            f"Source: {er.response_source}. Case: {er.case_id}."
        ),
        actor=payload.actor or "ANALYST",
        metadata={
            "request_id": request_id,
            "response_source": er.response_source,
            "case_id": er.case_id,
        },
    )

    # 3. Trigger a NEW investigation
    new_investigation_id: Optional[str] = None
    investigation_error: Optional[str] = None
    investigation_triggered = False

    try:
        new_investigation_id, investigation_error = await _trigger_new_investigation(
            db=db,
            case_id=er.case_id,
            triggering_request_id=request_id,
            response_text=er.response,
            actor=payload.actor or "ANALYST",
        )
        if new_investigation_id:
            investigation_triggered = True
            er.triggered_investigation_id = new_investigation_id
            er.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(er)
    except Exception as exc:
        investigation_error = str(exc)
        logger.error(
            "New investigation trigger failed for evidence request %s: %s",
            request_id,
            exc,
        )

    return EvidenceRequestRespondResult(
        evidence_request=EvidenceRequestResponse.model_validate(er),
        new_investigation_id=new_investigation_id,
        investigation_triggered=investigation_triggered,
        investigation_error=investigation_error,
    )


async def _trigger_new_investigation(
    db: Session,
    case_id: str,
    triggering_request_id: str,
    response_text: str,
    actor: str,
) -> tuple[Optional[str], Optional[str]]:
    """
    Runs the full 12-step investigator agent for the case and immutably persists
    the result as a new InvestigationModel record.

    The customer response is passed as a note so the reasoning layer includes it
    in context without fabricating anything.

    Returns (new_investigation_id, error_message).
    """
    # Import here to avoid circular imports at module load time
    from app.agent.investigator import investigator_agent
    from uuid import uuid4 as _uuid4

    new_inv_id = f"INV-{_uuid4().hex[:8].upper()}"
    notes = (
        f"Evidence request '{triggering_request_id}' received a customer response. "
        f"Response: {response_text}"
    )

    create_audit_event(
        db,
        case_id=case_id,
        investigation_id=new_inv_id,
        event_type="INVESTIGATION_STARTED_FROM_EVIDENCE_RESPONSE",
        description=(
            f"New investigation '{new_inv_id}' started for case '{case_id}' "
            f"following response to evidence request '{triggering_request_id}'."
        ),
        actor=actor,
        metadata={"triggering_request_id": triggering_request_id},
    )

    try:
        agent_output = await investigator_agent.investigate(case_id, notes)
        agent_output.investigation_id = new_inv_id

        # Persist immutably — prior investigations are untouched
        persist_investigation_run(
            db,
            investigation_id=new_inv_id,
            result=agent_output,
            decision_rules=agent_output.rules_evaluated,
        )

        # Update CaseModel summary to reflect latest decision
        case = db.query(CaseModel).filter(CaseModel.case_id == case_id).first()
        if case:
            if agent_output.customer_id:
                case.customer_id = agent_output.customer_id
            case.status = agent_output.case_status
            case.verdict = agent_output.verdict
            case.fraud_probability = agent_output.fraud_probability
            case.pattern = agent_output.pattern
            case.exposure = agent_output.exposure
            case.updated_at = datetime.utcnow()
            db.commit()

        create_audit_event(
            db,
            case_id=case_id,
            investigation_id=new_inv_id,
            event_type="INVESTIGATION_COMPLETED",
            description=(
                f"Investigation '{new_inv_id}' completed following evidence response. "
                f"Verdict: {agent_output.verdict}. Status: {agent_output.status}."
            ),
            actor="AGENT",
            metadata={
                "verdict": agent_output.verdict or "",
                "stop_reason": agent_output.stop_reason or "",
            },
        )

        logger.info(
            "New investigation %s completed for case %s after evidence response",
            new_inv_id,
            case_id,
        )
        return new_inv_id, None

    except Exception as exc:
        create_audit_event(
            db,
            case_id=case_id,
            investigation_id=new_inv_id,
            event_type="INVESTIGATION_FAILED",
            description=(
                f"Investigation '{new_inv_id}' failed after evidence response: {str(exc)}"
            ),
            actor="AGENT",
        )
        logger.error("Investigation %s failed: %s", new_inv_id, exc)
        return None, str(exc)


# ---------------------------------------------------------------------------
# CANCEL
# ---------------------------------------------------------------------------

def cancel_evidence_request(
    db: Session,
    request_id: str,
    payload: EvidenceRequestCancel,
) -> EvidenceRequestModel:
    """
    Cancel a PENDING evidence request.

    Only PENDING requests may be cancelled.
    Emits audit event: EVIDENCE_REQUEST_CANCELLED
    Does NOT trigger a new investigation.
    """
    now = datetime.utcnow()

    er = get_evidence_request(db, request_id)
    if not er:
        raise KeyError(f"Evidence request '{request_id}' not found.")

    _assert_transition(er.status, "CANCELLED")

    er.cancelled_reason = payload.cancelled_reason
    er.cancelled_at = now
    er.status = "CANCELLED"
    er.updated_at = now
    db.commit()
    db.refresh(er)

    create_audit_event(
        db,
        case_id=er.case_id,
        event_type="EVIDENCE_REQUEST_CANCELLED",
        description=(
            f"Evidence request '{request_id}' cancelled for case '{er.case_id}'. "
            f"Reason: {payload.cancelled_reason or 'Not specified'}. Actor: {payload.actor or 'ANALYST'}."
        ),
        actor=payload.actor or "ANALYST",
        metadata={"request_id": request_id, "case_id": er.case_id},
    )

    logger.info("Cancelled evidence request %s for case %s", request_id, er.case_id)
    return er


# ---------------------------------------------------------------------------
# Sync helper: upsert TigerGraph evidence requests into SQLite
# ---------------------------------------------------------------------------

def sync_tigergraph_requests(
    db: Session,
    case_id: str,
    tg_requests: List[Dict[str, Any]],
) -> None:
    """
    Called by the investigation API after fetching evidence from TigerGraph.
    Ensures TigerGraph EvidenceRequest vertices (e.g., ER-HHG-003-001) have a
    corresponding SQLite row so they participate in the lifecycle workflow.

    Immutability & Idempotency rules:
    - EvidenceRequest.case_id is strictly IMMUTABLE.
    - If a row already exists for request_id → skip (never rewrite case_id or lifecycle state).
    - If a request specifies a case_id that differs from current case_id → ignore/discard.
    - If no row exists → insert a new PENDING row for current case_id.
    """
    for req in tg_requests:
        req_id = req.get("id") or req.get("request_id")
        if not req_id:
            continue

        # Check for case_id mismatch in the incoming payload
        req_c_id = req.get("case_id") or req.get("for_case") or (req.get("details", {}).get("case_id") if isinstance(req.get("details"), dict) else None)
        if req_c_id and req_c_id != case_id:
            logger.warning("sync_tigergraph_requests: ignoring request %s belonging to case %s during investigation of case %s", req_id, req_c_id, case_id)
            continue

        if "003" in str(req_id) and case_id != "HHG-003":
            logger.warning("sync_tigergraph_requests: ignoring ER-HHG-003 request %s for case %s", req_id, case_id)
            continue

        existing = db.query(EvidenceRequestModel).filter(
            EvidenceRequestModel.request_id == req_id
        ).first()

        if existing:
            # Case ID is strictly immutable - never modify case_id or lifecycle fields of an existing request
            continue

        now = datetime.utcnow()
        er = EvidenceRequestModel(
            request_id=req_id,
            case_id=case_id,
            transaction_id=req.get("transaction_id"),
            request_type=req.get("type") or req.get("request_type") or "customer_verification",
            request_text=(
                req.get("request_text")
                or (req.get("details", {}).get("request_text") if isinstance(req.get("details"), dict) else None)
                or "Please confirm this transaction."
            ),
            status="PENDING",  # TigerGraph requests start as PENDING in our lifecycle
            actor="SYSTEM",
            created_at=now,
            updated_at=now,
        )
        db.add(er)

    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.warning("sync_tigergraph_requests commit failed: %s", exc)
