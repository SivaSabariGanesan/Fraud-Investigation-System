import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

class EvidenceItem(BaseModel):
    """
    Normalized, structured evidence item collected from graph tools.
    Preserves raw data and provides clear, un-interpreted observed facts.
    """
    evidence_id: str
    evidence_type: str  # Transaction, Customer, Card, DeviceProfile, BillingRegion, EmailDomain, EvidenceRequest
    source: str = "TigerGraph"
    description: str
    related_entity: Optional[str] = None
    transaction_id: Optional[str] = None
    card_id: Optional[str] = None
    strength: Optional[str] = "NEUTRAL"  # HIGH, MEDIUM, LOW, NEUTRAL (signal strength if supported by data)
    raw_data: Dict[str, Any] = Field(default_factory=dict)
    timestamp: Optional[Any] = None

def normalize_case_evidence(case_data: Optional[Dict[str, Any]]) -> Optional[EvidenceItem]:
    """Normalize raw ClosedCase vertex data into an EvidenceItem."""
    if not case_data or not isinstance(case_data, dict):
        return None
    
    case_id = case_data.get("id") or case_data.get("case_id", "UNKNOWN_CASE")
    status = case_data.get("status", "UNKNOWN")
    verdict = case_data.get("verdict", "UNSPECIFIED")
    
    return EvidenceItem(
        evidence_id=f"EV-CASE-{case_id}",
        evidence_type="ClosedCase",
        source="TigerGraph",
        description=f"ClosedCase record '{case_id}' with status '{status}' and verdict '{verdict}'.",
        related_entity=case_id,
        raw_data=case_data
    )

def normalize_transaction_evidence(txn: Optional[Dict[str, Any]], is_related: bool = False) -> Optional[EvidenceItem]:
    """Normalize raw Transaction vertex data into an EvidenceItem."""
    if not txn or not isinstance(txn, dict):
        return None

    txn_id = txn.get("id") or txn.get("transaction_id", "UNKNOWN_TXN")
    amount = txn.get("amount", 0.0)
    currency = txn.get("currency", "USD")
    status = txn.get("status", "UNKNOWN")

    # Preserve explicit transaction timestamp from TigerGraph ts attribute
    raw_ts = txn.get("ts") or txn.get("timestamp") or txn.get("created_at")
    formatted_ts = None
    if raw_ts is not None:
        if isinstance(raw_ts, (int, float)):
            try:
                formatted_ts = datetime.fromtimestamp(raw_ts, tz=timezone.utc).isoformat()
            except Exception:
                formatted_ts = str(raw_ts)
        else:
            formatted_ts = str(raw_ts)

    ev_type = "RelatedTransaction" if is_related else "Transaction"
    desc = f"Transaction '{txn_id}' observed: amount={amount} {currency}, status='{status}'."

    return EvidenceItem(
        evidence_id=f"EV-TXN-{txn_id}",
        evidence_type=ev_type,
        source="TigerGraph",
        description=desc,
        transaction_id=txn_id,
        timestamp=formatted_ts,
        raw_data=txn
    )

def normalize_customer_evidence(cust: Optional[Dict[str, Any]]) -> Optional[EvidenceItem]:
    """Normalize raw Customer vertex data into an EvidenceItem."""
    if not cust or not isinstance(cust, dict):
        return None

    cust_id = cust.get("id") or cust.get("customer_id", "UNKNOWN_CUST")
    name = cust.get("name", "UNNAMED")
    risk_level = cust.get("risk_level", "UNSPECIFIED")

    return EvidenceItem(
        evidence_id=f"EV-CUST-{cust_id}",
        evidence_type="Customer",
        source="TigerGraph",
        description=f"Customer record '{cust_id}' ({name}) observed with recorded risk_level='{risk_level}'.",
        related_entity=cust_id,
        strength="HIGH" if risk_level == "HIGH" else "NEUTRAL",
        raw_data=cust
    )

def normalize_card_evidence(card: Optional[Dict[str, Any]]) -> Optional[EvidenceItem]:
    """Normalize raw Card vertex data into an EvidenceItem."""
    if not card or not isinstance(card, dict):
        return None

    card_id = card.get("id") or card.get("card_id", "UNKNOWN_CARD")
    brand = card.get("brand", "UNKNOWN")
    country = card.get("country", "UNKNOWN")
    stolen_flag = card.get("stolen_flag", False)

    signal = "HIGH" if stolen_flag else "NEUTRAL"
    desc = f"Card record '{card_id}' ({brand}, {country}) observed. Stolen flag set to {stolen_flag}."

    return EvidenceItem(
        evidence_id=f"EV-CARD-{card_id}",
        evidence_type="card",
        source="TigerGraph",
        description=desc,
        card_id=card_id,
        strength=signal,
        raw_data=card
    )

def normalize_device_evidence(dev: Optional[Dict[str, Any]], transaction_id: Optional[str] = None) -> Optional[EvidenceItem]:
    """Normalize raw DeviceProfile vertex data into an EvidenceItem."""
    if not dev or not isinstance(dev, dict):
        return None

    dev_id = dev.get("id") or dev.get("device_id", "UNKNOWN_DEV")
    os_name = dev.get("os", "UNKNOWN_OS")
    vpn_detected = dev.get("vpn_detected", False)

    signal = "HIGH" if vpn_detected else "NEUTRAL"
    desc = f"DeviceProfile '{dev_id}' (OS: {os_name}) observed. VPN/Proxy detected: {vpn_detected}."

    return EvidenceItem(
        evidence_id=f"EV-DEV-{dev_id}",
        evidence_type="device",
        source="TigerGraph",
        description=desc,
        related_entity=dev_id,
        transaction_id=transaction_id,
        strength=signal,
        raw_data=dev
    )

def normalize_region_evidence(region: Optional[Dict[str, Any]], transaction_id: Optional[str] = None) -> Optional[EvidenceItem]:
    """Normalize raw BillingRegion vertex data into an EvidenceItem."""
    if not region or not isinstance(region, dict):
        return None

    reg_id = region.get("id") or region.get("region_id", "UNKNOWN_REG")
    country_code = region.get("country_code", "UNKNOWN")
    mismatch_flag = region.get("mismatch_flag", False)

    signal = "MEDIUM" if mismatch_flag else "NEUTRAL"
    desc = f"BillingRegion '{reg_id}' (Country: {country_code}) observed. Regional mismatch flag: {mismatch_flag}."

    return EvidenceItem(
        evidence_id=f"EV-REG-{reg_id}",
        evidence_type="billing_region",
        source="TigerGraph",
        description=desc,
        related_entity=reg_id,
        transaction_id=transaction_id,
        strength=signal,
        raw_data=region
    )

def normalize_email_domain_evidence(domain: Optional[Dict[str, Any]], transaction_id: Optional[str] = None) -> Optional[EvidenceItem]:
    """Normalize raw EmailDomain vertex data into an EvidenceItem."""
    if not domain or not isinstance(domain, dict):
        return None

    dom_id = domain.get("id") or domain.get("domain_id", "UNKNOWN_DOM")
    disposable = domain.get("disposable", False)

    signal = "MEDIUM" if disposable else "NEUTRAL"
    desc = f"EmailDomain '{dom_id}' observed. Disposable email service domain: {disposable}."

    return EvidenceItem(
        evidence_id=f"EV-DOM-{dom_id}",
        evidence_type="email_domain",
        source="TigerGraph",
        description=desc,
        related_entity=dom_id,
        transaction_id=transaction_id,
        strength=signal,
        raw_data=domain
    )

def normalize_related_case_evidence(connected_case: Optional[Dict[str, Any]], card_id: Optional[str] = None) -> Optional[EvidenceItem]:
    """Normalize connected historical ClosedCase vertex into an EvidenceItem."""
    if not connected_case or not isinstance(connected_case, dict):
        return None

    c_id = connected_case.get("id") or connected_case.get("case_id", "UNKNOWN_CASE")
    verdict = connected_case.get("verdict", "UNSPECIFIED")
    fraud_type = connected_case.get("fraud_type", "UNSPECIFIED")

    signal = "HIGH" if verdict == "FRAUD_CONFIRMED" else "NEUTRAL"
    desc = f"Connected ClosedCase '{c_id}' linked to card '{card_id}' with verdict='{verdict}' and type='{fraud_type}'."

    return EvidenceItem(
        evidence_id=f"EV-RELCASE-{c_id}",
        evidence_type="related_case",
        source="TigerGraph",
        description=desc,
        related_entity=c_id,
        card_id=card_id,
        strength=signal,
        raw_data=connected_case
    )

def normalize_evidence_request_evidence(req: Optional[Dict[str, Any]]) -> Optional[EvidenceItem]:
    """Normalize raw EvidenceRequest vertex data into an EvidenceItem."""
    if not req or not isinstance(req, dict):
        return None

    req_id = req.get("id") or req.get("request_id", "UNKNOWN_REQ")
    req_type = req.get("type", "UNSPECIFIED")
    status = req.get("status", "UNSPECIFIED")

    desc = f"EvidenceRequest '{req_id}' (Type: {req_type}) observed with status='{status}'."

    return EvidenceItem(
        evidence_id=f"EV-REQ-{req_id}",
        evidence_type="evidence_request",
        source="TigerGraph",
        description=desc,
        related_entity=req_id,
        raw_data=req
    )

def collect_and_normalize_all(
    case_data: Optional[Dict[str, Any]] = None,
    transactions: Optional[List[Dict[str, Any]]] = None,
    customer: Optional[Dict[str, Any]] = None,
    cards: Optional[List[Dict[str, Any]]] = None,
    devices: Optional[List[Dict[str, Any]]] = None,
    regions: Optional[List[Dict[str, Any]]] = None,
    domains: Optional[List[Dict[str, Any]]] = None,
    connected_cases: Optional[List[Dict[str, Any]]] = None,
    evidence_requests: Optional[List[Dict[str, Any]]] = None,
) -> List[EvidenceItem]:
    """
    Convenience orchestrator function to normalize raw tool query results into a list of EvidenceItems.
    """
    evidence_list: List[EvidenceItem] = []

    if case_data:
        item = normalize_case_evidence(case_data)
        if item:
            evidence_list.append(item)

    if customer:
        item = normalize_customer_evidence(customer)
        if item:
            evidence_list.append(item)

    if cards:
        for card in cards:
            item = normalize_card_evidence(card)
            if item:
                evidence_list.append(item)

    if transactions:
        for txn in transactions:
            item = normalize_transaction_evidence(txn)
            if item:
                evidence_list.append(item)

    if devices:
        for dev in devices:
            item = normalize_device_evidence(dev)
            if item:
                evidence_list.append(item)

    if regions:
        for reg in regions:
            item = normalize_region_evidence(reg)
            if item:
                evidence_list.append(item)

    if domains:
        for dom in domains:
            item = normalize_email_domain_evidence(dom)
            if item:
                evidence_list.append(item)

    if connected_cases:
        for cc in connected_cases:
            item = normalize_related_case_evidence(cc)
            if item:
                evidence_list.append(item)

    if evidence_requests:
        for req in evidence_requests:
            item = normalize_evidence_request_evidence(req)
            if item:
                evidence_list.append(item)

    return evidence_list
