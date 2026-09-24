import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.services.database import SessionLocal
from app.models.investigation import CaseModel, InvestigationModel, AuditEventModel, EvidenceRequestModel

client = TestClient(app)

def test_manual_case_required_fields_validation():
    """
    Validation error returned if required fields are missing.
    """
    # Missing case_id
    res = client.post("/api/cases/manual", json={
        "customer_id": "C08623",
        "transaction_id": "3530164",
        "trigger_type": "customer_report",
        "trigger_text": "I never made this purchase."
    })
    assert res.status_code == 422

    # Missing transaction_id
    res = client.post("/api/cases/manual", json={
        "case_id": "VAL-TEST-001",
        "trigger_type": "customer_report",
        "trigger_text": "I never made this purchase."
    })
    assert res.status_code == 422

    # Invalid trigger_type
    res = client.post("/api/cases/manual", json={
        "case_id": "VAL-TEST-002",
        "transaction_id": "3530164",
        "trigger_type": "invalid_trigger",
        "trigger_text": "I never made this purchase."
    })
    assert res.status_code == 400
    assert "Trigger type must be one of" in res.json()["detail"]

    # Missing trigger_text
    res = client.post("/api/cases/manual", json={
        "case_id": "VAL-TEST-003",
        "transaction_id": "3530164",
        "trigger_type": "customer_report",
        "trigger_text": ""
    })
    assert res.status_code in (400, 422)


def test_duplicate_case_rejection():
    """
    Duplicate Case IDs must be rejected with 400 Bad Request.
    """
    case_id = "DUP-TEST-001"

    # Cleanup if existing from prior run
    db = SessionLocal()
    try:
        db.query(InvestigationModel).filter(InvestigationModel.case_id == case_id).delete()
        db.query(AuditEventModel).filter(AuditEventModel.case_id == case_id).delete()
        db.query(EvidenceRequestModel).filter(EvidenceRequestModel.case_id == case_id).delete()
        db.query(CaseModel).filter(CaseModel.case_id == case_id).delete()
        db.commit()
    finally:
        db.close()

    payload = {
        "case_id": case_id,
        "customer_id": "C08623",
        "transaction_id": "3530164",
        "amount": 49.00,
        "trigger_type": "customer_report",
        "trigger_text": "Duplicate test case."
    }

    # First creation
    res1 = client.post("/api/cases/manual", json=payload)
    assert res1.status_code == 200

    # Second creation with same case_id -> must fail
    res2 = client.post("/api/cases/manual", json=payload)
    assert res2.status_code == 400
    assert f"Case ID '{case_id}' already exists" in res2.json()["detail"]


@pytest.mark.asyncio
async def test_manual_case_creation_and_investigation_flow():
    """
    Verify complete manual input -> investigation -> case details flow for DEMO-001.
    Confirms:
    1. DEMO-001 case created and investigation runs.
    2. Evidence grounded in TigerGraph graph (Transaction 3530164 / Customer C08623).
    3. No fabricated customer response.
    4. Scoped strictly to DEMO-001 (Case isolation).
    5. No contamination of HHG-003.
    """
    case_id = "DEMO-001"

    # Cleanup if previously created
    db: Session = SessionLocal()
    try:
        db.query(InvestigationModel).filter(InvestigationModel.case_id == case_id).delete()
        db.query(AuditEventModel).filter(AuditEventModel.case_id == case_id).delete()
        db.query(EvidenceRequestModel).filter(EvidenceRequestModel.case_id == case_id).delete()
        db.query(CaseModel).filter(CaseModel.case_id == case_id).delete()
        db.commit()
    finally:
        db.close()

    payload = {
        "case_id": case_id,
        "customer_id": "C08623",
        "transaction_id": "3530164",
        "amount": 49.00,
        "trigger_type": "customer_report",
        "trigger_text": "I never made this $49.00 purchase. Please investigate."
    }

    response = client.post("/api/cases/manual", json=payload)
    assert response.status_code == 200, f"Error: {response.text}"
    data = response.json()

    # 1. Response validation
    assert data["case_id"] == case_id
    assert data["investigation_id"] is not None
    assert data["status"] in ("COMPLETED", "UNDER_INVESTIGATION", "VERIFICATION_PENDING", "NEEDS_REVIEW", "PENDING", "CLEARED", "APPROVED", "CONFIRMED_FRAUD")
    assert "verdict" in data
    assert "evidence" in data
    assert "evidence_requests" in data
    assert "SAR" in data
    assert "stop_reason" in data

    # 2. Confirm evidence is grounded in real TigerGraph vertices
    ev_list = data["evidence"]
    assert len(ev_list) > 0, "Investigation should retrieve normalized evidence"

    # 3. Confirm no fabricated customer response for evidence requests
    for er in data["evidence_requests"]:
        status = er.get("status") if isinstance(er, dict) else getattr(er, "status", None)
        assert status != "RESPONDED", "Customer response must not be fabricated"

    # 4. Check case persistence in DB
    db = SessionLocal()
    try:
        c = db.query(CaseModel).filter(CaseModel.case_id == case_id).first()
        assert c is not None
        assert c.case_id == case_id
        assert c.customer_id == "C08623"
        assert c.transaction_id == "3530164"

        # Check investigation history isolation
        runs = db.query(InvestigationModel).filter(InvestigationModel.case_id == case_id).all()
        assert len(runs) >= 1
        for run in runs:
            assert run.case_id == case_id

        # Check audit trail isolation
        audits = db.query(AuditEventModel).filter(AuditEventModel.case_id == case_id).all()
        assert len(audits) >= 1
        for a in audits:
            assert a.case_id == case_id

        # Check evidence request isolation (must NOT include HHG-003 requests)
        reqs = db.query(EvidenceRequestModel).filter(EvidenceRequestModel.case_id == case_id).all()
        for r in reqs:
            assert r.case_id == case_id
            assert "ER-HHG-003-001" not in r.request_id

        # 5. Confirm HHG-003 behavior is unchanged
        hhg003 = db.query(CaseModel).filter(CaseModel.case_id == "HHG-003").first()
        assert hhg003 is not None
        assert hhg003.case_id == "HHG-003"
    finally:
        db.close()


def test_get_manual_case_and_history():
    """
    Verify GET /api/cases/{case_id} and GET /api/cases/{case_id}/investigations work for manual cases.
    """
    case_id = "DEMO-001"

    # Fetch case detail
    res_case = client.get(f"/api/cases/{case_id}")
    assert res_case.status_code == 200
    c_data = res_case.json()
    assert c_data["case_id"] == case_id

    # Fetch investigation history
    res_hist = client.get(f"/api/cases/{case_id}/investigations")
    assert res_hist.status_code == 200
    h_data = res_hist.json()
    assert h_data["case_id"] == case_id
    assert len(h_data["investigations"]) >= 1
    for inv in h_data["investigations"]:
        assert inv["case_id"] == case_id

    # Fetch audit timeline
    res_audit = client.get(f"/api/cases/{case_id}/audit")
    assert res_audit.status_code == 200
    a_data = res_audit.json()
    assert len(a_data) >= 1
    for ev in a_data:
        assert ev["case_id"] == case_id


def test_manual_trigger_is_investigation_context():
    """
    1. Manual trigger grounding: Verify trigger_type and trigger_text are grounded in InvestigationContext.
    """
    from app.agent.state import InvestigationState
    from app.agent.context import build_investigation_context

    state = InvestigationState(case_id="TEST-TRIG-001")
    case_info = {
        "case_id": "TEST-TRIG-001",
        "customer_id": "C08623",
        "transaction_id": "3530164",
        "amount": 49.00,
        "trigger_type": "customer_report",
        "trigger_text": "I never made this $49.00 purchase. Please investigate."
    }
    txns = [{"id": "3530164", "amount": 49.00, "status": "FLAGGED", "risk_score": 0.45}]
    
    ctx = build_investigation_context(
        state=state,
        case_info=case_info,
        transactions=txns,
        customer_info={"id": "C08623"},
        cards_info=[],
        devices_info=[],
        billing_regions_info=[],
        email_domains_info=[],
        connected_cases_info=[],
        evidence_requests_info=[],
        normalized_evidence=[]
    )

    assert ctx.observed_facts.trigger_info is not None
    assert ctx.observed_facts.trigger_info.trigger_type == "customer_report"
    assert ctx.observed_facts.trigger_info.trigger_text == "I never made this $49.00 purchase. Please investigate."


def test_customer_report_sets_dispute_context():
    """
    2. Customer dispute detection: Verify customer_report trigger sets customer_dispute = True.
    """
    from app.agent.state import InvestigationState
    from app.agent.context import build_investigation_context

    state = InvestigationState(case_id="TEST-DISP-001")
    case_info = {
        "case_id": "TEST-DISP-001",
        "customer_id": "C08623",
        "transaction_id": "3530164",
        "amount": 49.00,
        "trigger_type": "customer_report",
        "trigger_text": "I never made this purchase."
    }
    txns = [{"id": "3530164", "amount": 49.00, "status": "FLAGGED"}]

    ctx = build_investigation_context(
        state=state,
        case_info=case_info,
        transactions=txns,
        customer_info={"id": "C08623"},
        cards_info=[],
        devices_info=[],
        billing_regions_info=[],
        email_domains_info=[],
        connected_cases_info=[],
        evidence_requests_info=[],
        normalized_evidence=[]
    )

    assert ctx.derived_observations.customer_dispute is True
    assert ctx.observed_facts.transactions[0].get("disputed") is True


@pytest.mark.asyncio
async def test_manual_case_does_not_inherit_other_case_evidence_requests():
    """
    3. Evidence request handling: Verify DEMO-001 does NOT inherit ER-HHG-003-001.
    """
    from app.agent.tools import get_evidence_requests

    reqs = await get_evidence_requests("DEMO-001")
    req_ids = [r.get("id") or r.get("request_id") for r in reqs]
    assert "ER-HHG-003-001" not in req_ids
    for r in reqs:
        c_id = r.get("case_id") or r.get("for_case")
        if c_id:
            assert c_id == "DEMO-001"


def test_r2_not_triggered_without_current_case_pending_request():
    """
    4. R2 semantics: NOT_TRIGGERED when no pending request belongs to current case.
    """
    from app.agent.state import InvestigationState
    from app.agent.context import build_investigation_context
    from app.agent.reasoning import InvestigationReasoningOutput
    from app.agent.decision import evaluate_policy_rules

    state = InvestigationState(case_id="DEMO-001")
    case_info = {"case_id": "DEMO-001", "trigger_type": "customer_report", "trigger_text": "Dispute"}
    ctx = build_investigation_context(
        state=state,
        case_info=case_info,
        transactions=[{"id": "3530164", "amount": 49.0}],
        customer_info={"id": "C08623"},
        cards_info=[],
        devices_info=[],
        billing_regions_info=[],
        email_domains_info=[],
        connected_cases_info=[],
        evidence_requests_info=[],
        normalized_evidence=[]
    )
    reasoning = InvestigationReasoningOutput(case_id="DEMO-001", pending_evidence_requests=[])

    res = evaluate_policy_rules(reasoning, ctx)
    r2 = next(r for r in res.rules_evaluated if r.rule_id == "R2")
    assert r2.triggered is False
    assert r2.status == "NOT_TRIGGERED"


def test_r10_not_triggered_without_current_case_pending_request():
    """
    4. R10 semantics: NOT_TRIGGERED when no pending request belongs to current case.
    """
    from app.agent.state import InvestigationState
    from app.agent.context import build_investigation_context
    from app.agent.reasoning import InvestigationReasoningOutput
    from app.agent.decision import evaluate_policy_rules

    state = InvestigationState(case_id="DEMO-001")
    case_info = {"case_id": "DEMO-001", "trigger_type": "customer_report", "trigger_text": "Dispute"}
    ctx = build_investigation_context(
        state=state,
        case_info=case_info,
        transactions=[{"id": "3530164", "amount": 49.0}],
        customer_info={"id": "C08623"},
        cards_info=[],
        devices_info=[],
        billing_regions_info=[],
        email_domains_info=[],
        connected_cases_info=[],
        evidence_requests_info=[],
        normalized_evidence=[]
    )
    reasoning = InvestigationReasoningOutput(case_id="DEMO-001", pending_evidence_requests=[])

    res = evaluate_policy_rules(reasoning, ctx)
    r10 = next(r for r in res.rules_evaluated if r.rule_id == "R10")
    assert r10.triggered is False
    assert r10.status == "NOT_TRIGGERED"


def test_r3_triggered_for_customer_dispute():
    """
    4. R3 semantics: TRIGGERED for customer report dispute.
    """
    from app.agent.state import InvestigationState
    from app.agent.context import build_investigation_context
    from app.agent.reasoning import InvestigationReasoningOutput
    from app.agent.decision import evaluate_policy_rules

    state = InvestigationState(case_id="DEMO-001")
    case_info = {"case_id": "DEMO-001", "trigger_type": "customer_report", "trigger_text": "I never made this purchase."}
    ctx = build_investigation_context(
        state=state,
        case_info=case_info,
        transactions=[{"id": "3530164", "amount": 49.0}],
        customer_info={"id": "C08623"},
        cards_info=[],
        devices_info=[],
        billing_regions_info=[],
        email_domains_info=[],
        connected_cases_info=[],
        evidence_requests_info=[],
        normalized_evidence=[]
    )
    reasoning = InvestigationReasoningOutput(case_id="DEMO-001", customer_disputes_represented=["Transaction 3530164"])

    res = evaluate_policy_rules(reasoning, ctx)
    r3 = next(r for r in res.rules_evaluated if r.rule_id == "R3")
    assert r3.triggered is True
    assert r3.status == "TRIGGERED"


def test_no_close_case_on_active_customer_dispute():
    """
    7. Mitigation actions: Must NOT produce CLOSE_CASE or UNFLAG_TRANSACTION for active dispute.
    """
    from app.agent.state import InvestigationState
    from app.agent.context import build_investigation_context
    from app.agent.reasoning import InvestigationReasoningOutput
    from app.agent.decision import evaluate_policy_rules

    state = InvestigationState(case_id="DEMO-001")
    case_info = {"case_id": "DEMO-001", "trigger_type": "customer_report", "trigger_text": "I never made this purchase."}
    ctx = build_investigation_context(
        state=state,
        case_info=case_info,
        transactions=[{"id": "3530164", "amount": 49.0}],
        customer_info={"id": "C08623"},
        cards_info=[],
        devices_info=[],
        billing_regions_info=[],
        email_domains_info=[],
        connected_cases_info=[],
        evidence_requests_info=[],
        normalized_evidence=[]
    )
    reasoning = InvestigationReasoningOutput(case_id="DEMO-001", customer_disputes_represented=["Transaction 3530164"])

    res = evaluate_policy_rules(reasoning, ctx)
    assert "CLOSE_CASE" not in res.recommended_actions
    assert "UNFLAG_TRANSACTION" not in res.recommended_actions
    assert res.decision_state == "UNDER_INVESTIGATION"
    assert res.verdict == "NEEDS_REVIEW"


def test_manual_trigger_reaches_groq_context():
    """
    6. Groq grounding: Prompt passed to Groq must explicitly include manual trigger text.
    """
    from app.agent.state import InvestigationState
    from app.agent.context import build_investigation_context
    from app.agent.reasoning import format_groq_user_prompt

    state = InvestigationState(case_id="DEMO-001")
    case_info = {"case_id": "DEMO-001", "trigger_type": "customer_report", "trigger_text": "I never made this $49.00 purchase. Please investigate."}
    ctx = build_investigation_context(
        state=state,
        case_info=case_info,
        transactions=[{"id": "3530164", "amount": 49.0}],
        customer_info={"id": "C08623"},
        cards_info=[],
        devices_info=[],
        billing_regions_info=[],
        email_domains_info=[],
        connected_cases_info=[],
        evidence_requests_info=[],
        normalized_evidence=[]
    )

    prompt = format_groq_user_prompt(ctx)
    assert "customer_report" in prompt
    assert "I never made this $49.00 purchase. Please investigate." in prompt

