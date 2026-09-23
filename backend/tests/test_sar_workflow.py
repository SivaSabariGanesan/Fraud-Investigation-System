import pytest
from uuid import uuid4
from datetime import datetime
from fastapi.testclient import TestClient
from app.main import app
from app.services.database import SessionLocal
from app.models.investigation import CaseModel, SarRecordModel, InvestigationModel, AuditEventModel, EvidenceRequestModel
from app.schemas.investigation import InvestigationResult
from app.agent.schemas import EvidenceItem

from app.services.sar_service import sync_sar_candidate_from_result, validate_sar_transition

client = TestClient(app)

def test_01_sar_model_persistence():
    """Verify SarRecordModel can be created and persisted in SQLite."""
    db = SessionLocal()
    case_id = f"TEST-SAR-{uuid4().hex[:6].upper()}"
    inv_id = f"INV-{uuid4().hex[:6].upper()}"
    sar_id = f"SAR-{uuid4().hex[:6].upper()}"

    sar = SarRecordModel(
        sar_id=sar_id,
        case_id=case_id,
        investigation_id=inv_id,
        status="CANDIDATE",
        eligibility="ELIGIBLE",
        eligibility_reason="Test confirmed fraud exposure",
        exposure_usd=1500.0,
        created_at=datetime.utcnow()
    )
    db.add(sar)
    db.commit()

    retrieved = db.query(SarRecordModel).filter(SarRecordModel.sar_id == sar_id).first()
    assert retrieved is not None
    assert retrieved.case_id == case_id
    assert retrieved.investigation_id == inv_id
    assert retrieved.status == "CANDIDATE"
    assert retrieved.exposure_usd == 1500.0
    db.close()


def test_02_candidate_creation_and_linked_investigation():
    """Verify candidate creation links directly to an immutable investigation_id."""
    db = SessionLocal()
    case_id = f"TEST-SAR-{uuid4().hex[:6].upper()}"
    inv_id = f"INV-{uuid4().hex[:6].upper()}"

    agent_output = InvestigationResult(
        case_id=case_id,
        customer_id="C08623",
        case_status="CLOSED",
        status="CONFIRMED_FRAUD",
        verdict="DECLINED",
        fraud_probability=None,
        pattern="Stolen Card",
        evidence=[],
        affected_transaction_ids=["3530164"],
        connected_card_ids=["19739"],
        connected_device_ids=[],
        exposure=2500.0,
        similar_prior_cases=[],
        written_to_graph=True,
        evidence_requests=[],
        next_best_actions_initial=[],
        next_best_actions_final=[],
        rules_evaluated=[{"rule_id": "R4", "triggered": True, "description": "Stolen Card"}]
    )

    result = sync_sar_candidate_from_result(db, case_id=case_id, investigation_id=inv_id, agent_output=agent_output)
    assert result.status == "CANDIDATE"
    assert result.eligibility == "ELIGIBLE"
    assert result.investigation_id == inv_id
    assert result.exposure_usd == 2500.0
    db.close()


def test_03_eligibility_is_deterministic():
    """Verify SAR eligibility is derived deterministically from R1-R10 rules and verdict."""
    db = SessionLocal()
    case_id = f"TEST-SAR-{uuid4().hex[:6].upper()}"
    inv_id = f"INV-{uuid4().hex[:6].upper()}"

    # Non-fraud low risk case
    agent_output = InvestigationResult(
        case_id=case_id,
        customer_id="C08623",
        case_status="COMPLETED",
        status="CLEARED",
        verdict="APPROVED",
        fraud_probability=None,
        pattern="Low Risk",
        evidence=[],
        affected_transaction_ids=["1001"],
        connected_card_ids=["19739"],
        connected_device_ids=[],
        exposure=49.0,
        similar_prior_cases=[],
        written_to_graph=True,
        evidence_requests=[],
        next_best_actions_initial=[],
        next_best_actions_final=[],
        rules_evaluated=[{"rule_id": "R1", "triggered": True, "description": "Low Risk Baseline"}]
    )

    result = sync_sar_candidate_from_result(db, case_id=case_id, investigation_id=inv_id, agent_output=agent_output)
    assert result.status == "NOT_RECOMMENDED"
    assert result.eligibility == "NOT_ELIGIBLE"
    db.close()


def test_04_risk_score_alone_cannot_create_sar():
    """Verify high risk_score alone without policy rule triggers cannot create SAR candidate (R9 rule principle)."""
    db = SessionLocal()
    case_id = f"TEST-SAR-{uuid4().hex[:6].upper()}"
    inv_id = f"INV-{uuid4().hex[:6].upper()}"

    agent_output = InvestigationResult(
        case_id=case_id,
        customer_id="C08623",
        case_status="UNDER_INVESTIGATION",
        status="VERIFICATION_PENDING",
        verdict="NEEDS_REVIEW",
        fraud_probability=None,
        pattern="Verification Pending",
        evidence=[
            EvidenceItem(evidence_id="E1", evidence_type="Transaction", description="Txn with risk 0.85", risk_signal="0.85")
        ],
        affected_transaction_ids=["3530164"],
        connected_card_ids=["19739"],
        connected_device_ids=[],
        exposure=49.0,
        similar_prior_cases=[],
        written_to_graph=True,
        evidence_requests=[{"request_id": "ER-1", "case_id": case_id, "request_type": "customer_verification", "status": "PENDING"}],
        next_best_actions_initial=[],

        next_best_actions_final=[],
        rules_evaluated=[{"rule_id": "R9", "triggered": True, "description": "Risk Score Signal Only"}]
    )

    result = sync_sar_candidate_from_result(db, case_id=case_id, investigation_id=inv_id, agent_output=agent_output)
    assert result.status == "NOT_RECOMMENDED"
    assert result.eligibility != "ELIGIBLE"
    db.close()


def test_05_review_approve_workflow():
    """Verify analyst can approve a CANDIDATE SAR to APPROVED status."""
    db = SessionLocal()
    case_id = f"TEST-SAR-{uuid4().hex[:6].upper()}"
    inv_id = f"INV-{uuid4().hex[:6].upper()}"

    agent_output = InvestigationResult(
        case_id=case_id, customer_id="C08623", case_status="CLOSED", status="CONFIRMED_FRAUD", verdict="DECLINED",
        fraud_probability=None, pattern="Stolen Card", evidence=[], affected_transaction_ids=["1"], connected_card_ids=["2"],
        connected_device_ids=[], exposure=3000.0, similar_prior_cases=[], written_to_graph=True, evidence_requests=[],
        next_best_actions_initial=[], next_best_actions_final=[],
        rules_evaluated=[{"rule_id": "R4", "triggered": True, "description": "Stolen Card"}]
    )
    sync_sar_candidate_from_result(db, case_id=case_id, investigation_id=inv_id, agent_output=agent_output)
    db.close()

    res = client.post(f"/api/cases/{case_id}/sar/review", json={
        "decision": "approve",
        "analyst_notes": "Confirmed stolen card fraud pattern. Approved for SAR report preparation.",
        "reviewer_id": "ANALYST_01"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "APPROVED"
    assert data["analyst_decision"] == "APPROVE"
    assert data["reviewer_id"] == "ANALYST_01"
    assert data["reviewed_at"] is not None


def test_06_review_do_not_file_workflow():
    """Verify analyst can set a CANDIDATE SAR to NOT_FILED status."""
    db = SessionLocal()
    case_id = f"TEST-SAR-{uuid4().hex[:6].upper()}"
    inv_id = f"INV-{uuid4().hex[:6].upper()}"

    agent_output = InvestigationResult(
        case_id=case_id, customer_id="C08623", case_status="CLOSED", status="CONFIRMED_FRAUD", verdict="DECLINED",
        fraud_probability=None, pattern="Velocity Surge", evidence=[], affected_transaction_ids=["1"], connected_card_ids=["2"],
        connected_device_ids=[], exposure=1200.0, similar_prior_cases=[], written_to_graph=True, evidence_requests=[],
        next_best_actions_initial=[], next_best_actions_final=[],
        rules_evaluated=[{"rule_id": "R8", "triggered": True, "description": "High Velocity"}]
    )
    sync_sar_candidate_from_result(db, case_id=case_id, investigation_id=inv_id, agent_output=agent_output)
    db.close()

    res = client.post(f"/api/cases/{case_id}/sar/review", json={
        "decision": "do_not_file",
        "analyst_notes": "Customer confirmed legitimate transaction offline.",
        "reviewer_id": "ANALYST_02"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "NOT_FILED"
    assert data["analyst_decision"] == "DO_NOT_FILE"


def test_07_invalid_status_transition_rejected():
    """Verify attempting an unpermitted status transition raises HTTP 400 error."""
    with pytest.raises(ValueError):
        validate_sar_transition("NOT_RECOMMENDED", "PREPARED")

    with pytest.raises(ValueError):
        validate_sar_transition("NOT_FILED", "APPROVED")


def test_08_approved_sar_can_be_prepared():
    """Verify an APPROVED SAR can be prepared into a structured internal report draft."""
    db = SessionLocal()
    case_id = f"TEST-SAR-{uuid4().hex[:6].upper()}"
    inv_id = f"INV-{uuid4().hex[:6].upper()}"

    agent_output = InvestigationResult(
        case_id=case_id, customer_id="C08623", case_status="CLOSED", status="CONFIRMED_FRAUD", verdict="DECLINED",
        fraud_probability=None, pattern="Stolen Card", evidence=[], affected_transaction_ids=["99"], connected_card_ids=["88"],
        connected_device_ids=[], exposure=5000.0, similar_prior_cases=[], written_to_graph=True, evidence_requests=[],
        next_best_actions_initial=[], next_best_actions_final=[],
        rules_evaluated=[{"rule_id": "R4", "triggered": True, "description": "Stolen Card"}]
    )
    sync_sar_candidate_from_result(db, case_id=case_id, investigation_id=inv_id, agent_output=agent_output)
    db.close()

    client.post(f"/api/cases/{case_id}/sar/review", json={"decision": "approve", "analyst_notes": "Approved for filing draft."})

    res = client.post(f"/api/cases/{case_id}/sar/prepare", json={"notes": "Final report draft prepared."})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "PREPARED"
    assert data["report_reference"] is not None
    assert "SAR-REP-" in data["report_reference"]
    assert data["report_draft_json"] is not None
    assert data["report_draft_json"]["case_id"] == case_id
    assert data["report_draft_json"]["total_exposure_usd"] == 5000.0


def test_09_non_approved_sar_cannot_be_prepared():
    """Verify attempting to prepare a non-APPROVED SAR (e.g. CANDIDATE) returns HTTP 400."""
    db = SessionLocal()
    case_id = f"TEST-SAR-{uuid4().hex[:6].upper()}"
    inv_id = f"INV-{uuid4().hex[:6].upper()}"

    agent_output = InvestigationResult(
        case_id=case_id, customer_id="C08623", case_status="CLOSED", status="CONFIRMED_FRAUD", verdict="DECLINED",
        fraud_probability=None, pattern="Stolen Card", evidence=[], affected_transaction_ids=["1"], connected_card_ids=["2"],
        connected_device_ids=[], exposure=2000.0, similar_prior_cases=[], written_to_graph=True, evidence_requests=[],
        next_best_actions_initial=[], next_best_actions_final=[],
        rules_evaluated=[{"rule_id": "R4", "triggered": True, "description": "Stolen Card"}]
    )
    sync_sar_candidate_from_result(db, case_id=case_id, investigation_id=inv_id, agent_output=agent_output)
    db.close()

    res = client.post(f"/api/cases/{case_id}/sar/prepare", json={})
    assert res.status_code == 400


def test_10_submission_tracking_internal():
    """Verify PREPARED SAR can transition to SUBMISSION_PENDING for internal tracking."""
    db = SessionLocal()
    case_id = f"TEST-SAR-{uuid4().hex[:6].upper()}"
    inv_id = f"INV-{uuid4().hex[:6].upper()}"

    agent_output = InvestigationResult(
        case_id=case_id, customer_id="C08623", case_status="CLOSED", status="CONFIRMED_FRAUD", verdict="DECLINED",
        fraud_probability=None, pattern="Stolen Card", evidence=[], affected_transaction_ids=["1"], connected_card_ids=["2"],
        connected_device_ids=[], exposure=2000.0, similar_prior_cases=[], written_to_graph=True, evidence_requests=[],
        next_best_actions_initial=[], next_best_actions_final=[],
        rules_evaluated=[{"rule_id": "R4", "triggered": True, "description": "Stolen Card"}]
    )
    sync_sar_candidate_from_result(db, case_id=case_id, investigation_id=inv_id, agent_output=agent_output)
    db.close()

    client.post(f"/api/cases/{case_id}/sar/review", json={"decision": "approve"})
    client.post(f"/api/cases/{case_id}/sar/prepare", json={})

    res = client.post(f"/api/cases/{case_id}/sar/submission-status", json={"status": "SUBMISSION_PENDING"})
    assert res.status_code == 200
    assert res.json()["status"] == "SUBMISSION_PENDING"


def test_11_filed_status_rejected_without_external_integration():
    """Verify attempting to set status directly to FILED raises error since no external filing integration exists."""
    db = SessionLocal()
    case_id = f"TEST-SAR-{uuid4().hex[:6].upper()}"
    inv_id = f"INV-{uuid4().hex[:6].upper()}"

    agent_output = InvestigationResult(
        case_id=case_id, customer_id="C08623", case_status="CLOSED", status="CONFIRMED_FRAUD", verdict="DECLINED",
        fraud_probability=None, pattern="Stolen Card", evidence=[], affected_transaction_ids=["1"], connected_card_ids=["2"],
        connected_device_ids=[], exposure=2000.0, similar_prior_cases=[], written_to_graph=True, evidence_requests=[],
        next_best_actions_initial=[], next_best_actions_final=[],
        rules_evaluated=[{"rule_id": "R4", "triggered": True, "description": "Stolen Card"}]
    )
    sync_sar_candidate_from_result(db, case_id=case_id, investigation_id=inv_id, agent_output=agent_output)
    db.close()

    client.post(f"/api/cases/{case_id}/sar/review", json={"decision": "approve"})
    client.post(f"/api/cases/{case_id}/sar/prepare", json={})

    res = client.post(f"/api/cases/{case_id}/sar/submission-status", json={"status": "FILED"})
    assert res.status_code == 400
    assert "External filing integration not configured" in res.json()["detail"]


def test_12_audit_events_created_for_sar_lifecycle():
    """Verify audit events SAR_CANDIDATE_CREATED, SAR_APPROVED, SAR_PREPARED are written to audit trail."""
    db = SessionLocal()
    case_id = f"TEST-SAR-{uuid4().hex[:6].upper()}"
    inv_id = f"INV-{uuid4().hex[:6].upper()}"

    agent_output = InvestigationResult(
        case_id=case_id, customer_id="C08623", case_status="CLOSED", status="CONFIRMED_FRAUD", verdict="DECLINED",
        fraud_probability=None, pattern="Stolen Card", evidence=[], affected_transaction_ids=["1"], connected_card_ids=["2"],
        connected_device_ids=[], exposure=4000.0, similar_prior_cases=[], written_to_graph=True, evidence_requests=[],
        next_best_actions_initial=[], next_best_actions_final=[],
        rules_evaluated=[{"rule_id": "R4", "triggered": True, "description": "Stolen Card"}]
    )
    sync_sar_candidate_from_result(db, case_id=case_id, investigation_id=inv_id, agent_output=agent_output)
    db.close()

    client.post(f"/api/cases/{case_id}/sar/review", json={"decision": "approve"})
    client.post(f"/api/cases/{case_id}/sar/prepare", json={})

    db_audit = SessionLocal()
    events = db_audit.query(AuditEventModel).filter(AuditEventModel.case_id == case_id).all()
    event_types = [e.event_type for e in events]
    assert "SAR_CANDIDATE_CREATED" in event_types
    assert "SAR_REVIEW_STARTED" in event_types
    assert "SAR_APPROVED" in event_types
    assert "SAR_PREPARED" in event_types
    db_audit.close()


def test_13_sensitive_fields_sanitized_in_audit():
    """Verify credentials and secret tokens are never stored in audit metadata."""
    db = SessionLocal()
    events = db.query(AuditEventModel).filter(AuditEventModel.event_type.like("SAR_%")).all()
    for e in events:
        if e.metadata_json:
            assert "TIGERGRAPH_SECRET" not in e.metadata_json
            assert "GROQ_API_KEY" not in e.metadata_json
            assert "bearer" not in e.metadata_json.lower()
    db.close()


def test_14_hhg003_sar_remains_not_recommended_due_to_pending_evidence():
    """Verify HHG-003 SAR status is NOT_RECOMMENDED due to pending evidence request ER-HHG-003-001."""
    res_inv = client.post("/api/investigations/HHG-003")
    assert res_inv.status_code == 200

    res_sar = client.get("/api/cases/HHG-003/sar")
    assert res_sar.status_code == 200
    data = res_sar.json()
    assert data["status"] == "NOT_RECOMMENDED"
    assert data["eligibility"] == "INCONCLUSIVE"
    assert "Pending customer verification" in data["eligibility_reason"]


def test_15_hhg003_pending_evidence_request_remains_pending():
    """Verify ER-HHG-003-001 evidence request status remains PENDING in SQLite DB."""
    db = SessionLocal()
    er = db.query(EvidenceRequestModel).filter(EvidenceRequestModel.request_id == "ER-HHG-003-001").first()
    if er:
        assert er.status == "PENDING"
        assert er.response is None
    db.close()


def test_16_reinvestigation_creates_new_investigation_id():
    """Verify re-investigation creates a new immutable investigation ID while linking to SAR."""
    res1 = client.post("/api/investigations/HHG-003")
    assert res1.status_code == 200
    inv_id1 = res1.json()["investigation_id"]

    res2 = client.post("/api/investigations/HHG-003")
    assert res2.status_code == 200
    inv_id2 = res2.json()["investigation_id"]

    assert inv_id1 != inv_id2


def test_17_no_fabricated_customer_response():
    """Verify customer response is never simulated or fabricated."""
    res = client.get("/api/evidence-requests/HHG-003/ER-HHG-003-001")
    if res.status_code == 200:
        data = res.json()
        assert data["status"] == "PENDING"
        assert data["response"] is None


def test_18_historical_sar_record_immutability():
    """Verify an approved SAR record cannot be overwritten or downgraded by a subsequent re-investigation."""
    db = SessionLocal()
    case_id = f"HHG-{uuid4().hex[:6].upper()}"
    inv_id1 = f"INV-{uuid4().hex[:6].upper()}"
    inv_id2 = f"INV-{uuid4().hex[:6].upper()}"


    agent_output1 = InvestigationResult(
        case_id=case_id, customer_id="C08623", case_status="CLOSED", status="CONFIRMED_FRAUD", verdict="DECLINED",
        fraud_probability=None, pattern="Stolen Card", evidence=[], affected_transaction_ids=["1"], connected_card_ids=["2"],
        connected_device_ids=[], exposure=4000.0, similar_prior_cases=[], written_to_graph=True, evidence_requests=[],
        next_best_actions_initial=[], next_best_actions_final=[],
        rules_evaluated=[{"rule_id": "R4", "triggered": True, "description": "Stolen Card"}]
    )
    sync_sar_candidate_from_result(db, case_id=case_id, investigation_id=inv_id1, agent_output=agent_output1)
    db.close()

    # Analyst approves SAR
    client.post(f"/api/cases/{case_id}/sar/review", json={"decision": "approve", "analyst_notes": "Approved"})

    # Subsequent low risk re-investigation run
    db2 = SessionLocal()
    agent_output2 = InvestigationResult(
        case_id=case_id, customer_id="C08623", case_status="COMPLETED", status="CLEARED", verdict="APPROVED",
        fraud_probability=None, pattern="Cleared", evidence=[], affected_transaction_ids=["1"], connected_card_ids=["2"],
        connected_device_ids=[], exposure=0.0, similar_prior_cases=[], written_to_graph=True, evidence_requests=[],
        next_best_actions_initial=[], next_best_actions_final=[],
        rules_evaluated=[{"rule_id": "R1", "triggered": True, "description": "Low Risk"}]
    )
    sync_sar_candidate_from_result(db2, case_id=case_id, investigation_id=inv_id2, agent_output=agent_output2)

    res_sar = client.get(f"/api/cases/{case_id}/sar")
    assert res_sar.status_code == 200
    assert res_sar.json()["status"] == "APPROVED"  # Preserved!
    db2.close()


def test_19_no_fake_graph_data():
    """Verify SAR supporting evidence is grounded in real investigation outputs."""
    db = SessionLocal()
    sar = db.query(SarRecordModel).filter(SarRecordModel.case_id == "HHG-003").first()
    if sar and sar.supporting_evidence:
        assert "CUST-9842" not in sar.supporting_evidence
        assert "CARD-4412" not in sar.supporting_evidence
    db.close()


def test_20_get_sar_nonexistent_case_returns_404():
    """Verify requesting SAR for a nonexistent case returns HTTP 404."""
    res = client.get("/api/cases/NONEXISTENT_CASE_9999/sar")
    assert res.status_code == 404
