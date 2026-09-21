from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.services.database import get_db
from app.models.investigation import CaseModel, InvestigationModel, AuditEventModel
from app.schemas.investigation import CaseResponse, InvestigationHistoryResponse, InvestigationHistoryItem, AuditEventItem

router = APIRouter(prefix="/api/cases", tags=["Cases"])

@router.get("", response_model=List[CaseResponse])
async def list_cases(db: Session = Depends(get_db)):
    """
    Get list of all fraud investigation cases.
    """
    cases = db.query(CaseModel).order_by(CaseModel.created_at.desc()).all()
    return cases

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
