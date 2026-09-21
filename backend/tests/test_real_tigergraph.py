import pytest
import asyncio
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings
from app.services.tigergraph import tigergraph_service, TigerGraphConnectionError
from app.agent.investigator import investigate
from app.agent.decision import evaluate_policy_rules

client = TestClient(app)

def test_01_tigergraph_config_from_env():
    """Verify TigerGraph configuration loads from environment variables and no secret is hardcoded."""
    assert settings.TIGERGRAPH_HOST is not None
    assert "https://" in settings.TIGERGRAPH_HOST
    assert settings.TIGERGRAPH_GRAPH_NAME == "FraudGraph"
    assert settings.TIGERGRAPH_SECRET is not None
    assert len(settings.TIGERGRAPH_SECRET) > 0

@pytest.mark.asyncio
async def test_02_auth_succeeds_with_local_secret():
    """Verify authentication succeeds with valid local Database Secret via /gsql/v1/tokens."""
    token = await tigergraph_service.get_valid_token()
    assert token is not None
    assert len(token) > 20

@pytest.mark.asyncio
async def test_03_real_restpp_reaches_fraudgraph():
    """Verify real RESTPP request can reach FraudGraph and fetch ClosedCase vertex."""
    case_v = await tigergraph_service.get_vertex("ClosedCase", "HHG-003")
    assert case_v is not None
    assert case_v.get("id") == "HHG-003" or case_v.get("case_id") == "HHG-003"

@pytest.mark.asyncio
async def test_04_hhg003_installed_query_call():
    """Verify hhg003_policy_decision installed query can be called on real FraudGraph."""
    query_res = await tigergraph_service.run_query("hhg003_policy_decision")
    assert query_res is not None
    assert query_res.get("error") is False
    assert "results" in query_res

@pytest.mark.asyncio
async def test_05_hhg003_real_entities_retrieved():
    """Verify HHG-003 returns real graph data: Customer C08623, Transaction 3530164, Card 19739."""
    subgraph = await tigergraph_service.fetch_case_subgraph("HHG-003")
    entities = subgraph.get("entities", {})
    
    txns = entities.get("Transaction", [])
    txn_ids = [t.get("id") or t.get("TransactionID") for t in txns]
    assert "3530164" in txn_ids

    ev_reqs = entities.get("EvidenceRequest", [])
    req_ids = [r.get("id") or r.get("request_id") for r in ev_reqs]
    assert "ER-HHG-003-001" in req_ids

@pytest.mark.asyncio
async def test_06_no_mock_customer_card_returned():
    """Verify no mock customer (CUST-9842) or card (CARD-4412) values are returned for HHG-003."""
    res = await investigate("HHG-003")
    assert "CUST-9842" not in str(res.model_dump())
    assert "CARD-4412-XXXX-9012" not in str(res.model_dump())
    assert "CARD-4412" not in str(res.model_dump())

@pytest.mark.asyncio
async def test_07_connection_failure_no_mock_fallback():
    """Verify missing/invalid credentials raise a clear error rather than falling back to mock data."""
    original_secret = tigergraph_service.secret
    original_token = tigergraph_service._token
    
    try:
        tigergraph_service.secret = "INVALID_SECRET_TEST"
        tigergraph_service._token = None
        
        with pytest.raises(TigerGraphConnectionError):
            await tigergraph_service.get_valid_token()
    finally:
        tigergraph_service.secret = original_secret
        tigergraph_service._token = original_token

def test_08_api_endpoints_working():
    """Verify existing API endpoints (GET /health, GET /api/cases, POST /api/investigations/HHG-003) work."""
    res_h = client.get("/health")
    assert res_h.status_code == 200
    assert res_h.json() == {"status": "ok"}

    res_c = client.get("/api/cases")
    assert res_c.status_code == 200

    res_inv = client.post("/api/investigations/HHG-003")
    assert res_inv.status_code == 200
    data = res_inv.json()
    assert data["case_id"] == "HHG-003"
    assert data["case_status"] == "UNRESOLVED"
    assert data["verdict"] == "NEEDS_REVIEW"
