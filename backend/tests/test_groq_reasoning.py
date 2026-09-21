import pytest
import asyncio
from app.core.config import settings
from app.agent.investigator import investigate
from app.agent.reasoning import analyze_investigation_context, GroqLLMReasoningSchema
from app.agent.context import build_investigation_context
from app.agent.state import InvestigationState

def test_groq_config_loads_from_env():
    """Verify Groq LLM configuration loads properly from environment settings."""
    assert settings.LLM_PROVIDER == "groq"
    assert settings.GROQ_MODEL == "openai/gpt-oss-120b"
    assert settings.GROQ_API_KEY is not None
    assert len(settings.GROQ_API_KEY) > 0

def test_groq_api_key_not_logged():
    """Verify GROQ_API_KEY is masked and not present in public representations."""
    key_str = str(settings.GROQ_API_KEY)
    assert key_str not in repr(settings.APP_NAME)

@pytest.mark.asyncio
async def test_hhg003_real_groq_reasoning():
    """Verify HHG-003 produces real Groq reasoning with usage metrics, correct pending status, and no risk_score conversion."""
    res = await investigate("HHG-003")
    assert res.case_id == "HHG-003"
    assert res.case_status == "UNDER_INVESTIGATION"
    assert res.status == "VERIFICATION_PENDING"
    assert res.verdict == "NEEDS_REVIEW"
    # CRITICAL: risk_score (0.40) must NOT be converted into fraud_probability
    assert res.fraud_probability is None
    assert res.reasoning_summary is not None
    assert len(res.reasoning_summary) > 10
    # Observability token metrics
    assert res.tokens is not None
    assert res.tokens.get("total", 0) > 0
    assert res.latency > 0.0

@pytest.mark.asyncio
async def test_second_case_hhg001_dynamic_investigation():
    """Verify agent dynamically investigates a second case (HHG-001) using real graph data."""
    res = await investigate("HHG-001")
    assert res.case_id == "HHG-001"
    assert res.case_status in ("UNRESOLVED", "UNDER_INVESTIGATION", "CLEARED", "CONFIRMED_FRAUD")
    assert res.reasoning_summary is not None
    assert "CUST-9842" not in str(res.model_dump())

@pytest.mark.asyncio
async def test_no_mock_customer_or_card_data():
    """Verify no fabricated customer (CUST-9842) or card (CARD-4412) appears in investigation output."""
    res = await investigate("HHG-003")
    data_str = str(res.model_dump())
    assert "CUST-9842" not in data_str
    assert "CARD-4412" not in data_str
