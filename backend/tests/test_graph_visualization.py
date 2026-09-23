import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.tigergraph import tigergraph_service

client = TestClient(app)

def test_01_get_graph_endpoint_works():
    """Verify GET /api/cases/HHG-003/graph returns HTTP 200 and normalized graph JSON."""
    response = client.get("/api/cases/HHG-003/graph")
    assert response.status_code == 200
    data = response.json()
    assert data["case_id"] == "HHG-003"
    assert "nodes" in data
    assert "edges" in data
    assert isinstance(data["nodes"], list)
    assert isinstance(data["edges"], list)


def test_02_unknown_case_returns_404():
    """Verify requesting graph for an unknown case returns 404 Not Found."""
    response = client.get("/api/cases/NONEXISTENT_CASE_999/graph")
    assert response.status_code == 404


def test_03_graph_contains_only_real_evidence():
    """Verify all nodes in the graph correspond to real graph entity types."""
    response = client.get("/api/cases/HHG-003/graph")
    assert response.status_code == 200
    data = response.json()
    valid_types = {
        "Customer", "Card", "Transaction", "DeviceProfile",
        "EmailDomain", "BillingRegion", "ClosedCase", "EvidenceRequest"
    }
    for node in data["nodes"]:
        assert node["type"] in valid_types, f"Unexpected node type found: {node['type']}"


def test_04_no_fake_nodes_generated():
    """Verify no hardcoded fake demo nodes (e.g. customer1, card1, CUST-9842) exist."""
    response = client.get("/api/cases/HHG-003/graph")
    assert response.status_code == 200
    data = response.json()
    node_ids = [n["id"] for n in data["nodes"]]
    fake_node_ids = ["customer1", "card1", "CUST-9842", "CARD-4412"]
    for fake_id in fake_node_ids:
        assert not any(fake_id in nid for nid in node_ids), f"Fake node '{fake_id}' was generated!"


def test_05_no_fake_edges_generated():
    """Verify edges connect only existing valid nodes in the response."""
    response = client.get("/api/cases/HHG-003/graph")
    assert response.status_code == 200
    data = response.json()
    node_ids = {n["id"] for n in data["nodes"]}
    for edge in data["edges"]:
        assert edge["source"] in node_ids, f"Edge source '{edge['source']}' not in nodes list!"
        assert edge["target"] in node_ids, f"Edge target '{edge['target']}' not in nodes list!"


def test_06_hhg003_contains_customer_c08623():
    """Verify HHG-003 graph includes Customer C08623 where supported by evidence."""
    response = client.get("/api/cases/HHG-003/graph")
    assert response.status_code == 200
    data = response.json()
    cust_nodes = [n for n in data["nodes"] if n["type"] == "Customer"]
    assert len(cust_nodes) > 0
    c_ids = [n["properties"].get("customer_id") for n in cust_nodes]
    assert "C08623" in c_ids


def test_07_hhg003_contains_card_19739():
    """Verify HHG-003 graph includes Card 19739 where supported by evidence."""
    response = client.get("/api/cases/HHG-003/graph")
    assert response.status_code == 200
    data = response.json()
    card_nodes = [n for n in data["nodes"] if n["type"] == "Card"]
    assert len(card_nodes) > 0
    card_ids = [n["properties"].get("card_id") for n in card_nodes]
    assert "19739" in card_ids


def test_08_transaction_3530164_represented_correctly():
    """Verify Transaction 3530164 properties are exact and risk signal is properly labeled."""
    response = client.get("/api/cases/HHG-003/graph")
    assert response.status_code == 200
    data = response.json()
    txn_node = next((n for n in data["nodes"] if "3530164" in n["id"]), None)
    assert txn_node is not None, "Transaction 3530164 not found in graph!"
    props = txn_node["properties"]
    assert props.get("amount") == 49.0 or props.get("amount") == 49
    assert "2016-12-10" in props.get("timestamp", "")
    assert props.get("channel") == "in_person"
    assert props.get("risk_signal") == 0.4
    # Ensure risk_score is NOT labeled as Fraud Probability
    assert "fraud_probability" not in props


def test_09_evidence_request_represented_correctly():
    """Verify EvidenceRequest ER-HHG-003-001 is represented with status PENDING."""
    response = client.get("/api/cases/HHG-003/graph")
    assert response.status_code == 200
    data = response.json()
    er_nodes = [n for n in data["nodes"] if n["type"] == "EvidenceRequest"]
    assert len(er_nodes) > 0
    er_node = next((n for n in er_nodes if "ER-HHG-003-001" in n["id"]), None)
    assert er_node is not None
    assert er_node["properties"].get("status") == "PENDING"


def test_10_credentials_never_returned():
    """Verify TigerGraph secrets and tokens are never exposed in graph response."""
    response = client.get("/api/cases/HHG-003/graph")
    assert response.status_code == 200
    res_str = response.text
    if tigergraph_service.secret:
        assert tigergraph_service.secret not in res_str
    if tigergraph_service._token:
        assert tigergraph_service._token not in res_str
    assert "Authorization" not in res_str
    assert "TIGERGRAPH_SECRET" not in res_str


def test_11_malformed_historical_transactions_excluded():
    """Verify malformed transactions (invalid/missing ID, non-positive amount) are omitted."""
    response = client.get("/api/cases/HHG-003/graph")
    assert response.status_code == 200
    data = response.json()
    txn_nodes = [n for n in data["nodes"] if n["type"] == "Transaction"]
    for tn in txn_nodes:
        props = tn["properties"]
        amount = props.get("amount")
        assert amount is not None and amount > 0, f"Malformed transaction included with non-positive amount: {amount}"
        assert props.get("transaction_id"), "Transaction missing transaction_id!"
