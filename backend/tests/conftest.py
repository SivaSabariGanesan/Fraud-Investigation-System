"""
Pytest configuration and deterministic test fixtures for Fraud Investigation System test suite.
Mocks TigerGraph RESTPP service calls during test runs so tests do not depend on live cloud authentication,
while strictly preserving exact case isolation behavior for HHG-001 through HHG-020.
"""

import pytest
from unittest.mock import patch, AsyncMock
from typing import Dict, Any, List, Optional

from app.services.tigergraph import tigergraph_service

_HHG003_SUBGRAPH = {
    "case_id": "HHG-003",
    "entities": {
        "ClosedCase": [{
            "id": "HHG-003",
            "case_id": "HHG-003",
            "status": "UNDER_INVESTIGATION",
            "verdict": "NEEDS_REVIEW",
            "pattern": "Pending Evidence Response",
            "exposure": 1307.22
        }],
        "Customer": [{
            "id": "C08623",
            "customer_id": "C08623",
            "name": "Customer C08623",
            "risk_level": "NEUTRAL"
        }],
        "Card": [{
            "id": "19739",
            "card_id": "19739",
            "brand": "Visa"
        }],
        "Transaction": [{
            "id": "3530164",
            "TransactionID": "3530164",
            "amount": 49.0,
            "status": "FLAGGED",
            "risk_score": 0.4,
            "timestamp": "2016-12-10 15:01:21",
            "channel": "in_person"
        }],
        "DeviceProfile": [{
            "id": "Windows",
            "device_id": "Windows",
            "os": "Windows",
            "vpn_detected": False
        }],
        "BillingRegion": [{
            "id": "US-CA",
            "region_id": "US-CA",
            "country_code": "US",
            "mismatch_flag": False
        }],
        "EmailDomain": [{
            "id": "yahoo.com",
            "domain_name": "yahoo.com",
            "disposable": False
        }],
        "EvidenceRequest": [{
            "id": "ER-HHG-003-001",
            "request_id": "ER-HHG-003-001",
            "case_id": "HHG-003",
            "transaction_id": "3530164",
            "request_type": "customer_transaction_confirmation",
            "status": "pending",
            "request_text": "Confirm whether you made the $49.00 transaction.",
            "response": None
        }]
    },
    "relationships": [
        {"from": "HHG-003", "rel": "INVOLVES", "to": "3530164"},
        {"from": "19739", "rel": "MADE", "to": "3530164"},
        {"from": "C08623", "rel": "OWNS", "to": "19739"},
        {"from": "ER-HHG-003-001", "rel": "FOR_CASE", "to": "HHG-003"}
    ]
}

def _get_generic_subgraph(case_id: str) -> Dict[str, Any]:
    return {
        "case_id": case_id,
        "entities": {
            "ClosedCase": [{
                "id": case_id,
                "case_id": case_id,
                "status": "CLEARED",
                "verdict": "APPROVED",
                "exposure": 100.0
            }],
            "Customer": [{
                "id": f"CUST-{case_id}",
                "customer_id": f"CUST-{case_id}",
                "name": f"Customer {case_id}",
                "risk_level": "NEUTRAL"
            }],
            "Card": [{
                "id": f"CARD-{case_id}",
                "card_id": f"CARD-{case_id}",
                "brand": "Visa"
            }],
            "Transaction": [{
                "id": f"TXN-{case_id}-01",
                "TransactionID": f"TXN-{case_id}-01",
                "amount": 100.0,
                "status": "APPROVED",
                "risk_score": 0.05
            }],
            "DeviceProfile": [],
            "BillingRegion": [],
            "EmailDomain": [],
            "EvidenceRequest": []
        },
        "relationships": [
            {"from": case_id, "rel": "INVOLVES", "to": f"TXN-{case_id}-01"},
            {"from": f"CARD-{case_id}", "rel": "MADE", "to": f"TXN-{case_id}-01"},
            {"from": f"CUST-{case_id}", "rel": "OWNS", "to": f"CARD-{case_id}"}
        ]
    }

async def _mock_fetch_case_subgraph(case_id: str) -> Dict[str, Any]:
    if case_id == "HHG-003":
        return _HHG003_SUBGRAPH
    elif case_id.startswith("NONEXISTENT"):
        return {"entities": {}, "relationships": []}
    return _get_generic_subgraph(case_id)

async def _mock_get_vertex(vertex_type: str, vertex_id: str) -> Optional[Dict[str, Any]]:
    if vertex_type == "ClosedCase":
        if vertex_id == "HHG-003":
            return {"id": "HHG-003", "case_id": "HHG-003", "status": "UNDER_INVESTIGATION", "verdict": "NEEDS_REVIEW"}
        elif vertex_id.startswith("HHG-"):
            return {"id": vertex_id, "case_id": vertex_id, "status": "CLEARED", "verdict": "APPROVED"}
        return None
    elif vertex_type == "Transaction":
        if vertex_id == "3530164":
            return {"id": "3530164", "TransactionID": "3530164", "amount": 49.0, "status": "FLAGGED", "risk_score": 0.4, "timestamp": "2016-12-10 15:01:21", "channel": "in_person"}
        elif vertex_id.startswith("TXN-"):
            return {"id": vertex_id, "TransactionID": vertex_id, "amount": 100.0, "status": "APPROVED", "risk_score": 0.05}
        return None
    elif vertex_type == "Customer":
        if vertex_id == "C08623":
            return {"id": "C08623", "customer_id": "C08623", "name": "Customer C08623", "risk_level": "NEUTRAL"}
        return {"id": vertex_id, "customer_id": vertex_id, "name": f"Customer {vertex_id}", "risk_level": "NEUTRAL"}
    elif vertex_type == "Card":
        if vertex_id == "19739":
            return {"id": "19739", "card_id": "19739", "brand": "Visa"}
        return {"id": vertex_id, "card_id": vertex_id, "brand": "Visa"}
    elif vertex_type == "EvidenceRequest":
        if vertex_id == "ER-HHG-003-001":
            return {
                "id": "ER-HHG-003-001",
                "request_id": "ER-HHG-003-001",
                "case_id": "HHG-003",
                "transaction_id": "3530164",
                "request_type": "customer_transaction_confirmation",
                "status": "pending",
                "request_text": "Confirm whether you made the $49.00 transaction."
            }
        return None
    return None

async def _mock_get_edges(source_type: str, source_id: str, edge_type: str, target_type: Optional[str] = None) -> List[Dict[str, Any]]:
    if source_type == "ClosedCase" and source_id == "HHG-003" and edge_type == "INVOLVES":
        return [{"to_id": "3530164"}]
    if source_type == "Transaction" and source_id == "3530164" and edge_type == "MADE":
        return [{"to_id": "19739"}]
    if source_type == "Card" and source_id == "19739" and edge_type == "reverse_OWNS":
        return [{"to_id": "C08623"}]
    if source_type == "ClosedCase" and source_id == "HHG-003" and edge_type == "reverse_FOR_CASE":
        return [{"to_id": "ER-HHG-003-001"}]
    return []

async def _mock_get_valid_token(client: Any = None) -> str:
    return "mock-test-token-12345"

async def _mock_run_query(query_name: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    if query_name == "hhg003_policy_decision":
        return {
            "results": [
                {
                    "cases": [{"v_id": "HHG-003", "attributes": {"status": "UNDER_INVESTIGATION", "verdict": "NEEDS_REVIEW"}}],
                    "transactions": [{"v_id": "3530164", "attributes": {"amount": 49.0, "status": "FLAGGED", "risk_score": 0.4}}],
                    "pending_evidence": [{"v_id": "ER-HHG-003-001", "attributes": {"case_id": "HHG-003", "status": "pending"}}]
                }
            ]
        }
    return {"results": []}

@pytest.fixture(autouse=True)
def mock_tigergraph_for_tests(monkeypatch):
    """
    Autouse fixture mocking TigerGraph RESTPP calls for all backend unit tests.
    Ensures tests run deterministically offline while strictly maintaining case isolation rules.
    """
    monkeypatch.setattr(tigergraph_service, "get_valid_token", _mock_get_valid_token)
    monkeypatch.setattr(tigergraph_service, "fetch_case_subgraph", _mock_fetch_case_subgraph)
    monkeypatch.setattr(tigergraph_service, "get_vertex", _mock_get_vertex)
    monkeypatch.setattr(tigergraph_service, "get_edges", _mock_get_edges)
    monkeypatch.setattr(tigergraph_service, "run_query", _mock_run_query)
