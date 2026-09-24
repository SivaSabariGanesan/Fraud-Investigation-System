import pytest
import json
import httpx
from pydantic import ValidationError
from app.agent.reasoning import GroqLLMReasoningSchema, analyze_investigation_context
from app.agent.investigator import investigate
from app.services.tigergraph import tigergraph_service

def test_ollama_schema_normalization():
    """
    Requirement 14: Add a test where Ollama returns malformed string values for list fields:
    {
      "conflicting_evidence": "",
      "missing_evidence": "No transaction verification",
      "uncertainties": "Customer intent is uncertain"
    }
    and verify normalization produces:
    {
      "conflicting_evidence": [],
      "missing_evidence": ["No transaction verification"],
      "uncertainties": ["Customer intent is uncertain"]
    }
    """
    raw = {
        "conflicting_evidence": "",
        "missing_evidence": "No transaction verification",
        "uncertainties": "Customer intent is uncertain"
    }
    schema = GroqLLMReasoningSchema.model_validate(raw)
    assert schema.conflicting_evidence == []
    assert schema.missing_evidence == ["No transaction verification"]
    assert schema.uncertainties == ["Customer intent is uncertain"]


@pytest.mark.asyncio
async def test_ollama_validation_failure_preserves_deterministic_evidence(monkeypatch):
    """
    Requirement 13: Add regression tests proving that an Ollama validation failure
    does NOT cause deterministic evidence fields to become empty.
    """
    # Force httpx.post to return an unparseable or schema-failing structure
    async def mock_post(*args, **kwargs):
        class MockResponse:
            status_code = 200
            def json(self):
                return {
                    "message": {
                        "content": "INVALID_JSON_PAYLOAD_{{"
                    }
                }
        return MockResponse()

    monkeypatch.setattr("httpx.AsyncClient.post", mock_post)

    res = await investigate("HHG-003")
    assert res.case_id == "HHG-003"
    assert len(res.affected_transaction_ids) > 0
    assert len(res.connected_card_ids) > 0
    assert res.exposure > 0.0
    assert getattr(res, "llm_fallback", False) is True


@pytest.mark.asyncio
async def test_ollama_timeout_preserves_deterministic_evidence_and_graph_status(monkeypatch):
    """
    Requirement 15: Add a timeout test and verify the case still contains
    transaction IDs, connected cards, exposure, and graph status.
    """
    async def mock_post_timeout(*args, **kwargs):
        raise httpx.TimeoutException("Ollama request timed out after 30s")

    monkeypatch.setattr("httpx.AsyncClient.post", mock_post_timeout)

    res = await investigate("HHG-003")
    assert res.case_id == "HHG-003"
    assert "3530164" in res.affected_transaction_ids
    assert "19739" in res.connected_card_ids
    assert res.exposure == 49.0 or res.exposure > 0.0
    assert isinstance(res.written_to_graph, bool)
    assert getattr(res, "llm_fallback", False) is True
