import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock
from sqlalchemy.orm import Session

from app.main import app
from app.services.database import SessionLocal, engine, Base
from app.models.investigation import (
    CaseModel,
    InvestigationModel,
    InvestigationEvidenceModel,
    InvestigationActionModel,
    InvestigationRuleModel,
    AuditEventModel
)

client = TestClient(app)

@pytest.fixture(autouse=True)
def db_setup():
    """Ensure clean database tables for testing."""
    Base.metadata.create_all(bind=engine)
    yield


@pytest.mark.asyncio
async def test_01_investigation_creates_sqlite_record():
    """Verify POST /api/investigations/{case_id} creates an InvestigationModel record."""
    case_id = "TEST-HIST-001"
    res = client.post(f"/api/investigations/{case_id}", json={})
    assert res.status_code == 200
    data = res.json()
    assert "investigation_id" in data
    inv_id = data["investigation_id"]
    assert inv_id.startswith("INV-")

    db = SessionLocal()
    try:
        inv = db.query(InvestigationModel).filter(InvestigationModel.investigation_id == inv_id).first()
        assert inv is not None
        assert inv.case_id == case_id
        assert inv.status in ("VERIFICATION_PENDING", "UNDER_INVESTIGATION", "COMPLETED", "UNRESOLVED")
    finally:
        db.close()


@pytest.mark.asyncio
async def test_02_repeated_investigation_creates_second_record():
    """Verify repeated investigations for the same case create separate records without overwriting."""
    case_id = "TEST-HIST-002"
    
    res1 = client.post(f"/api/investigations/{case_id}", json={})
    assert res1.status_code == 200
    inv1_id = res1.json()["investigation_id"]

    res2 = client.post(f"/api/investigations/{case_id}", json={})
    assert res2.status_code == 200
    inv2_id = res2.json()["investigation_id"]

    assert inv1_id != inv2_id

    db = SessionLocal()
    try:
        invs = db.query(InvestigationModel).filter(InvestigationModel.case_id == case_id).all()
        assert len(invs) >= 2
        ids = [i.investigation_id for i in invs]
        assert inv1_id in ids
        assert inv2_id in ids
    finally:
        db.close()


@pytest.mark.asyncio
async def test_03_previous_investigation_is_not_overwritten():
    """Verify prior investigation runs remain immutable when a new investigation runs."""
    case_id = "TEST-HIST-003"
    res1 = client.post(f"/api/investigations/{case_id}", json={})
    inv1_id = res1.json()["investigation_id"]

    db = SessionLocal()
    try:
        inv1_before = db.query(InvestigationModel).filter(InvestigationModel.investigation_id == inv1_id).first()
        created_at_before = inv1_before.created_at
    finally:
        db.close()

    res2 = client.post(f"/api/investigations/{case_id}", json={})
    assert res2.status_code == 200

    db = SessionLocal()
    try:
        inv1_after = db.query(InvestigationModel).filter(InvestigationModel.investigation_id == inv1_id).first()
        assert inv1_after.investigation_id == inv1_id
        assert inv1_after.created_at == created_at_before
    finally:
        db.close()


@pytest.mark.asyncio
async def test_04_evidence_snapshot_is_persisted():
    """Verify evidence snapshot items are stored in investigation_evidence table."""
    case_id = "HHG-003"
    res = client.post(f"/api/investigations/{case_id}", json={})
    inv_id = res.json()["investigation_id"]

    db = SessionLocal()
    try:
        evs = db.query(InvestigationEvidenceModel).filter(InvestigationEvidenceModel.investigation_id == inv_id).all()
        assert len(evs) > 0
        types = [e.evidence_type for e in evs]
        assert "Transaction" in types or "Customer" in types
    finally:
        db.close()


@pytest.mark.asyncio
async def test_05_actions_are_persisted():
    """Verify initial and final actions are stored in investigation_actions table."""
    case_id = "HHG-003"
    res = client.post(f"/api/investigations/{case_id}", json={})
    inv_id = res.json()["investigation_id"]

    db = SessionLocal()
    try:
        actions = db.query(InvestigationActionModel).filter(InvestigationActionModel.investigation_id == inv_id).all()
        assert len(actions) > 0
        phases = [a.phase for a in actions]
        assert "INITIAL" in phases
        assert "FINAL" in phases
    finally:
        db.close()


@pytest.mark.asyncio
async def test_06_r1_r10_evaluations_are_persisted():
    """Verify rule evaluations (R1-R10) are stored in investigation_rules table."""
    case_id = "HHG-003"
    res = client.post(f"/api/investigations/{case_id}", json={})
    inv_id = res.json()["investigation_id"]

    db = SessionLocal()
    try:
        rules = db.query(InvestigationRuleModel).filter(InvestigationRuleModel.investigation_id == inv_id).all()
        assert len(rules) >= 10
        rule_ids = [r.rule_id for r in rules]
        for r_code in ("R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9", "R10"):
            assert r_code in rule_ids
    finally:
        db.close()


@pytest.mark.asyncio
async def test_07_audit_events_are_created():
    """Verify workflow steps generate chronological audit log events in audit_events table."""
    case_id = "TEST-AUDIT-007"
    res = client.post(f"/api/investigations/{case_id}", json={})
    inv_id = res.json()["investigation_id"]

    db = SessionLocal()
    try:
        events = db.query(AuditEventModel).filter(AuditEventModel.case_id == case_id).all()
        assert len(events) >= 5
        event_types = [e.event_type for e in events]
        assert "INVESTIGATION_STARTED" in event_types
        assert "EVIDENCE_COLLECTED" in event_types
        assert "LLM_REASONING_COMPLETED" in event_types
        assert "POLICY_EVALUATED" in event_types
        assert "DECISION_GENERATED" in event_types
        assert "INVESTIGATION_COMPLETED" in event_types
    finally:
        db.close()


@pytest.mark.asyncio
async def test_08_history_endpoint_returns_newest_first():
    """Verify GET /api/cases/{case_id}/investigations returns history runs ordered newest first."""
    case_id = "TEST-HIST-ORDER"
    client.post(f"/api/investigations/{case_id}", json={})
    client.post(f"/api/investigations/{case_id}", json={})

    res = client.get(f"/api/cases/{case_id}/investigations")
    assert res.status_code == 200
    data = res.json()
    assert "investigations" in data
    invs = data["investigations"]
    assert len(invs) >= 2
    # Verify newest first (created_at desc)
    t1 = invs[0]["created_at"]
    t2 = invs[1]["created_at"]
    assert t1 >= t2


@pytest.mark.asyncio
async def test_09_investigation_detail_endpoint_returns_historical_snapshot():
    """Verify GET /api/investigations/{investigation_id} returns complete historical detail snapshot."""
    case_id = "HHG-003"
    post_res = client.post(f"/api/investigations/{case_id}", json={})
    inv_id = post_res.json()["investigation_id"]

    get_res = client.get(f"/api/investigations/{inv_id}")
    assert get_res.status_code == 200
    detail = get_res.json()
    assert detail["investigation_id"] == inv_id
    assert detail["case_id"] == case_id
    assert "evidence" in detail
    assert "actions_final" in detail
    assert "rules" in detail
    assert "audit_events" in detail


@pytest.mark.asyncio
async def test_10_11_detail_endpoint_does_not_call_tigergraph_or_groq():
    """Verify GET /api/investigations/{investigation_id} does NOT call TigerGraph or Groq."""
    case_id = "HHG-003"
    post_res = client.post(f"/api/investigations/{case_id}", json={})
    inv_id = post_res.json()["investigation_id"]

    with patch("app.services.tigergraph.tigergraph_service.fetch_case_subgraph") as mock_tg, \
         patch("app.agent.reasoning.analyze_investigation_context") as mock_groq:
        get_res = client.get(f"/api/investigations/{inv_id}")
        assert get_res.status_code == 200
        assert mock_tg.call_count == 0
        assert mock_groq.call_count == 0


@pytest.mark.asyncio
async def test_12_hhg003_investigation_history_works():
    """Verify HHG-003 investigation history records and detail retrieval work."""
    res1 = client.post("/api/investigations/HHG-003", json={})
    inv1_id = res1.json()["investigation_id"]

    res2 = client.post("/api/investigations/HHG-003", json={})
    inv2_id = res2.json()["investigation_id"]

    hist_res = client.get("/api/cases/HHG-003/investigations")
    assert hist_res.status_code == 200
    invs = hist_res.json()["investigations"]
    ids = [i["investigation_id"] for i in invs]
    assert inv1_id in ids
    assert inv2_id in ids


@pytest.mark.asyncio
async def test_13_hhg001_investigation_history_works():
    """Verify HHG-001 investigation history works case-agnostically."""
    res = client.post("/api/investigations/HHG-001", json={})
    assert res.status_code == 200
    inv_id = res.json()["investigation_id"]

    hist_res = client.get("/api/cases/HHG-001/investigations")
    assert hist_res.status_code == 200
    invs = hist_res.json()["investigations"]
    assert any(i["investigation_id"] == inv_id for i in invs)


@pytest.mark.asyncio
async def test_14_no_credentials_appear_in_stored_audit_data():
    """Verify secrets/credentials do not leak into stored audit events."""
    case_id = "HHG-003"
    client.post(f"/api/investigations/{case_id}", json={})

    db = SessionLocal()
    try:
        events = db.query(AuditEventModel).filter(AuditEventModel.case_id == case_id).all()
        for e in events:
            text_meta = e.metadata_json or ""
            assert "GROQ_API_KEY" not in text_meta
            assert "TIGERGRAPH_SECRET" not in text_meta
            assert "gsk_" not in text_meta
            assert "Authorization" not in text_meta
    finally:
        db.close()


@pytest.mark.asyncio
async def test_15_fraud_probability_remains_null():
    """Verify risk score is NOT stored as fraud_probability in historical investigation model."""
    case_id = "HHG-003"
    res = client.post(f"/api/investigations/{case_id}", json={})
    inv_id = res.json()["investigation_id"]

    db = SessionLocal()
    try:
        inv = db.query(InvestigationModel).filter(InvestigationModel.investigation_id == inv_id).first()
        assert inv.fraud_probability is None
    finally:
        db.close()
