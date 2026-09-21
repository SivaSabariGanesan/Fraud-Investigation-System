from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.services.database import get_db
from app.models.investigation import CaseModel
from app.schemas.investigation import CaseResponse

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
