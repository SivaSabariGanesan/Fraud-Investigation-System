"""
Evidence Request Lifecycle Tests
=================================
Tests cover:
  1.  Create evidence request → PENDING
  2.  List evidence requests for a case
  3.  Get single evidence request by case + request ID
  4.  Respond to PENDING request → RESPONDED
  5.  Cancel PENDING request → CANCELLED
  6.  Cannot respond to RESPONDED request (409)
  7.  Cannot cancel RESPONDED request (409)
  8.  Cannot respond to CANCELLED request (409)
  9.  Cannot cancel CANCELLED request (409)
  10. Response creates a NEW investigation (immutably)
  11. OLD investigation remains unchanged after response
  12. Audit event created on create
  13. Audit event created on response
  14. Audit event created on cancellation
  15. HHG-003 / ER-HHG-003-001 remains PENDING — not modified
  16. No customer response is fabricated for HHG-003
  17. R1-R10 deterministic policy engine still active (validated via policy evaluation rule persistence)

All TigerGraph and Groq calls are mocked so these tests are fully offline and
deterministic. Existing test fixtures remain unaffected.
"""

import pytest
import asyncio
from unittest.mock import patch, AsyncMock, MagicMock
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.services.database import SessionLocal, engine, Base
from app.models.investigation import (
    CaseModel,
    EvidenceRequestModel,
    InvestigationModel,
    InvestigationRuleModel,
    AuditEventModel,
)

client = TestClient(app)

# ---------------------------------------------------------------------------
# Shared mock helpers
# ---------------------------------------------------------------------------

def _mock_investigation_result(case_id: str = "TEST-ER-CASE"):
    """
    Builds a minimal InvestigationResult-like mock that satisfies
    persist_investigation_run() and the investigations API endpoint.
    """
    from app.agent.schemas import InvestigationResult, EvidenceItem, EvidenceRequestResult
    from datetime import datetime

    return InvestigationResult(
        investigation_id=None,  # set by the caller
        case_id=case_id,
        customer_id="CUST-TEST",
        case_status="UNDER_INVESTIGATION",
        status="VERIFICATION_PENDING",
        verdict="NEEDS_REVIEW",
        fraud_probability=None,
        pattern="Test Pattern",
        evidence=[],
        affected_transaction_ids=[],
        connected_card_ids=[],
        connected_device_ids=[],
        exposure=0.0,
        similar_prior_cases=[],
        written_to_graph=False,
        evidence_requests=[],
        next_best_actions_initial=["MONITOR"],
        next_best_actions_final=["AWAIT_CUSTOMER_RESPONSE"],
        rules_evaluated=[
            {"rule_id": f"R{i}", "rule_name": f"RULE_{i}", "triggered": i == 2, "description": "test"}
            for i in range(1, 11)
        ],
        SAR={"status": "NOT_RECOMMENDED", "reason": "Pending verification"},
        stop_reason="PENDING_EVIDENCE_RESPONSE",
        tokens={"prompt": 10, "completion": 5, "total": 15},
        latency=0.1,
        reasoning_summary="Test investigation summary.",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )


# Patch target strings
TG_PATCH = "app.services.tigergraph.tigergraph_service.fetch_case_subgraph"
AGENT_PATCH = "app.agent.investigator.investigator_agent.investigate"


def _tg_empty_subgraph(case_id: str = "TEST-ER-CASE"):
    """Minimal empty subgraph result for TigerGraph mock."""
    return {
        "case_id": case_id,
        "entities": {
            "Customer": [],
            "Card": [],
            "Transaction": [],
            "DeviceProfile": [],
            "BillingRegion": [],
            "EmailDomain": [],
            "ClosedCase": [{"id": case_id, "case_id": case_id, "status": "OPEN"}],
            "EvidenceRequest": [],
        },
        "relationships": [],
    }


@pytest.fixture(autouse=True)
def ensure_tables():
    """Ensure all tables exist before every test."""
    Base.metadata.create_all(bind=engine)
    yield


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _create_test_case(case_id: str) -> CaseModel:
    db = SessionLocal()
    try:
        existing = db.query(CaseModel).filter(CaseModel.case_id == case_id).first()
        if existing:
            return existing
        from datetime import datetime
        case = CaseModel(
            case_id=case_id,
            status="PENDING",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(case)
        db.commit()
        db.refresh(case)
        return case
    finally:
        db.close()


def _create_pending_request(case_id: str, req_text: str = "Please confirm this transaction.") -> dict:
    """POST /api/evidence-requests/{case_id} and return the response JSON."""
    _create_test_case(case_id)
    res = client.post(
        f"/api/evidence-requests/{case_id}",
        json={"request_type": "customer_verification", "request_text": req_text},
    )
    assert res.status_code == 201, f"Unexpected status {res.status_code}: {res.text}"
    return res.json()


# ===========================================================================
# 1. Create evidence request → PENDING
# ===========================================================================

def test_01_create_evidence_request_returns_pending():
    case_id = "TEST-ER-01"
    data = _create_pending_request(case_id, "Please verify transaction 99999.")
    assert data["status"] == "PENDING"
    assert data["case_id"] == case_id
    assert data["request_type"] == "customer_verification"
    assert data["request_text"] == "Please verify transaction 99999."
    assert data["request_id"].startswith("ER-")
    assert data["response"] is None
    assert data["responded_at"] is None
    assert data["cancelled_at"] is None


# ===========================================================================
# 2. List evidence requests for a case
# ===========================================================================

def test_02_list_evidence_requests():
    case_id = "TEST-ER-02"
    _create_pending_request(case_id, "First verification request.")
    _create_pending_request(case_id, "Second verification request.")

    res = client.get(f"/api/evidence-requests/{case_id}")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 2
    texts = [r["request_text"] for r in data]
    assert "First verification request." in texts
    assert "Second verification request." in texts


# ===========================================================================
# 3. Get single evidence request by case + request ID
# ===========================================================================

def test_03_get_single_evidence_request():
    case_id = "TEST-ER-03"
    created = _create_pending_request(case_id, "Get single request test.")
    req_id = created["request_id"]

    res = client.get(f"/api/evidence-requests/{case_id}/{req_id}")
    assert res.status_code == 200
    data = res.json()
    assert data["request_id"] == req_id
    assert data["case_id"] == case_id
    assert data["status"] == "PENDING"


def test_03b_get_nonexistent_request_returns_404():
    res = client.get("/api/evidence-requests/ANY-CASE/ER-NONEXISTENT-000")
    assert res.status_code == 404


# ===========================================================================
# 4. Respond to PENDING request → RESPONDED
# ===========================================================================

@pytest.mark.asyncio
async def test_04_respond_to_pending_request():
    case_id = "TEST-ER-04"
    created = _create_pending_request(case_id, "Do you recognise this transaction?")
    req_id = created["request_id"]

    mock_result = _mock_investigation_result(case_id)

    with patch(AGENT_PATCH, new=AsyncMock(return_value=mock_result)), \
         patch(TG_PATCH, new=AsyncMock(return_value=_tg_empty_subgraph(case_id))):
        res = client.post(
            f"/api/evidence-requests/{req_id}/respond",
            json={"response": "Yes, I authorised this transaction.", "response_source": "CUSTOMER"},
        )

    assert res.status_code == 200
    data = res.json()
    er = data["evidence_request"]
    assert er["status"] == "RESPONDED"
    assert er["response"] == "Yes, I authorised this transaction."
    assert er["response_source"] == "CUSTOMER"
    assert er["responded_at"] is not None


# ===========================================================================
# 5. Cancel PENDING request → CANCELLED
# ===========================================================================

def test_05_cancel_pending_request():
    case_id = "TEST-ER-05"
    created = _create_pending_request(case_id, "Please confirm your identity.")
    req_id = created["request_id"]

    res = client.post(
        f"/api/evidence-requests/{req_id}/cancel",
        json={"cancelled_reason": "Customer unreachable after 7 days."},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "CANCELLED"
    assert data["cancelled_at"] is not None
    assert data["cancelled_reason"] == "Customer unreachable after 7 days."


# ===========================================================================
# 6. Cannot respond to RESPONDED request → 409
# ===========================================================================

@pytest.mark.asyncio
async def test_06_cannot_respond_to_already_responded():
    case_id = "TEST-ER-06"
    created = _create_pending_request(case_id, "First respond attempt.")
    req_id = created["request_id"]

    mock_result = _mock_investigation_result(case_id)

    # First response — should succeed
    with patch(AGENT_PATCH, new=AsyncMock(return_value=mock_result)), \
         patch(TG_PATCH, new=AsyncMock(return_value=_tg_empty_subgraph(case_id))):
        r1 = client.post(
            f"/api/evidence-requests/{req_id}/respond",
            json={"response": "Yes, confirmed.", "response_source": "CUSTOMER"},
        )
    assert r1.status_code == 200

    # Second response — must be rejected with 409
    r2 = client.post(
        f"/api/evidence-requests/{req_id}/respond",
        json={"response": "Another response attempt.", "response_source": "CUSTOMER"},
    )
    assert r2.status_code == 409
    assert "RESPONDED" in r2.json()["detail"] or "transition" in r2.json()["detail"].lower()


# ===========================================================================
# 7. Cannot cancel RESPONDED request → 409
# ===========================================================================

@pytest.mark.asyncio
async def test_07_cannot_cancel_responded_request():
    case_id = "TEST-ER-07"
    created = _create_pending_request(case_id, "Respond then try to cancel.")
    req_id = created["request_id"]

    mock_result = _mock_investigation_result(case_id)

    with patch(AGENT_PATCH, new=AsyncMock(return_value=mock_result)), \
         patch(TG_PATCH, new=AsyncMock(return_value=_tg_empty_subgraph(case_id))):
        client.post(
            f"/api/evidence-requests/{req_id}/respond",
            json={"response": "Confirmed.", "response_source": "CUSTOMER"},
        )

    r = client.post(
        f"/api/evidence-requests/{req_id}/cancel",
        json={"cancelled_reason": "Should not work."},
    )
    assert r.status_code == 409


# ===========================================================================
# 8. Cannot respond to CANCELLED request → 409
# ===========================================================================

def test_08_cannot_respond_to_cancelled_request():
    case_id = "TEST-ER-08"
    created = _create_pending_request(case_id, "Cancel then try to respond.")
    req_id = created["request_id"]

    client.post(f"/api/evidence-requests/{req_id}/cancel", json={})

    r = client.post(
        f"/api/evidence-requests/{req_id}/respond",
        json={"response": "Attempted response.", "response_source": "CUSTOMER"},
    )
    assert r.status_code == 409


# ===========================================================================
# 9. Cannot cancel CANCELLED request → 409
# ===========================================================================

def test_09_cannot_cancel_already_cancelled():
    case_id = "TEST-ER-09"
    created = _create_pending_request(case_id, "Double cancel test.")
    req_id = created["request_id"]

    r1 = client.post(f"/api/evidence-requests/{req_id}/cancel", json={})
    assert r1.status_code == 200

    r2 = client.post(f"/api/evidence-requests/{req_id}/cancel", json={})
    assert r2.status_code == 409


# ===========================================================================
# 10. Response creates a NEW investigation (immutably)
# ===========================================================================

@pytest.mark.asyncio
async def test_10_response_triggers_new_investigation():
    case_id = "TEST-ER-10"
    created = _create_pending_request(case_id, "Verify this charge please.")
    req_id = created["request_id"]

    # Record pre-existing investigation count
    db = SessionLocal()
    try:
        inv_count_before = db.query(InvestigationModel).filter(
            InvestigationModel.case_id == case_id
        ).count()
    finally:
        db.close()

    mock_result = _mock_investigation_result(case_id)

    with patch(AGENT_PATCH, new=AsyncMock(return_value=mock_result)), \
         patch(TG_PATCH, new=AsyncMock(return_value=_tg_empty_subgraph(case_id))):
        res = client.post(
            f"/api/evidence-requests/{req_id}/respond",
            json={"response": "I did not authorise this.", "response_source": "CUSTOMER"},
        )

    assert res.status_code == 200
    data = res.json()
    assert data["investigation_triggered"] is True
    assert data["new_investigation_id"] is not None
    assert data["new_investigation_id"].startswith("INV-")
    assert data["investigation_error"] is None

    db = SessionLocal()
    try:
        inv_count_after = db.query(InvestigationModel).filter(
            InvestigationModel.case_id == case_id
        ).count()
        assert inv_count_after == inv_count_before + 1
        new_inv = db.query(InvestigationModel).filter(
            InvestigationModel.investigation_id == data["new_investigation_id"]
        ).first()
        assert new_inv is not None
        assert new_inv.case_id == case_id
    finally:
        db.close()


# ===========================================================================
# 11. OLD investigation remains unchanged after response
# ===========================================================================

@pytest.mark.asyncio
async def test_11_old_investigation_remains_immutable():
    case_id = "TEST-ER-11"
    _create_test_case(case_id)

    mock_result = _mock_investigation_result(case_id)

    # Run first investigation manually via API
    with patch(AGENT_PATCH, new=AsyncMock(return_value=mock_result)), \
         patch(TG_PATCH, new=AsyncMock(return_value=_tg_empty_subgraph(case_id))):
        inv1_res = client.post(f"/api/investigations/{case_id}", json={})
    assert inv1_res.status_code == 200
    inv1_id = inv1_res.json()["investigation_id"]

    # Record original fields
    db = SessionLocal()
    try:
        inv1_before = db.query(InvestigationModel).filter(
            InvestigationModel.investigation_id == inv1_id
        ).first()
        assert inv1_before is not None
        created_at_before = inv1_before.created_at
        verdict_before = inv1_before.verdict
        status_before = inv1_before.status
    finally:
        db.close()

    # Now create an evidence request and respond to it
    created_er = _create_pending_request(case_id, "Immutability test request.")
    req_id = created_er["request_id"]

    mock_result2 = _mock_investigation_result(case_id)

    with patch(AGENT_PATCH, new=AsyncMock(return_value=mock_result2)), \
         patch(TG_PATCH, new=AsyncMock(return_value=_tg_empty_subgraph(case_id))):
        resp_res = client.post(
            f"/api/evidence-requests/{req_id}/respond",
            json={"response": "Customer confirms the transaction.", "response_source": "CUSTOMER"},
        )
    assert resp_res.status_code == 200

    # Verify INV-1 is completely unchanged
    db = SessionLocal()
    try:
        inv1_after = db.query(InvestigationModel).filter(
            InvestigationModel.investigation_id == inv1_id
        ).first()
        assert inv1_after is not None
        assert inv1_after.investigation_id == inv1_id
        assert inv1_after.created_at == created_at_before
        assert inv1_after.verdict == verdict_before
        assert inv1_after.status == status_before
    finally:
        db.close()


# ===========================================================================
# 12. Audit event created on create
# ===========================================================================

def test_12_audit_event_on_create():
    case_id = "TEST-ER-12"
    created = _create_pending_request(case_id, "Audit event create test.")
    req_id = created["request_id"]

    db = SessionLocal()
    try:
        events = db.query(AuditEventModel).filter(
            AuditEventModel.case_id == case_id,
            AuditEventModel.event_type == "EVIDENCE_REQUEST_CREATED",
        ).all()
        assert len(events) >= 1
        descriptions = [e.description for e in events]
        assert any(req_id in d for d in descriptions)
    finally:
        db.close()


# ===========================================================================
# 13. Audit event created on response
# ===========================================================================

@pytest.mark.asyncio
async def test_13_audit_event_on_response():
    case_id = "TEST-ER-13"
    created = _create_pending_request(case_id, "Audit event response test.")
    req_id = created["request_id"]

    mock_result = _mock_investigation_result(case_id)

    with patch(AGENT_PATCH, new=AsyncMock(return_value=mock_result)), \
         patch(TG_PATCH, new=AsyncMock(return_value=_tg_empty_subgraph(case_id))):
        client.post(
            f"/api/evidence-requests/{req_id}/respond",
            json={"response": "Confirmed transaction.", "response_source": "CUSTOMER"},
        )

    db = SessionLocal()
    try:
        events = db.query(AuditEventModel).filter(
            AuditEventModel.case_id == case_id,
            AuditEventModel.event_type == "EVIDENCE_REQUEST_RESPONDED",
        ).all()
        assert len(events) >= 1
        descriptions = [e.description for e in events]
        assert any(req_id in d for d in descriptions)
    finally:
        db.close()


# ===========================================================================
# 14. Audit event created on cancellation
# ===========================================================================

def test_14_audit_event_on_cancellation():
    case_id = "TEST-ER-14"
    created = _create_pending_request(case_id, "Audit event cancel test.")
    req_id = created["request_id"]

    client.post(f"/api/evidence-requests/{req_id}/cancel", json={"cancelled_reason": "Test cancellation."})

    db = SessionLocal()
    try:
        events = db.query(AuditEventModel).filter(
            AuditEventModel.case_id == case_id,
            AuditEventModel.event_type == "EVIDENCE_REQUEST_CANCELLED",
        ).all()
        assert len(events) >= 1
        descriptions = [e.description for e in events]
        assert any(req_id in d for d in descriptions)
    finally:
        db.close()


# ===========================================================================
# 15. HHG-003 / ER-HHG-003-001 remains PENDING — never modified by GET/list
# ===========================================================================

def test_15_hhg003_er_remains_pending_after_list():
    """
    Listing or fetching evidence requests for HHG-003 must NOT change
    ER-HHG-003-001 to any other status.
    If the row exists in SQLite it must be PENDING.
    If it does not exist yet (not yet investigated), the list returns empty — fine.
    """
    # GET list must not error
    res = client.get("/api/evidence-requests/HHG-003")
    assert res.status_code == 200
    requests_list = res.json()

    for er in requests_list:
        if er["request_id"] == "ER-HHG-003-001":
            # Must still be PENDING — never auto-responded
            assert er["status"] == "PENDING", (
                f"ER-HHG-003-001 was modified to '{er['status']}' — this is forbidden!"
            )
            assert er["response"] is None, "ER-HHG-003-001 must have no response."
            assert er["responded_at"] is None, "ER-HHG-003-001 must have no responded_at."


def test_15b_hhg003_case_er_status_unchanged_in_db():
    """
    If ER-HHG-003-001 exists in SQLite it must be PENDING with no response.
    """
    db = SessionLocal()
    try:
        er = db.query(EvidenceRequestModel).filter(
            EvidenceRequestModel.request_id == "ER-HHG-003-001"
        ).first()
        if er is not None:
            assert er.status == "PENDING", (
                f"ER-HHG-003-001 has status '{er.status}' in DB — must be PENDING!"
            )
            assert er.response is None, "ER-HHG-003-001 must have no response in DB."
    finally:
        db.close()


# ===========================================================================
# 16. No customer response is fabricated for HHG-003
# ===========================================================================

def test_16_no_fabricated_response_for_hhg003():
    """
    The respond endpoint must require an explicit payload.
    An empty response body must be rejected with 422.
    """
    # Empty response text → schema validation error
    r = client.post(
        "/api/evidence-requests/ER-HHG-003-001/respond",
        json={"response": "", "response_source": "CUSTOMER"},
    )
    assert r.status_code == 422, (
        f"Empty response should be rejected with 422, got {r.status_code}"
    )

    # Whitespace-only → API-level guard rejects with 422
    r2 = client.post(
        "/api/evidence-requests/ER-HHG-003-001/respond",
        json={"response": "   ", "response_source": "CUSTOMER"},
    )
    assert r2.status_code == 422


def test_16b_no_respond_without_body():
    """POST /respond without a body must fail gracefully."""
    r = client.post("/api/evidence-requests/ER-HHG-003-001/respond")
    assert r.status_code in (422, 400)


# ===========================================================================
# 17. R1–R10 policy rules still persist after respond-triggered investigation
# ===========================================================================

@pytest.mark.asyncio
async def test_17_r1_r10_rules_persisted_in_new_investigation():
    """
    When a response triggers a new investigation, R1–R10 rules must be evaluated
    and stored in the investigation_rules table for the new investigation.
    """
    case_id = "TEST-ER-17"
    created = _create_pending_request(case_id, "Policy engine test request.")
    req_id = created["request_id"]

    mock_result = _mock_investigation_result(case_id)
    # The mock result already has rules_evaluated with R1-R10

    with patch(AGENT_PATCH, new=AsyncMock(return_value=mock_result)), \
         patch(TG_PATCH, new=AsyncMock(return_value=_tg_empty_subgraph(case_id))):
        res = client.post(
            f"/api/evidence-requests/{req_id}/respond",
            json={"response": "Confirmed, this is my transaction.", "response_source": "CUSTOMER"},
        )

    assert res.status_code == 200
    data = res.json()
    new_inv_id = data.get("new_investigation_id")
    assert new_inv_id is not None

    db = SessionLocal()
    try:
        rules = db.query(InvestigationRuleModel).filter(
            InvestigationRuleModel.investigation_id == new_inv_id
        ).all()
        assert len(rules) == 10, f"Expected 10 R1-R10 rules, got {len(rules)}"
        rule_ids = {r.rule_id for r in rules}
        for expected in (f"R{i}" for i in range(1, 11)):
            assert expected in rule_ids, f"Rule {expected} missing from new investigation"
    finally:
        db.close()


# ===========================================================================
# Additional guard: empty request_text is rejected
# ===========================================================================

def test_empty_request_text_rejected():
    case_id = "TEST-ER-EMPTY"
    _create_test_case(case_id)
    r = client.post(
        f"/api/evidence-requests/{case_id}",
        json={"request_type": "customer_verification", "request_text": "ab"},
    )
    # min_length=5 enforced by schema
    assert r.status_code == 422


# ===========================================================================
# Additional guard: get request under wrong case returns 404
# ===========================================================================

def test_get_request_wrong_case_returns_404():
    case_id_a = "TEST-ER-WRONGCASE-A"
    case_id_b = "TEST-ER-WRONGCASE-B"
    created = _create_pending_request(case_id_a, "Request for case A test.")
    req_id = created["request_id"]

    r = client.get(f"/api/evidence-requests/{case_id_b}/{req_id}")
    assert r.status_code == 404


# ===========================================================================
# Credentials must not appear in audit metadata (same pattern as existing test 14)
# ===========================================================================

@pytest.mark.asyncio
async def test_no_credentials_in_evidence_request_audit():
    case_id = "TEST-ER-CREDS"
    created = _create_pending_request(case_id, "Credential safety test request.")
    req_id = created["request_id"]

    mock_result = _mock_investigation_result(case_id)

    with patch(AGENT_PATCH, new=AsyncMock(return_value=mock_result)), \
         patch(TG_PATCH, new=AsyncMock(return_value=_tg_empty_subgraph(case_id))):
        client.post(
            f"/api/evidence-requests/{req_id}/respond",
            json={"response": "Confirmed.", "response_source": "CUSTOMER"},
        )

    db = SessionLocal()
    try:
        events = db.query(AuditEventModel).filter(
            AuditEventModel.case_id == case_id
        ).all()
        for e in events:
            text = (e.metadata_json or "") + (e.description or "")
            assert "GROQ_API_KEY" not in text
            assert "TIGERGRAPH_SECRET" not in text
            assert "gsk_" not in text
            assert "Authorization" not in text
    finally:
        db.close()
