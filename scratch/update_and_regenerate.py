import sys
import os
import csv
import io
import json
import asyncio
from datetime import datetime
from uuid import uuid4
from dotenv import load_dotenv

repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
backend_dir = os.path.join(repo_root, "backend")
env_path = os.path.join(backend_dir, ".env")
load_dotenv(dotenv_path=env_path)

sys.path.insert(0, backend_dir)

from app.core.config import settings
from app.services.database import SessionLocal, Base, engine
from app.models.investigation import CaseModel, EvidenceRequestModel, SarRecordModel
from app.agent.investigator import investigator_agent
from app.services.history_service import persist_investigation_run
from app.services.evidence_request_service import sync_tigergraph_requests
from app.services.sar_service import sync_sar_candidate_from_result
from app.services.tigergraph import tigergraph_service

tigergraph_service.host = settings.TIGERGRAPH_HOST.rstrip("/") if settings.TIGERGRAPH_HOST else ""
tigergraph_service.graph_name = settings.TIGERGRAPH_GRAPH_NAME
tigergraph_service.secret = settings.TIGERGRAPH_SECRET
tigergraph_service._token = settings.TIGERGRAPH_TOKEN

settings.USE_LOCAL_LLM = True
Base.metadata.create_all(bind=engine)

CSV_DATA = """case_id,opened_at,trigger_type,trigger_text,flagged_txn_id,card_id,customer_id,risk_score
HHG-001,2016-12-05 01:55:28,risk_score,"Real-time model scored transaction 3514030 ($77.07, in billing region 444.0) at 0.61. Review and decide.",3514030,C12382-K1,C12382,0.61
HHG-002,2016-11-22 23:27:07,risk_score,"Real-time model scored transaction 3478782 ($292.36, online) at 0.79. Review and decide.",3478782,C11891-K1,C11891,0.79
HHG-003,2016-12-10 15:01:21,customer_report,Customer C08623 message: 'I never made this $49.00 purchase. Please check my card.' Refers to 3530164.,3530164,C08623-K2,C08623,
HHG-004,2016-12-29 07:53:54,customer_report,Customer C08106 message: 'I never made this $128.33 purchase. Please check my card.' Refers to 3583227.,3583227,C08106-K1,C08106,
HHG-005,2016-12-08 03:38:37,risk_score,"Real-time model scored transaction 3523199 ($100.07, online) at 0.54. Review and decide.",3523199,C02923-K1,C02923,0.54
HHG-006,2016-11-22 02:30:00,customer_report,Customer C07297 message: 'I never made this $482.12 purchase. Please check my card.' Refers to 3476682.,3476682,C07297-K1,C07297,
HHG-007,2016-12-05 03:46:14,risk_score,"Real-time model scored transaction 3514948 ($111.92, in billing region 264.0) at 0.87. Review and decide.",3514948,C09933-K2,C09933,0.87
HHG-008,2016-12-20 03:08:56,customer_report,Customer C13171 message: 'I never made this $55.68 purchase. Please check my card.' Refers to 3558054.,3558054,C13171-K2,C13171,
HHG-009,2016-12-28 17:10:53,customer_report,Customer C08299 message: 'I never made this $30.02 purchase. Please check my card.' Refers to 3581141.,3581141,C08299-K1,C08299,
HHG-010,2016-12-02 18:18:27,risk_score,"Real-time model scored transaction 3506725 ($1,000.03, online) at 0.90. Review and decide.",3506725,C10434-K1,C10434,0.90
HHG-011,2016-12-29 06:27:44,customer_report,Customer C11923 message: 'I never made this $131.30 purchase. Please check my card.' Refers to 3583368.,3583368,C11923-K2,C11923,
HHG-012,2016-12-18 05:00:31,risk_score,"Real-time model scored transaction 3553342 ($30.91, in billing region 494.0) at 0.55. Review and decide.",3553342,C05876-K2,C05876,0.55
HHG-013,2016-12-09 05:39:29,risk_score,"Real-time model scored transaction 3526826 ($35.66, online) at 0.76. Review and decide.",3526826,C07671-K2,C07671,0.76
HHG-014,2016-11-22 20:11:00,analyst_request,Analyst request: several cards this month show purchases from the same unusual device profile. Review transaction 3478561 on card C13487-K1 and look for related activity.,3478561,C13487-K1,C13487,
HHG-015,2016-11-17 19:03:36,risk_score,"Real-time model scored transaction 3464869 ($599.94, online) at 0.77. Review and decide.",3464869,C03042-K1,C03042,0.77
HHG-016,2016-12-12 01:39:08,customer_report,Customer C09988 message: 'I never made this $59.67 purchase. Please check my card.' Refers to 3534820.,3534820,C09988-K1,C09988,
HHG-017,2016-11-12 00:46:24,risk_score,"Real-time model scored transaction 3450629 ($100.09, online) at 0.57. Review and decide.",3450629,C04570-K1,C04570,0.57
HHG-018,2016-11-27 14:41:26,customer_report,Customer C02354 message: 'I never made this $39.08 purchase. Please check my card.' Refers to 3491361.,3491361,C02354-K2,C02354,
HHG-019,2016-12-01 22:28:53,risk_score,"Real-time model scored transaction 3503878 ($99.92, online) at 0.90. Review and decide.",3503878,C07987-K2,C07987,0.90
HHG-020,2016-12-03 12:04:26,risk_score,"Real-time model scored transaction 3509359 ($125.08, online) at 0.52. Review and decide.",3509359,C12265-K2,C12265,0.52
"""

class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

def reset_db_evidence_requests(db):
    er3 = db.query(EvidenceRequestModel).filter(EvidenceRequestModel.request_id == "ER-HHG-003-001").first()
    if er3:
        er3.case_id = "HHG-003"
        db.commit()

async def sync_db_and_tg(row, db):
    case_id = row["case_id"]
    opened_at = datetime.strptime(row["opened_at"], "%Y-%m-%d %H:%M:%S")
    trigger_type = row["trigger_type"]
    trigger_text = row["trigger_text"]
    flagged_txn_id = row["flagged_txn_id"]
    card_id = row["card_id"]
    customer_id = row["customer_id"]
    risk_score = float(row["risk_score"]) if row["risk_score"] else None

    # 1. Update SQLite DB CaseModel
    case = db.query(CaseModel).filter(CaseModel.case_id == case_id).first()
    if not case:
        case = CaseModel(
            case_id=case_id,
            customer_id=customer_id,
            transaction_id=flagged_txn_id,
            trigger_type=trigger_type,
            trigger_text=trigger_text,
            status="UNDER_INVESTIGATION",
            created_at=opened_at,
            updated_at=opened_at,
            notes=f"Trigger ({trigger_type}): {trigger_text}"
        )
        db.add(case)
    else:
        case.customer_id = customer_id
        case.transaction_id = flagged_txn_id
        case.trigger_type = trigger_type
        case.trigger_text = trigger_text
        case.created_at = opened_at
        case.updated_at = opened_at
        case.notes = f"Trigger ({trigger_type}): {trigger_text}"
    db.commit()

    # 2. Upsert TigerGraph ClosedCase vertex & INVOLVES edge to transaction via RESTPP
    cc_payload = {
        "vertices": {
            "ClosedCase": {
                case_id: {
                    "case_id": {"value": case_id},
                    "opened_at": {"value": row["opened_at"]}
                }
            }
        },
        "edges": {
            "ClosedCase": {
                case_id: {
                    "INVOLVES": {
                        "Transaction": {
                            flagged_txn_id: {}
                        }
                    }
                }
            }
        }
    }
    url = f"{tigergraph_service.host}/restpp/graph/{tigergraph_service.graph_name}"
    import httpx
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            headers = await tigergraph_service._get_auth_headers(client)
            resp = await client.post(url, headers=headers, json=cc_payload)
            if resp.status_code in (401, 403):
                tigergraph_service._token = None
                headers = await tigergraph_service._get_auth_headers(client)
                resp = await client.post(url, headers=headers, json=cc_payload)
            print(f"TG Upsert {case_id} -> {flagged_txn_id}: HTTP {resp.status_code}")
        except Exception as tg_err:
            print(f"TG Upsert error for {case_id}: {tg_err}")

async def process_case(row, db):
    case_id = row["case_id"]
    print(f"\n--- Processing & Investigating {case_id} ---")
    
    await sync_db_and_tg(row, db)
    
    investigation_id = f"INV-{uuid4().hex[:8].upper()}"
    reset_db_evidence_requests(db)

    # Execute agent investigation workflow
    agent_output = await investigator_agent.investigate(case_id, notes=row["trigger_text"])
    agent_output.investigation_id = investigation_id

    # Ensure customer_id is populated from metadata if empty
    if not agent_output.customer_id or agent_output.customer_id.startswith("CUST-HHG"):
        agent_output.customer_id = row["customer_id"]

    # Sync Evidence Requests
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

    reset_db_evidence_requests(db)
    persist_investigation_run(db, investigation_id=investigation_id, result=agent_output, decision_rules=agent_output.rules_evaluated)

    try:
        sync_sar_candidate_from_result(db, case_id=case_id, investigation_id=investigation_id, agent_output=agent_output)
    except Exception as e:
        print(f"SAR sync note for {case_id}: {e}")

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

    answer = {
        "case_id": case_id,
        "customer_id": agent_output.customer_id,
        "case_status": agent_output.case_status,
        "status": agent_output.status,
        "verdict": agent_output.verdict,
        "fraud_probability": agent_output.fraud_probability,
        "pattern": agent_output.pattern,
        "evidence": evidence_list,
        "affected_transaction_ids": agent_output.affected_transaction_ids or [row["flagged_txn_id"]],
        "connected_cards": agent_output.connected_card_ids or [row["card_id"]],
        "connected_card_ids": agent_output.connected_card_ids or [row["card_id"]],
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

    cases_dir = os.path.join(repo_root, "cases")
    os.makedirs(cases_dir, exist_ok=True)
    out_path = os.path.join(cases_dir, f"{case_id}.json")

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(answer, f, indent=2, cls=DateTimeEncoder)

    print(f"Saved {out_path} - Customer: {agent_output.customer_id}, Txns: {answer['affected_transaction_ids']}, Verdict: {agent_output.verdict}, Status: {agent_output.case_status}")

async def main():
    reader = csv.DictReader(io.StringIO(CSV_DATA.strip()))
    db = SessionLocal()
    try:
        reset_db_evidence_requests(db)
        for row in reader:
            await process_case(row, db)
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(main())
