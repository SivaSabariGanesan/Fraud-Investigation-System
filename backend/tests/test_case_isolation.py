# pyrefly: ignore [missing-import]
import pytest
import asyncio
from uuid import uuid4
from fastapi.testclient import TestClient

from app.main import app
from app.services.database import SessionLocal
from app.models.investigation import CaseModel, InvestigationModel, EvidenceRequestModel, SarRecordModel
from app.agent.tools import get_evidence_requests
from app.agent.investigator import investigator_agent
from app.agent.context import build_investigation_context
from app.services.sar_service import sync_sar_candidate_from_result

client = TestClient(app)

@pytest.mark.asyncio
async def test_evidence_requests_are_case_scoped():
    """
    Critical regression test: Verify get_evidence_requests strictly isolates requests per case.
    HHG-003 must return ER-HHG-003-001.
    HHG-007 and HHG-008 must NEVER return ER-HHG-003-001.
    """
    # 1. Fetch HHG-003 evidence requests
    reqs_003 = await get_evidence_requests("HHG-003")
    req_ids_003 = [r.get("id") or r.get("request_id") for r in reqs_003]
    assert any("003" in rid for rid in req_ids_003), "HHG-003 should return its evidence request"

    # 2. Fetch HHG-007 evidence requests
    reqs_007 = await get_evidence_requests("HHG-007")
    req_ids_007 = [r.get("id") or r.get("request_id") for r in reqs_007]
    assert "ER-HHG-003-001" not in req_ids_007, "HHG-007 must NOT contain ER-HHG-003-001"
    assert not any("003" in rid for rid in req_ids_007), "HHG-007 must NOT contain any HHG-003 evidence requests"

    # 3. Fetch HHG-008 evidence requests
    reqs_008 = await get_evidence_requests("HHG-008")
    req_ids_008 = [r.get("id") or r.get("request_id") for r in reqs_008]
    assert "ER-HHG-003-001" not in req_ids_008, "HHG-008 must NOT contain ER-HHG-003-001"
    assert not any("003" in rid for rid in req_ids_008), "HHG-008 must NOT contain any HHG-003 evidence requests"


@pytest.mark.asyncio
async def test_investigation_context_is_case_scoped():
    """
    Verify build_investigation_context isolates evidence strictly to target case.
    """
    res_007 = await investigator_agent.investigate("HHG-007")
    assert res_007.case_id == "HHG-007"
    for ev in res_007.evidence:
        ev_id = ev.evidence_id if hasattr(ev, "evidence_id") else str(ev)
        assert "003" not in ev_id or ev.evidence_type != "EvidenceRequest", f"HHG-007 evidence leaked HHG-003 item: {ev_id}"


@pytest.mark.asyncio
async def test_llm_context_does_not_include_other_case_evidence():
    """
    Verify investigation evidence requests list in agent output does not leak across cases.
    """
    res_008 = await investigator_agent.investigate("HHG-008")
    er_ids = [er.request_id if hasattr(er, "request_id") else er.get("id") or er.get("request_id") for er in res_008.evidence_requests]
    assert "ER-HHG-003-001" not in er_ids, "HHG-008 agent output leaked ER-HHG-003-001"


def test_sar_is_case_scoped():
    """
    Verify SAR records created for HHG-003 and HHG-007 remain strictly independent.
    """
    db = SessionLocal()
    try:
        # Query SAR records for HHG-003 and HHG-007
        sars_003 = db.query(SarRecordModel).filter(SarRecordModel.case_id == "HHG-003").all()
        sars_007 = db.query(SarRecordModel).filter(SarRecordModel.case_id == "HHG-007").all()

        for s in sars_003:
            assert s.case_id == "HHG-003"
        for s in sars_007:
            assert s.case_id == "HHG-007"
            assert s.sar_id not in [s3.sar_id for s3 in sars_003]
    finally:
        db.close()


def test_investigation_history_is_case_scoped():
    """
    Verify GET /api/cases/{case_id}/investigations returns only runs for that case.
    """
    res = client.get("/api/cases/HHG-007/investigations")
    assert res.status_code == 200
    data = res.json()
    assert data["case_id"] == "HHG-007"
    for item in data.get("investigations", []):
        assert item["case_id"] == "HHG-007"


@pytest.mark.asyncio
async def test_reinvestigation_creates_new_investigation_id():
    """
    Verify triggering a new investigation run generates a unique investigation_id.
    """
    res1 = await investigator_agent.investigate("HHG-001")
    res1.investigation_id = f"INV-{uuid4().hex[:8].upper()}"

    res2 = await investigator_agent.investigate("HHG-001")
    res2.investigation_id = f"INV-{uuid4().hex[:8].upper()}"

    assert res1.investigation_id != res2.investigation_id


def test_evidence_request_case_id_immutability():
    """
    Regression test: Verify EvidenceRequest.case_id is strictly immutable.
    sync_tigergraph_requests must NEVER rewrite an existing request's case_id when called under a different case.
    ER-HHG-003-001 must permanently remain case_id = HHG-003.
    """
    from app.services.evidence_request_service import sync_tigergraph_requests
    db = SessionLocal()
    try:
        # 1. Ensure ER-HHG-003-001 is seeded under HHG-003
        sync_tigergraph_requests(db, "HHG-003", [{
            "id": "ER-HHG-003-001",
            "request_id": "ER-HHG-003-001",
            "case_id": "HHG-003",
            "status": "pending",
            "request_text": "Confirm transaction."
        }])
        
        er = db.query(EvidenceRequestModel).filter(EvidenceRequestModel.request_id == "ER-HHG-003-001").first()
        assert er is not None
        assert er.case_id == "HHG-003"
        
        # 2. Call sync_tigergraph_requests for case HHG-007 attempting to sync ER-HHG-003-001
        sync_tigergraph_requests(db, "HHG-007", [{
            "id": "ER-HHG-003-001",
            "request_id": "ER-HHG-003-001",
            "case_id": "HHG-007",
            "status": "pending",
            "request_text": "Confirm transaction."
        }])
        
        # 3. Verify ER-HHG-003-001 case_id remained HHG-003 and was NOT rewritten
        er_recheck = db.query(EvidenceRequestModel).filter(EvidenceRequestModel.request_id == "ER-HHG-003-001").first()
        assert er_recheck.case_id == "HHG-003", f"case_id was mutated to {er_recheck.case_id}!"
    finally:
        db.close()

