import logging
from typing import Dict, Any, List, Optional
from app.services.tigergraph import tigergraph_service

logger = logging.getLogger(__name__)

def is_valid_transaction(txn: Optional[Dict[str, Any]]) -> bool:
    """
    Validates if a transaction vertex is properly formed.
    Filters out malformed historical transactions (missing ID, non-positive or null amount, corrupted status).
    """
    if not txn or not isinstance(txn, dict):
        return False

    txn_id = txn.get("id") or txn.get("transaction_id")
    if not txn_id:
        return False

    amount = txn.get("amount")
    if amount is None or not isinstance(amount, (int, float)) or amount <= 0:
        return False

    status = txn.get("status")
    if status == "CORRUPTED" or status is None:
        return False

    return True

async def get_case(case_id: str) -> Optional[Dict[str, Any]]:
    """
    1. Retrieve details for a single investigation case by ID.
    """
    if not case_id:
        return None
    
    case_data = await tigergraph_service.get_vertex("ClosedCase", case_id)
    if case_data:
        return case_data
    
    # Fallback to sub-graph lookup if live RESTPP vertex endpoint is unconfigured
    graph = await tigergraph_service.fetch_case_subgraph(case_id)
    cases = graph.get("entities", {}).get("ClosedCase", [])
    for c in cases:
        if c.get("id") == case_id:
            return c
    return None

async def get_case_transactions(case_id: str) -> List[Dict[str, Any]]:
    """
    2. Retrieve transactions linked to a case (ClosedCase -> INVOLVES -> Transaction).
    Filters out malformed transaction vertices.
    """
    if not case_id:
        return []

    graph = await tigergraph_service.fetch_case_subgraph(case_id)
    entities = graph.get("entities", {}).get("Transaction", [])
    relationships = graph.get("relationships", [])

    # Find transaction IDs connected to case_id via INVOLVES
    linked_txn_ids = {
        rel["to"] for rel in relationships 
        if rel.get("from") == case_id and rel.get("rel") == "INVOLVES"
    }

    valid_txns = []
    for txn in entities:
        txn_id = txn.get("id")
        if (not linked_txn_ids or txn_id in linked_txn_ids) and is_valid_transaction(txn):
            valid_txns.append(txn)

    return valid_txns

async def get_transaction(transaction_id: str) -> Optional[Dict[str, Any]]:
    """
    3. Retrieve details for a single transaction by ID.
    Filters out malformed transactions.
    """
    if not transaction_id:
        return None

    txn = await tigergraph_service.get_vertex("Transaction", transaction_id)
    if txn and is_valid_transaction(txn):
        return txn

    # Fallback graph search
    case_id = transaction_id.split("-")[1] if "-" in transaction_id else transaction_id
    graph = await tigergraph_service.fetch_case_subgraph(case_id)
    txns = graph.get("entities", {}).get("Transaction", [])
    for t in txns:
        if t.get("id") == transaction_id and is_valid_transaction(t):
            return t

    return None

async def get_transaction_card(transaction_id: str) -> Optional[Dict[str, Any]]:
    """
    4. Retrieve the card associated with a transaction (Card -> MADE -> Transaction).
    """
    if not transaction_id:
        return None

    case_id = transaction_id.split("-")[1] if "-" in transaction_id else transaction_id
    graph = await tigergraph_service.fetch_case_subgraph(case_id)
    relationships = graph.get("relationships", [])
    cards = graph.get("entities", {}).get("Card", [])

    # Find card that MADE this transaction
    card_id = None
    for rel in relationships:
        if rel.get("to") == transaction_id and rel.get("rel") == "MADE":
            card_id = rel.get("from")
            break

    if card_id:
        for card in cards:
            if card.get("id") == card_id:
                return card

    # Fallback to first available card if relationships not explicitly present
    return cards[0] if cards else None

async def get_customer(customer_id: str) -> Optional[Dict[str, Any]]:
    """
    5. Retrieve customer details by customer ID.
    """
    if not customer_id:
        return None

    cust = await tigergraph_service.get_vertex("Customer", customer_id)
    if cust:
        return cust

    # Fallback graph search
    graph = await tigergraph_service.fetch_case_subgraph(customer_id)
    customers = graph.get("entities", {}).get("Customer", [])
    for c in customers:
        if c.get("id") == customer_id:
            return c
    return customers[0] if customers else None

async def get_customer_cards(customer_id: str) -> List[Dict[str, Any]]:
    """
    6. Retrieve cards owned by a customer (Customer -> OWNS -> Card).
    """
    if not customer_id:
        return []

    graph = await tigergraph_service.fetch_case_subgraph(customer_id)
    relationships = graph.get("relationships", [])
    cards = graph.get("entities", {}).get("Card", [])

    owned_card_ids = {
        rel["to"] for rel in relationships 
        if rel.get("from") == customer_id and rel.get("rel") == "OWNS"
    }

    if owned_card_ids:
        return [c for c in cards if c.get("id") in owned_card_ids]
    return cards

async def get_card_transactions(card_id: str) -> List[Dict[str, Any]]:
    """
    7. Retrieve transactions made using a specific card (Card -> MADE -> Transaction).
    Filters out malformed transactions.
    """
    if not card_id:
        return []

    graph = await tigergraph_service.fetch_case_subgraph(card_id)
    relationships = graph.get("relationships", [])
    txns = graph.get("entities", {}).get("Transaction", [])

    made_txn_ids = {
        rel["to"] for rel in relationships 
        if rel.get("from") == card_id and rel.get("rel") == "MADE"
    }

    matched_txns = []
    for t in txns:
        if (not made_txn_ids or t.get("id") in made_txn_ids) and is_valid_transaction(t):
            matched_txns.append(t)

    return matched_txns

async def get_transaction_devices(transaction_ids: List[str]) -> List[Dict[str, Any]]:
    """
    8. Retrieve device profiles linked to transactions (Transaction -> FROM_DEVICE -> DeviceProfile).
    """
    if not transaction_ids:
        return []

    devices = []
    seen_ids = set()

    for txn_id in transaction_ids:
        case_id = txn_id.split("-")[1] if "-" in txn_id else txn_id
        graph = await tigergraph_service.fetch_case_subgraph(case_id)
        relationships = graph.get("relationships", [])
        dev_entities = graph.get("entities", {}).get("DeviceProfile", [])

        target_dev_ids = {
            rel["to"] for rel in relationships 
            if rel.get("from") == txn_id and rel.get("rel") == "FROM_DEVICE"
        }

        for d in dev_entities:
            d_id = d.get("id")
            if (not target_dev_ids or d_id in target_dev_ids) and d_id not in seen_ids:
                seen_ids.add(d_id)
                devices.append(d)

    return devices

async def get_transaction_regions(transaction_ids: List[str]) -> List[Dict[str, Any]]:
    """
    9. Retrieve billing regions linked to transactions (Transaction -> BILLED_IN -> BillingRegion).
    """
    if not transaction_ids:
        return []

    regions = []
    seen_ids = set()

    for txn_id in transaction_ids:
        case_id = txn_id.split("-")[1] if "-" in txn_id else txn_id
        graph = await tigergraph_service.fetch_case_subgraph(case_id)
        relationships = graph.get("relationships", [])
        region_entities = graph.get("entities", {}).get("BillingRegion", [])

        target_region_ids = {
            rel["to"] for rel in relationships 
            if rel.get("from") == txn_id and rel.get("rel") == "BILLED_IN"
        }

        for r in region_entities:
            r_id = r.get("id")
            if (not target_region_ids or r_id in target_region_ids) and r_id not in seen_ids:
                seen_ids.add(r_id)
                regions.append(r)

    return regions

async def get_transaction_email_domains(transaction_ids: List[str]) -> List[Dict[str, Any]]:
    """
    10. Retrieve email domains linked to transactions (Transaction -> PURCHASER_EMAIL -> EmailDomain).
    """
    if not transaction_ids:
        return []

    domains = []
    seen_ids = set()

    for txn_id in transaction_ids:
        case_id = txn_id.split("-")[1] if "-" in txn_id else txn_id
        graph = await tigergraph_service.fetch_case_subgraph(case_id)
        relationships = graph.get("relationships", [])
        domain_entities = graph.get("entities", {}).get("EmailDomain", [])

        target_domain_ids = {
            rel["to"] for rel in relationships 
            if rel.get("from") == txn_id and rel.get("rel") == "PURCHASER_EMAIL"
        }

        for dom in domain_entities:
            dom_id = dom.get("id")
            if (not target_domain_ids or dom_id in target_domain_ids) and dom_id not in seen_ids:
                seen_ids.add(dom_id)
                domains.append(dom)

    return domains

async def get_connected_cases(card_ids: List[str]) -> List[Dict[str, Any]]:
    """
    11. Retrieve connected closed cases linked to cards (ClosedCase -> CONNECTED_TO -> Card).
    """
    if not card_ids:
        return []

    connected_cases = []
    seen_ids = set()

    for card_id in card_ids:
        graph = await tigergraph_service.fetch_case_subgraph(card_id)
        relationships = graph.get("relationships", [])
        cases = graph.get("entities", {}).get("ClosedCase", [])

        target_case_ids = {
            rel["from"] for rel in relationships 
            if rel.get("to") == card_id and rel.get("rel") == "CONNECTED_TO"
        }

        for c in cases:
            c_id = c.get("id")
            if (not target_case_ids or c_id in target_case_ids) and c_id not in seen_ids:
                seen_ids.add(c_id)
                connected_cases.append(c)

    return connected_cases

async def get_evidence_requests(case_id: str) -> List[Dict[str, Any]]:
    """
    12. Retrieve evidence requests submitted for a case (EvidenceRequest -> FOR_CASE -> ClosedCase).
    """
    if not case_id:
        return []

    graph = await tigergraph_service.fetch_case_subgraph(case_id)
    relationships = graph.get("relationships", [])
    evidence_reqs = graph.get("entities", {}).get("EvidenceRequest", [])

    target_req_ids = {
        rel["from"] for rel in relationships 
        if rel.get("to") == case_id and rel.get("rel") == "FOR_CASE"
    }

    matched_reqs = []
    for req in evidence_reqs:
        req_id = req.get("id")
        if (not target_req_ids or req_id in target_req_ids) or req.get("case_id") == case_id:
            matched_reqs.append(req)

    return matched_reqs


class TigerGraphInvestigatorTools:
    """
    Wrapper class providing access to all 12 TigerGraph investigation tools.
    """

    get_case = staticmethod(get_case)
    get_case_transactions = staticmethod(get_case_transactions)
    get_transaction = staticmethod(get_transaction)
    get_transaction_card = staticmethod(get_transaction_card)
    get_customer = staticmethod(get_customer)
    get_customer_cards = staticmethod(get_customer_cards)
    get_card_transactions = staticmethod(get_card_transactions)
    get_transaction_devices = staticmethod(get_transaction_devices)
    get_transaction_regions = staticmethod(get_transaction_regions)
    get_transaction_email_domains = staticmethod(get_transaction_email_domains)
    get_connected_cases = staticmethod(get_connected_cases)
    get_evidence_requests = staticmethod(get_evidence_requests)

investigation_tools = TigerGraphInvestigatorTools()
