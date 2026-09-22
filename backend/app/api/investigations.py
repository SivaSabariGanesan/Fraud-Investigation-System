from uuid import uuid4
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.services.database import get_db
from app.models.investigation import CaseModel, InvestigationModel
from app.schemas.investigation import InvestigationResult, InvestigationRequest, InvestigationDetailResponse
from app.agent.investigator import investigator_agent
from app.services.history_service import create_audit_event, persist_investigation_run, get_investigation_detail
from app.services.evidence_request_service import sync_tigergraph_requests

router = APIRouter(prefix="/api/investigations", tags=["Investigations"])

@router.post("/{case_id}", response_model=InvestigationResult)
async def run_investigation(
    case_id: str, 
    body: InvestigationRequest = InvestigationRequest(),
    db: Session = Depends(get_db)
):
    """
    Trigger the Fraud Investigation Agent workflow for a specific case ID.
    Queries TigerGraph for graph evidence, evaluates risk rules, logs audit trail events,
    and immutably persists historical investigation findings in SQLite.

    Also syncs any TigerGraph EvidenceRequest vertices into the evidence_requests SQLite
    table so they participate in the lifecycle workflow (create/respond/cancel).
    This sync is idempotent — existing rows are never overwritten.
    """
    investigation_id = f"INV-{uuid4().hex[:8].upper()}"
    
    # 1. Ensure CaseModel exists
    case = db.query(CaseModel).filter(CaseModel.case_id == case_id).first()
    if not case:
        case = CaseModel(
            case_id=case_id,
            status="INVESTIGATING",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(case)
        db.commit()
        db.refresh(case)
        create_audit_event(
            db, case_id=case_id, investigation_id=investigation_id,
            event_type="CASE_OPENED", description=f"New fraud case '{case_id}' created in system.", actor="SYSTEM"
        )
    else:
        case.status = "INVESTIGATING"
        case.updated_at = datetime.utcnow()
        db.commit()

    # 2. Audit: INVESTIGATION_STARTED
    create_audit_event(
        db, case_id=case_id, investigation_id=investigation_id,
        event_type="INVESTIGATION_STARTED", description=f"Investigation run '{investigation_id}' started for case '{case_id}'.", actor="AGENT"
    )

    try:
        # 3. Run Agent Workflow against real FraudGraph
        agent_output = await investigator_agent.investigate(case_id, body.notes)
        agent_output.investigation_id = investigation_id

        # 4. Sync TigerGraph EvidenceRequest vertices into SQLite evidence_requests table.
        #    This is idempotent — existing rows (including ER-HHG-003-001) are never modified.
        tg_evidence_requests = [
            er.details if hasattr(er, "details") else er.__dict__
            if hasattr(er, "__dict__") else {}
            for er in agent_output.evidence_requests
        ]
        # Use raw dicts from agent output for sync
        raw_er_list = []
        for er in agent_output.evidence_requests:
            if hasattr(er, "model_dump"):
                d = er.model_dump()
                # Flatten details into the top-level dict for sync
                if d.get("details"):
                    d.update(d["details"])
                raw_er_list.append(d)
        sync_tigergraph_requests(db, case_id, raw_er_list)

        # Audit: EVIDENCE_COLLECTED
        create_audit_event(
            db, case_id=case_id, investigation_id=investigation_id,
            event_type="EVIDENCE_COLLECTED", description=f"Retrieved & normalized {len(agent_output.evidence)} evidence items from TigerGraph.", actor="AGENT"
        )

        # Audit: LLM_REASONING_COMPLETED
        create_audit_event(
            db, case_id=case_id, investigation_id=investigation_id,
            event_type="LLM_REASONING_COMPLETED", description="Groq AI reasoning analysis completed.", actor="AGENT",
            metadata=agent_output.tokens
        )

        # Audit: POLICY_EVALUATED
        trig_rules = [r.get("rule_id") for r in agent_output.rules_evaluated if r.get("triggered")]
        create_audit_event(
            db, case_id=case_id, investigation_id=investigation_id,
            event_type="POLICY_EVALUATED", description=f"Evaluated policy rules R1-R10. Triggered rules: {', '.join(trig_rules) if trig_rules else 'None'}.", actor="AGENT"
        )

        # Audit: DECISION_GENERATED
        create_audit_event(
            db, case_id=case_id, investigation_id=investigation_id,
            event_type="DECISION_GENERATED", description=f"Generated decision state '{agent_output.status}' with verdict '{agent_output.verdict}'.", actor="AGENT"
        )

        # 5. Immutably persist investigation run & evidence snapshot into SQLite
        persist_investigation_run(
            db, investigation_id=investigation_id, result=agent_output, decision_rules=agent_output.rules_evaluated
        )

        # 6. Audit: INVESTIGATION_COMPLETED
        create_audit_event(
            db, case_id=case_id, investigation_id=investigation_id,
            event_type="INVESTIGATION_COMPLETED", description=f"Investigation '{investigation_id}' completed successfully.", actor="AGENT"
        )

        # 7. Update CaseModel summary
        case.customer_id = agent_output.customer_id
        case.status = agent_output.case_status
        case.verdict = agent_output.verdict
        case.fraud_probability = agent_output.fraud_probability
        case.pattern = agent_output.pattern
        case.exposure = agent_output.exposure
        case.updated_at = datetime.utcnow()
        if body.notes:
            case.notes = body.notes
        db.commit()

        return agent_output

    except Exception as e:
        # Audit: INVESTIGATION_FAILED
        create_audit_event(
            db, case_id=case_id, investigation_id=investigation_id,
            event_type="INVESTIGATION_FAILED", description=f"Investigation workflow failed: {str(e)}", actor="AGENT"
        )
        case.status = "UNDER_INVESTIGATION"
        case.updated_at = datetime.utcnow()
        db.commit()
        raise HTTPException(status_code=500, detail=f"Investigation failed for case '{case_id}': {str(e)}")


@router.get("/{investigation_id}", response_model=InvestigationDetailResponse)
async def get_investigation_by_id(investigation_id: str, db: Session = Depends(get_db)):
    """
    Get complete historical snapshot for a specific investigation ID from SQLite.
    Does NOT re-run TigerGraph or Groq.
    """
    detail = get_investigation_detail(db, investigation_id)
    if not detail:
        raise HTTPException(status_code=404, detail=f"Investigation with ID '{investigation_id}' not found.")
    return detail
