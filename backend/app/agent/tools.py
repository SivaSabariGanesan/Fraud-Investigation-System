import logging
import asyncio
from typing import Dict, Any, List, Optional
from app.services.tigergraph import tigergraph_service, TigerGraphConnectionError

logger = logging.getLogger(__name__)

def is_valid_transaction(txn: Optional[Dict[str, Any]]) -> bool:
    """
    Validates if a transaction vertex is properly formed.
    Filters out malformed historical transactions (missing ID, non-positive or null amount).
    """
    if not txn or not isinstance(txn, dict):
        return False

    txn_id = txn.get("id") or txn.get("TransactionID") or txn.get("transaction_id")
    if not txn_id:
        return False

    amount = txn.get("amount")
    if amount is None or not isinstance(amount, (int, float)) or amount <= 0:
        return False

    status = txn.get("status")
    if status == "CORRUPTED":
        return False

    return True

async def get_case(case_id: str) -> Optional[Dict[str, Any]]:
    """
    1. Retrieve details for a single investigation case by ID from real FraudGraph.
    """
    if not case_id:
        return None

    # Check vertex directly
    case_v = await tigergraph_service.get_vertex("ClosedCase", case_id)
    if case_v:
        return case_v

    # Fallback to case subgraph execution
    subgraph = await tigergraph_service.fetch_case_subgraph(case_id)
    cases = subgraph.get("entities", {}).get("ClosedCase", [])
    for c in cases:
        if c.get("id") == case_id or c.get("case_id") == case_id:
            return c
    return None

async def get_case_transactions(case_id: str) -> List[Dict[str, Any]]:
    """
    2. Retrieve transactions linked to a case (ClosedCase -> INVOLVES -> Transaction).
    Filters out malformed transaction vertices.
    """
    if not case_id:
        return []

    subgraph = await tigergraph_service.fetch_case_subgraph(case_id)
    txns = subgraph.get("entities", {}).get("Transaction", [])
    
    # Filter valid positive transactions
    return [t for t in txns if is_valid_transaction(t)]

async def get_transaction(transaction_id: str) -> Optional[Dict[str, Any]]:
    """
    3. Retrieve details for a single transaction by ID from real FraudGraph.
    """
    if not transaction_id:
        return None

    txn = await tigergraph_service.get_vertex("Transaction", transaction_id)
    if txn and is_valid_transaction(txn):
        return txn

    return None

async def get_transaction_card(transaction_id: str) -> Optional[Dict[str, Any]]:
    """
    4. Retrieve card associated with a transaction (Transaction -> MADE -> Card).
    """
    if not transaction_id:
        return None

    edges = await tigergraph_service.get_edges("Transaction", transaction_id, "MADE")
    for edge in edges:
        card_id = edge.get("to_id")
        if card_id:
            card_v = await tigergraph_service.get_vertex("Card", card_id)
            if card_v:
                return card_v

    return None

async def get_customer(customer_id: str) -> Optional[Dict[str, Any]]:
    """
    5. Retrieve customer details by customer ID from real FraudGraph.
    """
    if not customer_id:
        return None

    return await tigergraph_service.get_vertex("Customer", customer_id)

async def get_customer_cards(customer_id: str) -> List[Dict[str, Any]]:
    """
    6. Retrieve cards owned by a customer (Customer -> OWNS -> Card).
    """
    if not customer_id:
        return []

    edges = await tigergraph_service.get_edges("Customer", customer_id, "OWNS")
    if not edges:
        return []

    async def _fetch_card(c_id: str):
        return await tigergraph_service.get_vertex("Card", c_id)

    card_ids = [e.get("to_id") for e in edges if e.get("to_id")]
    results = await asyncio.gather(*[_fetch_card(cid) for cid in card_ids], return_exceptions=True)
    
    cards = []
    for r in results:
        if isinstance(r, dict) and r.get("id"):
            cards.append(r)
    return cards

async def get_card_transactions(card_id: str, limit: int = 10) -> List[Dict[str, Any]]:
    """
    7. Retrieve transactions made using a specific card (Card -> reverse_MADE -> Transaction).
    Filters out malformed transactions. Parallelizes fetches up to limit.
    """
    if not card_id:
        return []

    edges = await tigergraph_service.get_edges("Card", card_id, "reverse_MADE")
    if not edges:
        return []

    txn_ids = [e.get("to_id") for e in edges if e.get("to_id")][:limit]

    async def _fetch_txn(t_id: str):
        return await tigergraph_service.get_vertex("Transaction", t_id)

    results = await asyncio.gather(*[_fetch_txn(tid) for tid in txn_ids], return_exceptions=True)
    
    txns = []
    for r in results:
        if isinstance(r, dict) and is_valid_transaction(r):
            txns.append(r)
    return txns

async def get_transaction_devices(transaction_ids: List[str]) -> List[Dict[str, Any]]:
    """
    8. Retrieve device profiles linked to transactions (Transaction -> FROM_DEVICE -> DeviceProfile).
    """
    if not transaction_ids:
        return []

    async def _fetch_devs_for_txn(t_id: str):
        edges = await tigergraph_service.get_edges("Transaction", t_id, "FROM_DEVICE")
        devs = []
        for e in edges:
            d_id = e.get("to_id")
            if d_id:
                dv = await tigergraph_service.get_vertex("DeviceProfile", d_id)
                if dv:
                    devs.append(dv)
        return devs

    results = await asyncio.gather(*[_fetch_devs_for_txn(tid) for tid in transaction_ids], return_exceptions=True)
    
    devices = []
    seen_ids = set()
    for res in results:
        if isinstance(res, list):
            for dev in res:
                d_id = dev.get("id")
                if d_id and d_id not in seen_ids:
                    seen_ids.add(d_id)
                    devices.append(dev)

    return devices

async def get_transaction_regions(transaction_ids: List[str]) -> List[Dict[str, Any]]:
    """
    9. Retrieve billing regions linked to transactions (Transaction -> BILLED_IN -> BillingRegion).
    """
    if not transaction_ids:
        return []

    async def _fetch_regions_for_txn(t_id: str):
        edges = await tigergraph_service.get_edges("Transaction", t_id, "BILLED_IN")
        regs = []
        for e in edges:
            r_id = e.get("to_id")
            if r_id:
                rv = await tigergraph_service.get_vertex("BillingRegion", r_id)
                if rv:
                    regs.append(rv)
                else:
                    regs.append({"id": r_id, "region_id": r_id})
        return regs

    results = await asyncio.gather(*[_fetch_regions_for_txn(tid) for tid in transaction_ids], return_exceptions=True)
    
    regions = []
    seen_ids = set()
    for res in results:
        if isinstance(res, list):
            for reg in res:
                r_id = reg.get("id")
                if r_id and r_id not in seen_ids:
                    seen_ids.add(r_id)
                    regions.append(reg)

    return regions

async def get_transaction_email_domains(transaction_ids: List[str]) -> List[Dict[str, Any]]:
    """
    10. Retrieve email domains linked to transactions (Transaction -> PURCHASER_EMAIL -> EmailDomain).
    """
    if not transaction_ids:
        return []

    async def _fetch_domains_for_txn(t_id: str):
        edges = await tigergraph_service.get_edges("Transaction", t_id, "PURCHASER_EMAIL")
        doms = []
        for e in edges:
            d_id = e.get("to_id")
            if d_id:
                dv = await tigergraph_service.get_vertex("EmailDomain", d_id)
                if dv:
                    doms.append(dv)
                else:
                    doms.append({"id": d_id, "domain_name": d_id})
        return doms

    results = await asyncio.gather(*[_fetch_domains_for_txn(tid) for tid in transaction_ids], return_exceptions=True)
    
    domains = []
    seen_ids = set()
    for res in results:
        if isinstance(res, list):
            for dom in res:
                d_id = dom.get("id")
                if d_id and d_id not in seen_ids:
                    seen_ids.add(d_id)
                    domains.append(dom)

    return domains

async def get_connected_cases(card_ids: List[str]) -> List[Dict[str, Any]]:
    """
    11. Retrieve connected closed cases linked to cards (ClosedCase -> CONNECTED_TO -> Card).
    """
    if not card_ids:
        return []

    async def _fetch_cases_for_card(c_id: str):
        edges = await tigergraph_service.get_edges("Card", c_id, "reverse_CONNECTED_TO")
        cases = []
        for e in edges:
            cs_id = e.get("to_id")
            if cs_id:
                csv = await tigergraph_service.get_vertex("ClosedCase", cs_id)
                if csv:
                    cases.append(csv)
        return cases

    results = await asyncio.gather(*[_fetch_cases_for_card(cid) for cid in card_ids], return_exceptions=True)
    
    connected_cases = []
    seen_ids = set()
    for res in results:
        if isinstance(res, list):
            for cs in res:
                cs_id = cs.get("id")
                if cs_id and cs_id not in seen_ids:
                    seen_ids.add(cs_id)
                    connected_cases.append(cs)

    return connected_cases

async def get_evidence_requests(case_id: str) -> List[Dict[str, Any]]:
    """
    12. Retrieve evidence requests submitted for a case.
    """
    if not case_id:
        return []

    subgraph = await tigergraph_service.fetch_case_subgraph(case_id)
    evidence_reqs = subgraph.get("entities", {}).get("EvidenceRequest", [])
    if evidence_reqs:
        return evidence_reqs

    # Edge lookup fallback
    edges = await tigergraph_service.get_edges("ClosedCase", case_id, "reverse_FOR_CASE")
    reqs = []
    for edge in edges:
        req_id = edge.get("to_id")
        if req_id:
            req_v = await tigergraph_service.get_vertex("EvidenceRequest", req_id)
            if req_v:
                reqs.append(req_v)

    return reqs


class TigerGraphInvestigatorTools:
    """
    Wrapper class providing access to all 12 real TigerGraph investigation tools.
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
