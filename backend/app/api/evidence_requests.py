"""
Evidence Requests API Router
============================
Endpoints for the full evidence request lifecycle:

  GET    /api/evidence-requests/{case_id}              — list for a case
  GET    /api/evidence-requests/{case_id}/{request_id} — get single request
  POST   /api/evidence-requests/{case_id}              — create PENDING request
  POST   /api/evidence-requests/{request_id}/respond   — record response → triggers new investigation
  POST   /api/evidence-requests/{request_id}/cancel    — cancel PENDING request

State-transition rules are enforced by the service layer.
Audit events are written for every lifecycle change.

CRITICAL: HHG-003 / ER-HHG-003-001 status is never modified by GET or
list operations. Only an explicit POST .../respond call with a real
analyst-provided response changes its status.
"""

import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.services.database import get_db
from app.models.investigation import CaseModel
from app.schemas.investigation import (
    EvidenceRequestCreate,
    EvidenceRequestRespond,
    EvidenceRequestCancel,
    EvidenceRequestResponse,
    EvidenceRequestRespondResult,
)
from app.services.evidence_request_service import (
    get_evidence_request,
    list_evidence_requests,
    create_evidence_request,
    respond_to_evidence_request,
    cancel_evidence_request,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/evidence-requests", tags=["Evidence Requests"])


# ---------------------------------------------------------------------------
# GET /api/evidence-requests/{case_id}
# ---------------------------------------------------------------------------

@router.get("/{case_id}", response_model=List[EvidenceRequestResponse])
def list_requests_for_case(case_id: str, db: Session = Depends(get_db)):
    """
    List all evidence requests for a case, newest first.
    Returns an empty list if no requests have been created yet.
    Does NOT modify any request status.
    """
    requests = list_evidence_requests(db, case_id)
    return requests


# ---------------------------------------------------------------------------
# GET /api/evidence-requests/{case_id}/{request_id}
# ---------------------------------------------------------------------------

@router.get("/{case_id}/{request_id}", response_model=EvidenceRequestResponse)
def get_single_request(case_id: str, request_id: str, db: Session = Depends(get_db)):
    """
    Retrieve a single evidence request by its ID.
    Returns 404 if the request does not exist or does not belong to the given case.
    """
    er = get_evidence_request(db, request_id)
    if not er:
        raise HTTPException(
            status_code=404,
            detail=f"Evidence request '{request_id}' not found.",
        )
    if er.case_id != case_id:
        raise HTTPException(
            status_code=404,
            detail=f"Evidence request '{request_id}' does not belong to case '{case_id}'.",
        )
    return er


# ---------------------------------------------------------------------------
# POST /api/evidence-requests/{case_id}
# ---------------------------------------------------------------------------

@router.post("/{case_id}", response_model=EvidenceRequestResponse, status_code=201)
def create_request(
    case_id: str,
    body: EvidenceRequestCreate,
    db: Session = Depends(get_db),
):
    """
    Create a new PENDING evidence request for a case.

    - Validates the case exists (auto-creates a minimal case stub if absent,
      consistent with how POST /api/investigations/{case_id} behaves).
    - Validates the request_text is non-empty (enforced by schema min_length=5).
    - Returns the created evidence request with status PENDING.
    - Emits audit event: EVIDENCE_REQUEST_CREATED.
    """
    try:
        er = create_evidence_request(db, case_id, body)
        return er
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        logger.error("create_evidence_request failed for case %s: %s", case_id, exc)
        raise HTTPException(status_code=500, detail=f"Failed to create evidence request: {str(exc)}")


# ---------------------------------------------------------------------------
# POST /api/evidence-requests/{request_id}/respond
# ---------------------------------------------------------------------------

@router.post("/{request_id}/respond", response_model=EvidenceRequestRespondResult)
async def respond_to_request(
    request_id: str,
    body: EvidenceRequestRespond,
    db: Session = Depends(get_db),
):
    """
    Record a real analyst/customer response to a PENDING evidence request.

    Rules:
    - Only PENDING requests may be responded to.
    - The response body must be non-empty.
    - The previous investigation is NOT modified.
    - A NEW investigation is started using the updated case context.
    - If the new investigation fails, the response is still persisted; the error
      is surfaced in the 'investigation_error' field of the response.

    Returns EvidenceRequestRespondResult containing:
      - evidence_request: updated request (status = RESPONDED)
      - new_investigation_id: ID of the newly triggered investigation (if successful)
      - investigation_triggered: True if a new investigation was started
      - investigation_error: error message if the investigation failed (or null)

    CRITICAL: Do not call this endpoint for HHG-003/ER-HHG-003-001 unless a
    genuine customer response has been received. Fabricated responses are not
    permitted by project requirements.
    """
    if not body.response or not body.response.strip():
        raise HTTPException(status_code=422, detail="Response text must not be empty.")

    try:
        result = await respond_to_evidence_request(db, request_id, body)
        return result
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        # Invalid state transition (e.g., already RESPONDED or CANCELLED)
        raise HTTPException(status_code=409, detail=str(exc))
    except Exception as exc:
        logger.error("respond_to_evidence_request failed for %s: %s", request_id, exc)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to record response for evidence request '{request_id}': {str(exc)}",
        )


# ---------------------------------------------------------------------------
# POST /api/evidence-requests/{request_id}/cancel
# ---------------------------------------------------------------------------

@router.post("/{request_id}/cancel", response_model=EvidenceRequestResponse)
def cancel_request(
    request_id: str,
    body: EvidenceRequestCancel,
    db: Session = Depends(get_db),
):
    """
    Cancel a PENDING evidence request.

    Rules:
    - Only PENDING requests may be cancelled.
    - RESPONDED and CANCELLED requests cannot be cancelled.
    - Does NOT trigger a new investigation.
    - Emits audit event: EVIDENCE_REQUEST_CANCELLED.

    Returns the updated evidence request with status = CANCELLED.
    """
    try:
        er = cancel_evidence_request(db, request_id, body)
        return er
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        # Invalid state transition
        raise HTTPException(status_code=409, detail=str(exc))
    except Exception as exc:
        logger.error("cancel_evidence_request failed for %s: %s", request_id, exc)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to cancel evidence request '{request_id}': {str(exc)}",
        )