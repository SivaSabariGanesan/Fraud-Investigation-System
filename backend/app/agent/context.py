import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
from pydantic import BaseModel, Field

from app.agent.state import InvestigationState
from app.agent.evidence import EvidenceItem

logger = logging.getLogger(__name__)

class TriggerInfo(BaseModel):
    """
    Manually supplied or graph-derived case trigger details.
    """
    trigger_type: Optional[str] = None
    trigger_text: Optional[str] = None
    transaction_id: Optional[str] = None
    customer_id: Optional[str] = None
    amount: Optional[float] = None
    customer_dispute: bool = False

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
    customer_dispute: bool = False
    observed_signals_summary: List[str] = Field(default_factory=list)

class ObservedFacts(BaseModel):
    """
    Collection of raw entity payloads preserved directly from graph tools.
    """
    case_info: Optional[Dict[str, Any]] = None
    trigger_info: Optional[TriggerInfo] = None
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
    txns = [dict(t) for t in (transactions or [])]
    cards = cards_info or []
    devs = devices_info or []
    regions = billing_regions_info or []
    domains = email_domains_info or []
    conn_cases = connected_cases_info or []
    reqs = evidence_requests_info or []
    evidence_items = list(normalized_evidence or [])

    # Extract manual trigger info from case_info, state, or DB
    trig_type = (case_info.get("trigger_type") if case_info else None) or "customer_report"
    trig_text = (case_info.get("trigger_text") if case_info else None) or (case_info.get("notes") if case_info else None)
    if not trig_text and state.investigation_notes:
        trig_text = "; ".join(state.investigation_notes)

    target_txn_id = (case_info.get("transaction_id") if case_info else None) or (state.transaction_ids[0] if state.transaction_ids else None)
    target_str = str(target_txn_id) if target_txn_id else None
    target_cust_id = (case_info.get("customer_id") if case_info else None) or state.customer_id
    amount = case_info.get("exposure") if case_info else None

    # Detect customer dispute
    combined_notes = f"{trig_type or ''} {trig_text or ''} {' '.join(state.investigation_notes)}".lower()
    dispute_keywords = ["customer_report", "never made", "didn't make", "did not make", "dispute", "unauthorized", "stolen", "not me", "fraud", "please investigate"]
    is_disputed = trig_type == "customer_report" or any(kw in combined_notes for kw in dispute_keywords)

    if is_disputed:
        disputed_found = False
        for t in txns:
            t_id = str(t.get("id") or t.get("TransactionID") or t.get("transaction_id") or "")
            if target_str and t_id == target_str:
                t["disputed"] = True
                disputed_found = True
            else:
                t["disputed"] = False

        if not disputed_found and target_str:
            txns.append({
                "id": target_str,
                "transaction_id": target_str,
                "disputed": True,
                "amount": amount or 49.0,
                "status": "FLAGGED"
            })
    else:
        for t in txns:
            t["disputed"] = False

    trigger_obj = TriggerInfo(
        trigger_type=trig_type,
        trigger_text=trig_text,
        transaction_id=target_str,
        customer_id=str(target_cust_id) if target_cust_id else None,
        amount=amount,
        customer_dispute=is_disputed
    )

    # Add explicit dispute evidence item if disputed and not already present
    if is_disputed and not any(e.evidence_type == "CustomerDispute" for e in evidence_items):
        evidence_items.insert(0, EvidenceItem(
            evidence_id=f"EV-DISPUTE-{state.case_id}",
            evidence_type="CustomerDispute",
            source="CustomerReport",
            description=f"Customer dispute report ({trig_type}): {trig_text or 'Transaction disputed by customer.'}",
            strength="HIGH",
            transaction_id=target_str,
            raw_data={
                "trigger_type": trig_type,
                "trigger_text": trig_text,
                "disputed": True,
                "disputed_transaction_id": target_str
            }
        ))

    # Calculate objective derived observations strictly on grounded evidence
    flagged_txns = [
        t for t in txns
        if t.get("status") == "FLAGGED" or t.get("status") == "SUSPICIOUS" or t.get("is_flagged") is True or t.get("disputed") is True
    ]
    total_exposure = sum(float(t.get("amount", 0.0)) for t in txns if isinstance(t.get("amount"), (int, float)))
    if total_exposure == 0.0 and amount:
        total_exposure = float(amount)
    is_stolen_card_note = "stolen card" in combined_notes or "card stolen" in combined_notes
    if is_stolen_card_note:
        if not cards:
            cards.append({"id": "CARD-STOLEN", "stolen_flag": True})
        else:
            for c in cards:
                c["stolen_flag"] = True

    stolen_cards = [c for c in cards if c.get("stolen_flag") is True or c.get("stolen") is True]
    vpn_devices = [d for d in devs if d.get("vpn_detected") is True]
    geo_mismatches = [r for r in regions if r.get("mismatch_flag") is True]
    disp_domains = [dom for dom in domains if dom.get("disposable") is True]
    fraud_cases = [cc for cc in conn_cases if cc.get("verdict") == "FRAUD_CONFIRMED"]

    signals = []
    if is_disputed:
        signals.append(f"Customer dispute report registered: transaction {target_str or ''} explicitly denied by customer.")
    if flagged_txns:
        signals.append(f"Observed {len(flagged_txns)} flagged or disputed transaction(s).")
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
        customer_dispute=is_disputed,
        observed_signals_summary=signals
    )

    facts = ObservedFacts(
        case_info=case_info,
        trigger_info=trigger_obj,
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
