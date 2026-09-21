from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from app.services.database import get_db
from app.models.investigation import CaseModel
from app.schemas.investigation import InvestigationResult, InvestigationRequest, EvidenceItem
from app.agent.investigator import investigator_agent

router = APIRouter(prefix="/api/investigations", tags=["Investigations"])

@router.post("/{case_id}", response_model=InvestigationResult)
async def run_investigation(
    case_id: str, 
    body: InvestigationRequest = InvestigationRequest(),
    db: Session = Depends(get_db)
):
    """
    Trigger the Fraud Investigation Agent workflow for a specific case ID.
    Queries TigerGraph for graph evidence, evaluates risk rules, and updates case status in SQLite.
    """
    case = db.query(CaseModel).filter(CaseModel.case_id == case_id).first()
    if not case:
        # Create case entry if not existing
        case = CaseModel(
            case_id=case_id,
            status="INVESTIGATING",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(case)
        db.commit()
        db.refresh(case)
    else:
        case.status = "INVESTIGATING"
        case.updated_at = datetime.utcnow()
        db.commit()

    # Execute Agent workflow
    agent_output = await investigator_agent.investigate_case(case_id)

    # Persist updated investigation findings into SQLite database
    case.status = "COMPLETED"
    case.verdict = agent_output.verdict
    case.fraud_probability = agent_output.fraud_probability
    case.pattern = agent_output.pattern
    case.exposure = agent_output.exposure
    case.updated_at = datetime.utcnow()
    if body.notes:
        case.notes = body.notes
    db.commit()

    # Convert evidence items for API response
    evidence_list = [
        EvidenceItem(
            id=e.id,
            type=e.type,
            details=e.details,
            risk_signal=e.risk_signal
        )
        for e in agent_output.collected_evidence
    ]

    return InvestigationResult(
        case_id=case.case_id,
        status=case.status,
        verdict=case.verdict,
        fraud_probability=case.fraud_probability,
        pattern=case.pattern,
        exposure=case.exposure,
        evidence_count=len(evidence_list),
        reasoning_summary=agent_output.reasoning_summary,
        evidence=evidence_list,
        created_at=case.created_at,
        updated_at=case.updated_at
    )
