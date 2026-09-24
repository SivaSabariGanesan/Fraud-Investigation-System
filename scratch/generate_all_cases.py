import sys
import os
import json
import asyncio
from datetime import datetime
from uuid import uuid4
from dotenv import load_dotenv

# Load backend/.env before importing app modules
repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
backend_dir = os.path.join(repo_root, "backend")
env_path = os.path.join(backend_dir, ".env")
load_dotenv(dotenv_path=env_path)

sys.path.insert(0, backend_dir)

from app.core.config import settings
from app.services.database import get_db, SessionLocal, Base, engine
from app.models.investigation import CaseModel, InvestigationModel, EvidenceRequestModel, AuditEventModel, SarRecordModel
from app.agent.investigator import investigator_agent
from app.services.history_service import create_audit_event, persist_investigation_run
from app.services.evidence_request_service import sync_tigergraph_requests
from app.services.sar_service import sync_sar_candidate_from_result, get_sar_record
from app.services.tigergraph import tigergraph_service

# Re-init TigerGraph service settings
tigergraph_service.host = settings.TIGERGRAPH_HOST.rstrip("/") if settings.TIGERGRAPH_HOST else ""
tigergraph_service.graph_name = settings.TIGERGRAPH_GRAPH_NAME
tigergraph_service.secret = settings.TIGERGRAPH_SECRET
tigergraph_service._token = settings.TIGERGRAPH_TOKEN

# Enable local reasoning mode to avoid remote API rate limits during bulk generation
settings.USE_LOCAL_LLM = True

# Ensure database tables exist
Base.metadata.create_all(bind=engine)

def reset_db_evidence_requests(db):
    """Ensure ER-HHG-003-001 is anchored exclusively to HHG-003 in SQLite."""
    er3 = db.query(EvidenceRequestModel).filter(EvidenceRequestModel.request_id == "ER-HHG-003-001").first()
    if er3:
        er3.case_id = "HHG-003"
        db.commit()

class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

async def process_case(case_id: str, db):
    print(f"\n--- Investigating {case_id} ---")
    investigation_id = f"INV-{uuid4().hex[:8].upper()}"
    
    # Reset DB mapping for ER-HHG-003-001 to guarantee HHG-003 ownership
    reset_db_evidence_requests(db)

    # Ensure case exists in DB
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

    # 1. Execute agent investigation workflow against TigerGraph
    agent_output = await investigator_agent.investigate(case_id)
    agent_output.investigation_id = investigation_id

    # 2. Sync Evidence Requests for this specific case
    raw_er_list = []
    for er in agent_output.evidence_requests:
        req_c_id = getattr(er, "case_id", None) if hasattr(er, "case_id") else er.get("case_id") if isinstance(er, dict) else None
        req_id = getattr(er, "request_id", None) if hasattr(er, "request_id") else er.get("request_id") or er.get("id") if isinstance(er, dict) else ""
        if "003" in str(req_id) and case_id != "HHG-003":
            continue
        if req_c_id and req_c_id != case_id:
            continue

        if hasattr(er, "model_dump"):
            d = er.model_dump()
            if d.get("details"):
                d.update(d["details"])
            raw_er_list.append(d)
        elif isinstance(er, dict):
            raw_er_list.append(er)

    if case_id == "HHG-003" or raw_er_list:
        sync_tigergraph_requests(db, case_id, raw_er_list)

    # Reset DB mapping again after sync
    reset_db_evidence_requests(db)

    # 3. Persist investigation run in DB
    persist_investigation_run(db, investigation_id=investigation_id, result=agent_output, decision_rules=agent_output.rules_evaluated)

    # 4. Sync SAR candidate
    try:
        sync_sar_candidate_from_result(db, case_id=case_id, investigation_id=investigation_id, agent_output=agent_output)
    except Exception as e:
        print(f"SAR sync note for {case_id}: {e}")

    # Fetch live evidence requests strictly belonging to this case from DB
    db_ers = db.query(EvidenceRequestModel).filter(EvidenceRequestModel.case_id == case_id).all()
    formatted_ers = []
    for er in db_ers:
        if er.request_id == "ER-HHG-003-001" and case_id != "HHG-003":
            continue
        formatted_ers.append({
            "request_id": er.request_id,
            "case_id": er.case_id,
            "transaction_id": er.transaction_id,
            "request_type": er.request_type,
            "request_text": er.request_text,
            "status": er.status.lower() if er.status else "pending",
            "response": er.response,
            "response_source": er.response_source,
            "created_at": er.created_at.isoformat() if er.created_at else None,
            "updated_at": er.updated_at.isoformat() if er.updated_at else None,
        })

    # Fetch SAR record if present
    sar_rec = db.query(SarRecordModel).filter(SarRecordModel.case_id == case_id).order_by(SarRecordModel.updated_at.desc()).first()
    sar_data = None
    if sar_rec:
        sar_data = {
            "sar_id": sar_rec.sar_id,
            "status": sar_rec.status,
            "eligibility": sar_rec.eligibility,
            "exposure_usd": sar_rec.exposure_usd,
            "reason": sar_rec.analyst_notes or sar_rec.eligibility_reason or f"Evaluation: {sar_rec.eligibility}",
            "created_at": sar_rec.created_at.isoformat() if sar_rec.created_at else None,
            "updated_at": sar_rec.updated_at.isoformat() if sar_rec.updated_at else None,
        }
    elif agent_output.SAR:
        sar_data = agent_output.SAR

    # Build Evidence list strictly matching case_id
    evidence_list = []
    for ev in agent_output.evidence:
        ev_id = getattr(ev, "evidence_id", None) or (ev.get("evidence_id") if isinstance(ev, dict) else "")
        ev_type = getattr(ev, "evidence_type", None) or (ev.get("evidence_type") if isinstance(ev, dict) else "")
        if ev_type == "EvidenceRequest" and "003" in str(ev_id) and case_id != "HHG-003":
            continue

        if hasattr(ev, "model_dump"):
            d = ev.model_dump()
        elif isinstance(ev, dict):
            d = ev
        else:
            d = str(ev)
        evidence_list.append(d)

    # Format final JSON according to required structure
    answer = {
        "case_id": case_id,
        "customer_id": agent_output.customer_id,
        "case_status": agent_output.case_status,
        "status": agent_output.status,
        "verdict": agent_output.verdict,
        "fraud_probability": agent_output.fraud_probability,
        "pattern": agent_output.pattern,
        "evidence": evidence_list,
        "affected_transaction_ids": agent_output.affected_transaction_ids,
        "connected_cards": agent_output.connected_card_ids,
        "connected_card_ids": agent_output.connected_card_ids,
        "connected_devices": agent_output.connected_device_ids,
        "connected_device_ids": agent_output.connected_device_ids,
        "exposure": agent_output.exposure,
        "similar_prior_cases": agent_output.similar_prior_cases,
        "written_to_graph": agent_output.written_to_graph,
        "evidence_requests": formatted_ers,
        "next_best_actions": agent_output.next_best_actions_final or agent_output.next_best_actions_initial or [],
        "next_best_actions_initial": agent_output.next_best_actions_initial,
        "next_best_actions_final": agent_output.next_best_actions_final,
        "SAR": sar_data,
        "stop_reason": agent_output.stop_reason,
        "rules_evaluated": agent_output.rules_evaluated,
        "reasoning_summary": agent_output.reasoning_summary,
        "tool_calls": agent_output.tool_calls,
        "tokens": agent_output.tokens,
        "latency": agent_output.latency
    }

    # Write to cases/{case_id}.json
    cases_dir = os.path.join(repo_root, "cases")
    os.makedirs(cases_dir, exist_ok=True)
    out_path = os.path.join(cases_dir, f"{case_id}.json")

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(answer, f, indent=2, cls=DateTimeEncoder)

    print(f"Saved {out_path} - Verdict: {agent_output.verdict}, Status: {agent_output.case_status}")

async def main():
    db = SessionLocal()
    try:
        reset_db_evidence_requests(db)
        for i in range(1, 21):
            case_id = f"HHG-{i:03d}"
            await process_case(case_id, db)
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(main())
