from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import Optional

from app.services.database import get_db
from app.models.investigation import CaseModel
from app.schemas.investigation import (
    SarReviewRequest,
    SarPrepareRequest,
    SarSubmissionStatusRequest,
    SarRecordResponse
)
from app.services.sar_service import (
    get_sar_record,
    review_sar_record,
    prepare_sar_report,
    update_submission_status
)

router = APIRouter(prefix="/api/cases", tags=["SAR Workflow"])


@router.get("/{case_id}/sar", response_model=SarRecordResponse)
async def get_case_sar_record(case_id: str, db: Session = Depends(get_db)):
    """
    Get current persistent Suspicious Activity Report (SAR) record for a case ID.
    """
    case = db.query(CaseModel).filter(CaseModel.case_id == case_id).first()
    if not case and not case_id.startswith("HHG-"):
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found.")

    sar = get_sar_record(db, case_id)
    if not sar:
        raise HTTPException(status_code=404, detail=f"No SAR record found for case '{case_id}'. Run an investigation first.")

    return sar


@router.post("/{case_id}/sar/review", response_model=SarRecordResponse)
async def review_sar(
    case_id: str,
    payload: SarReviewRequest,
    db: Session = Depends(get_db)
):
    """
    Execute analyst review of a CANDIDATE or UNDER_REVIEW SAR record.
    Decision must be 'approve' or 'do_not_file'.
    """
    try:
        return review_sar_record(db, case_id, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SAR review failed: {str(e)}")


@router.post("/{case_id}/sar/prepare", response_model=SarRecordResponse)
async def prepare_sar(
    case_id: str,
    payload: SarPrepareRequest = SarPrepareRequest(),
    db: Session = Depends(get_db)
):
    """
    Generates a structured internal SAR report draft for an APPROVED SAR record.
    Transitions status to PREPARED.
    """
    try:
        return prepare_sar_report(db, case_id, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SAR report preparation failed: {str(e)}")


@router.post("/{case_id}/sar/submission-status", response_model=SarRecordResponse)
async def update_sar_submission(
    case_id: str,
    payload: SarSubmissionStatusRequest = SarSubmissionStatusRequest(),
    db: Session = Depends(get_db)
):
    """
    Updates internal submission tracking status for a PREPARED SAR record.
    Note: Setting status to FILED directly is rejected if no external regulator filing API is configured.
    """
    try:
        return update_submission_status(db, case_id, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SAR submission status update failed: {str(e)}")
