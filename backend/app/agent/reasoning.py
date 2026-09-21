import logging
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

from app.agent.context import InvestigationContext
from app.agent.evidence import EvidenceItem

logger = logging.getLogger(__name__)

class InvestigationReasoningOutput(BaseModel):
    """
    Structured, machine-readable findings produced by the reasoning layer.
    Outputs factual evidence analysis without applying policy decisions or executing actions.
    """
    case_id: str
    key_findings: List[str] = Field(default_factory=list)
    observed_patterns: List[str] = Field(default_factory=list)
    supporting_evidence_ids: List[str] = Field(default_factory=list)
    contradictory_evidence: List[str] = Field(default_factory=list)
    missing_evidence: List[str] = Field(default_factory=list)
    uncertainty: List[str] = Field(default_factory=list)
    affected_transaction_ids: List[str] = Field(default_factory=list)
    potentially_connected_cards: List[str] = Field(default_factory=list)
    potentially_connected_devices: List[str] = Field(default_factory=list)
    exposure: float = 0.0
    preliminary_fraud_probability: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    customer_disputes_represented: List[str] = Field(default_factory=list)
    pending_evidence_requests: List[str] = Field(default_factory=list)
    analytical_summary: str = ""

def analyze_investigation_context(context: InvestigationContext) -> InvestigationReasoningOutput:
    """
    Analyzes an InvestigationContext to produce structured reasoning findings.
    Operates strictly as an analytical layer: does not execute policy actions (e.g. BLOCK_CARD)
    and does not write to TigerGraph or SQLite.
    """
    case_id = context.case_id
    facts = context.observed_facts
    derived = context.derived_observations
    evidence_items = context.normalized_evidence

    key_findings = []
    observed_patterns = []
    supporting_evidence_ids = []
    contradictory_evidence = []
    missing_evidence = []
    uncertainty = []
    customer_disputes = []
    pending_requests = []

    # Extract transaction IDs, card IDs, and device IDs from observed facts
    affected_txns = [t.get("id") for t in facts.transactions if t.get("id")]
    connected_cards = [c.get("id") for c in facts.cards_info if c.get("id")]
    connected_devs = [d.get("id") for d in facts.devices_info if d.get("id")]
    exposure = derived.total_exposure_amount

    # Process evidence items into supporting, contradictory, or missing categories
    for item in evidence_items:
        supporting_evidence_ids.append(item.evidence_id)

        if item.evidence_type == "card" and item.raw_data.get("stolen_flag") is True:
            key_findings.append(f"Card {item.card_id} is flagged as stolen in system records.")
            observed_patterns.append("Stolen Card Usage")

        elif item.evidence_type == "device" and item.raw_data.get("vpn_detected") is True:
            key_findings.append(f"Device Profile {item.related_entity} utilized VPN/Proxy during transaction.")
            observed_patterns.append("Device Spoofing / Anonymized Proxy")

        elif item.evidence_type == "billing_region" and item.raw_data.get("mismatch_flag") is True:
            key_findings.append(f"Billing Region {item.related_entity} indicates cross-border geographic mismatch.")
            observed_patterns.append("Geographic Mismatch")

        elif item.evidence_type == "email_domain" and item.raw_data.get("disposable") is True:
            key_findings.append(f"Email domain {item.related_entity} belongs to disposable email service.")
            observed_patterns.append("Disposable Communication Identity")

        elif item.evidence_type == "related_case" and item.raw_data.get("verdict") == "FRAUD_CONFIRMED":
            key_findings.append(f"Historical case {item.related_entity} confirmed fraud on linked entity.")
            observed_patterns.append("Historical Recurrent Fraud Link")

        elif item.evidence_type == "evidence_request":
            req_status = item.raw_data.get("status", "PENDING")
            if req_status in ("PENDING", "SUBMITTED"):
                pending_requests.append(f"EvidenceRequest {item.evidence_id} status is '{req_status}' - awaiting response.")
                uncertainty.append(f"Pending evidence request '{item.evidence_id}' has not been completed.")

    # Check for customer disputes in transaction or case data
    for txn in facts.transactions:
        if txn.get("disputed") is True or txn.get("status") == "DISPUTED":
            customer_disputes.append(f"Transaction {txn.get('id')} flagged as disputed by customer.")

    # Identify missing evidence / data gaps
    if not facts.customer_info:
        missing_evidence.append("Customer profile metadata is unlinked or missing from graph.")
    if not facts.devices_info:
        missing_evidence.append("No device fingerprint payload associated with current transaction(s).")
    if not facts.billing_regions_info:
        missing_evidence.append("Billing region geographic data is missing.")

    # Check for contradictory evidence (e.g. verified home device vs stolen card flag)
    clean_devices = [d for d in facts.devices_info if d.get("vpn_detected") is False]
    stolen_cards = [c for c in facts.cards_info if c.get("stolen_flag") is True]
    if clean_devices and stolen_cards:
        contradictory_evidence.append(
            "Transaction performed from non-VPN device, but card is flagged as stolen."
        )

    # Compute preliminary signal score (for investigation signal ranking, not a final policy verdict)
    signal_weights = 0
    total_checks = 4
    if derived.stolen_cards_count > 0:
        signal_weights += 1
    if derived.vpn_devices_count > 0:
        signal_weights += 1
    if derived.regional_mismatches_count > 0:
        signal_weights += 0.5
    if derived.disposable_email_domains_count > 0:
        signal_weights += 0.5
    if derived.historical_fraud_cases_count > 0:
        signal_weights += 1

    preliminary_score = min(1.0, round(signal_weights / total_checks, 2)) if total_checks > 0 else 0.0

    summary = (
        f"Analyzed {len(affected_txns)} transaction(s) totaling ${exposure:,.2f} USD exposure. "
        f"Identified {len(observed_patterns)} distinct pattern(s) across {len(supporting_evidence_ids)} evidence item(s). "
        f"Preliminary risk signal score: {preliminary_score:.0%}. Pending evidence requests: {len(pending_requests)}."
    )

    return InvestigationReasoningOutput(
        case_id=case_id,
        key_findings=key_findings,
        observed_patterns=list(set(observed_patterns)),
        supporting_evidence_ids=supporting_evidence_ids,
        contradictory_evidence=contradictory_evidence,
        missing_evidence=missing_evidence,
        uncertainty=uncertainty,
        affected_transaction_ids=affected_txns,
        potentially_connected_cards=connected_cards,
        potentially_connected_devices=connected_devs,
        exposure=exposure,
        preliminary_fraud_probability=preliminary_score,
        customer_disputes_represented=customer_disputes,
        pending_evidence_requests=pending_requests,
        analytical_summary=summary
    )
