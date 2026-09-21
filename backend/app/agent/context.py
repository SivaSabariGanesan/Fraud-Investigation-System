import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
from pydantic import BaseModel, Field

from app.agent.state import InvestigationState
from app.agent.evidence import EvidenceItem

logger = logging.getLogger(__name__)

class DerivedObservations(BaseModel):
    """
    Summary metrics and observable signals derived from raw evidence.
    Does NOT contain verdicts, policies, or final fraud decisions.
    """
    total_transactions_count: int = 0
    flagged_transactions_count: int = 0
    total_exposure_amount: float = 0.0
    stolen_cards_count: int = 0
    vpn_devices_count: int = 0
    regional_mismatches_count: int = 0
    disposable_email_domains_count: int = 0
    connected_closed_cases_count: int = 0
    historical_fraud_cases_count: int = 0
    observed_signals_summary: List[str] = Field(default_factory=list)

class ObservedFacts(BaseModel):
    """
    Collection of raw entity payloads preserved directly from graph tools.
    """
    case_info: Optional[Dict[str, Any]] = None
    transactions: List[Dict[str, Any]] = Field(default_factory=list)
    customer_info: Optional[Dict[str, Any]] = None
    cards_info: List[Dict[str, Any]] = Field(default_factory=list)
    devices_info: List[Dict[str, Any]] = Field(default_factory=list)
    billing_regions_info: List[Dict[str, Any]] = Field(default_factory=list)
    email_domains_info: List[Dict[str, Any]] = Field(default_factory=list)
    connected_cases_info: List[Dict[str, Any]] = Field(default_factory=list)
    evidence_requests_info: List[Dict[str, Any]] = Field(default_factory=list)

class InvestigationContext(BaseModel):
    """
    Complete consolidated context object prepared for the reasoning layer.
    Fully JSON-serializable.
    """
    case_id: str
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    state: InvestigationState
    observed_facts: ObservedFacts
    derived_observations: DerivedObservations
    normalized_evidence: List[EvidenceItem] = Field(default_factory=list)

def build_investigation_context(
    state: InvestigationState,
    case_info: Optional[Dict[str, Any]] = None,
    transactions: Optional[List[Dict[str, Any]]] = None,
    customer_info: Optional[Dict[str, Any]] = None,
    cards_info: Optional[List[Dict[str, Any]]] = None,
    devices_info: Optional[List[Dict[str, Any]]] = None,
    billing_regions_info: Optional[List[Dict[str, Any]]] = None,
    email_domains_info: Optional[List[Dict[str, Any]]] = None,
    connected_cases_info: Optional[List[Dict[str, Any]]] = None,
    evidence_requests_info: Optional[List[Dict[str, Any]]] = None,
    normalized_evidence: Optional[List[EvidenceItem]] = None,
) -> InvestigationContext:
    """
    Builds a unified InvestigationContext from investigation state, raw entity facts, and normalized evidence items.
    Computes objective derived metrics without making fraud verdicts or applying policy rules.
    """
    txns = transactions or []
    cards = cards_info or []
    devs = devices_info or []
    regions = billing_regions_info or []
    domains = email_domains_info or []
    conn_cases = connected_cases_info or []
    reqs = evidence_requests_info or []
    evidence_items = normalized_evidence or []

    # Calculate objective derived observations
    flagged_txns = [t for t in txns if t.get("status") == "FLAGGED"]
    total_exposure = sum(float(t.get("amount", 0.0)) for t in txns if isinstance(t.get("amount"), (int, float)))
    stolen_cards = [c for c in cards if c.get("stolen_flag") is True]
    vpn_devices = [d for d in devs if d.get("vpn_detected") is True]
    geo_mismatches = [r for r in regions if r.get("mismatch_flag") is True]
    disp_domains = [dom for dom in domains if dom.get("disposable") is True]
    fraud_cases = [cc for cc in conn_cases if cc.get("verdict") == "FRAUD_CONFIRMED"]

    signals = []
    if flagged_txns:
        signals.append(f"Observed {len(flagged_txns)} flagged transaction(s).")
    if stolen_cards:
        signals.append(f"Observed {len(stolen_cards)} card(s) with stolen_flag=True.")
    if vpn_devices:
        signals.append(f"Observed {len(vpn_devices)} device profile(s) with vpn_detected=True.")
    if geo_mismatches:
        signals.append(f"Observed {len(geo_mismatches)} billing region(s) with mismatch_flag=True.")
    if disp_domains:
        signals.append(f"Observed {len(disp_domains)} disposable email domain service(s).")
    if fraud_cases:
        signals.append(f"Observed {len(fraud_cases)} connected historical case(s) with FRAUD_CONFIRMED verdict.")

    derived = DerivedObservations(
        total_transactions_count=len(txns),
        flagged_transactions_count=len(flagged_txns),
        total_exposure_amount=total_exposure,
        stolen_cards_count=len(stolen_cards),
        vpn_devices_count=len(vpn_devices),
        regional_mismatches_count=len(geo_mismatches),
        disposable_email_domains_count=len(disp_domains),
        connected_closed_cases_count=len(conn_cases),
        historical_fraud_cases_count=len(fraud_cases),
        observed_signals_summary=signals
    )

    facts = ObservedFacts(
        case_info=case_info,
        transactions=txns,
        customer_info=customer_info,
        cards_info=cards,
        devices_info=devs,
        billing_regions_info=regions,
        email_domains_info=domains,
        connected_cases_info=conn_cases,
        evidence_requests_info=reqs,
    )

    return InvestigationContext(
        case_id=state.case_id,
        state=state,
        observed_facts=facts,
        derived_observations=derived,
        normalized_evidence=evidence_items,
    )
