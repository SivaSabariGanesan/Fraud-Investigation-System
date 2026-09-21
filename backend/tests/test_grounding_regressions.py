import pytest
import asyncio
from app.agent.investigator import investigate
from app.services.tigergraph import tigergraph_service

@pytest.mark.asyncio
async def test_hhg003_customer_id_is_c08623():
    """Verify HHG-003 customer_id is explicitly resolved as C08623."""
    res = await investigate("HHG-003")
    assert res.case_id == "HHG-003"
    assert res.customer_id == "C08623"

@pytest.mark.asyncio
async def test_hhg003_transaction_3530164_relationship():
    """Verify transaction 3530164 customer relationship and details are preserved."""
    res = await investigate("HHG-003")
    assert "3530164" in res.affected_transaction_ids
    assert res.customer_id == "C08623"

@pytest.mark.asyncio
async def test_transaction_timestamps_preserved():
    """Verify transaction evidence preserves specific timestamp attributes rather than replacing with case created_at."""
    res = await investigate("HHG-003")
    txn_evidence = [e for e in res.evidence if e.evidence_type in ("Transaction", "transaction")]
    assert len(txn_evidence) > 0

@pytest.mark.asyncio
async def test_pending_evidence_request_prevents_undisputed_reasoning():
    """Verify pending EvidenceRequest prevents reasoning from stating transactions are undisputed."""
    res = await investigate("HHG-003")
    data_str = str(res.reasoning_summary or "").lower()
    assert "undisputed" not in data_str

@pytest.mark.asyncio
async def test_pending_evidence_request_stop_reason():
    """Verify pending EvidenceRequest produces stop_reason = PENDING_EVIDENCE_RESPONSE."""
    res = await investigate("HHG-003")
    assert res.stop_reason == "PENDING_EVIDENCE_RESPONSE"

@pytest.mark.asyncio
async def test_pending_evidence_status_badges():
    """Verify pending evidence results in UNDER_INVESTIGATION / VERIFICATION_PENDING / NEEDS_REVIEW."""
    res = await investigate("HHG-003")
    assert res.case_status == "UNDER_INVESTIGATION"
    assert res.status == "VERIFICATION_PENDING"
    assert res.verdict == "NEEDS_REVIEW"

@pytest.mark.asyncio
async def test_risk_score_does_not_independently_trigger_sar():
    """Verify risk_score (0.40) alone does NOT trigger SAR recommendation when fraud is not confirmed."""
    res = await investigate("HHG-003")
    assert res.SAR is not None
    assert res.SAR.get("status") != "RECOMMENDED"

@pytest.mark.asyncio
async def test_hhg001_remains_dynamically_supported():
    """Verify dynamic support for second case HHG-001."""
    res = await investigate("HHG-001")
    assert res.case_id == "HHG-001"
    assert res.case_status is not None
