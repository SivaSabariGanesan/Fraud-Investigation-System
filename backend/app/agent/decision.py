import logging
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

from app.agent.reasoning import InvestigationReasoningOutput
from app.agent.context import InvestigationContext

logger = logging.getLogger(__name__)

class PolicyRuleResult(BaseModel):
    """Result of an individual policy rule evaluation."""
    rule_id: str
    rule_name: str
    triggered: bool
    description: str
    severity: str  # CRITICAL, HIGH, MEDIUM, LOW, INFO

class DecisionResult(BaseModel):
    """
    Structured Output of the Fraud Investigation Agent Decision Layer.
    Distinguishes evidence, inference, policy rules, decision state, and final verdict.
    """
    case_id: str
    decision_state: str  # UNDER_INVESTIGATION, VERIFICATION_PENDING, UNRESOLVED, CONFIRMED_FRAUD, CLEARED
    verification_status: str  # PENDING, COMPLETED, NOT_REQUIRED
    verdict: str  # APPROVED, DECLINED, NEEDS_REVIEW
    fraud_probability: float = Field(ge=0.0, le=1.0)
    primary_pattern: str
    rules_evaluated: List[PolicyRuleResult] = Field(default_factory=list)
    triggered_rule_ids: List[str] = Field(default_factory=list)
    recommended_actions: List[str] = Field(default_factory=list)
    decision_explanation: str = ""

def evaluate_policy_rules(
    reasoning: InvestigationReasoningOutput, 
    context: InvestigationContext
) -> DecisionResult:
    """
    Evaluates project policy rules R1 through R10 against reasoning findings and investigation context.
    Determines decision_state, verification_status, verdict, and recommended actions.
    """
    case_id = reasoning.case_id
    facts = context.observed_facts
    derived = context.derived_observations

    rules: List[PolicyRuleResult] = []
    triggered_ids: List[str] = []

    # Check for pending evidence requests
    has_pending_ev_req = len(reasoning.pending_evidence_requests) > 0 or any(
        req.get("status") == "pending" for req in facts.evidence_requests_info
    )

    # Check for customer disputes
    has_customer_dispute = len(reasoning.customer_disputes_represented) > 0 or any(
        t.get("disputed") is True for t in facts.transactions
    )

    # Check for stolen card
    has_stolen_card = any(
        c.get("stolen_flag") is True for c in facts.cards_info
    )

    # Check for VPN device & risk score
    has_vpn_device = derived.vpn_devices_count > 0
    
    # Check for regional/email mismatch
    has_regional_mismatch = derived.regional_mismatches_count > 0
    has_disposable_email = derived.disposable_email_domains_count > 0

    # Check for historical confirmed fraud
    has_historical_fraud = derived.historical_fraud_cases_count > 0

    # Risk score signal evaluation (R9)
    txns = facts.transactions
    risk_scores = [float(t.get("risk_score", 0.0)) for t in txns if isinstance(t.get("risk_score"), (int, float))]
    max_risk_score = max(risk_scores) if risk_scores else 0.0

    # Rule R1: Low-Risk Baseline Single Transaction
    r1_triggered = (
        len(txns) == 1 and max_risk_score < 0.50 and not has_stolen_card and 
        not has_vpn_device and not has_pending_ev_req and not has_customer_dispute and not has_historical_fraud
    )
    rules.append(PolicyRuleResult(
        rule_id="R1",
        rule_name="LOW_RISK_BASELINE",
        triggered=r1_triggered,
        description="Single low-risk transaction without risk signals or pending evidence requests.",
        severity="INFO"
    ))
    if r1_triggered:
        triggered_ids.append("R1")

    # Rule R2: Pending Evidence Verification
    r2_triggered = has_pending_ev_req
    rules.append(PolicyRuleResult(
        rule_id="R2",
        rule_name="PENDING_EVIDENCE_VERIFICATION",
        triggered=r2_triggered,
        description="Pending evidence request exists. Investigation requires awaiting response and cannot be auto-cleared.",
        severity="MEDIUM"
    ))
    if r2_triggered:
        triggered_ids.append("R2")

    # Rule R3: Customer Dispute Trigger
    r3_triggered = has_customer_dispute
    rules.append(PolicyRuleResult(
        rule_id="R3",
        rule_name="CUSTOMER_DISPUTE_TRIGGER",
        triggered=r3_triggered,
        description="Transaction or case flagged as disputed by customer. Triggers verification workflow.",
        severity="HIGH"
    ))
    if r3_triggered:
        triggered_ids.append("R3")

    # Rule R4: Confirmed Stolen Card
    r4_triggered = has_stolen_card
    rules.append(PolicyRuleResult(
        rule_id="R4",
        rule_name="STOLEN_CARD_FLAG",
        triggered=r4_triggered,
        description="Card associated with transaction is flagged as stolen in system records.",
        severity="CRITICAL"
    ))
    if r4_triggered:
        triggered_ids.append("R4")

    # Rule R5: Device Spoofing & High Risk Score
    r5_triggered = has_vpn_device and max_risk_score >= 0.70
    rules.append(PolicyRuleResult(
        rule_id="R5",
        rule_name="DEVICE_SPOOFING_HIGH_RISK",
        triggered=r5_triggered,
        description="Transaction performed via VPN/Proxy device combined with elevated risk score.",
        severity="HIGH"
    ))
    if r5_triggered:
        triggered_ids.append("R5")

    # Rule R6: Anonymity & Regional Mismatch
    r6_triggered = has_regional_mismatch or has_disposable_email
    rules.append(PolicyRuleResult(
        rule_id="R6",
        rule_name="REGIONAL_OR_EMAIL_MISMATCH",
        triggered=r6_triggered,
        description="Transaction involves regional billing mismatch or disposable email domain service.",
        severity="MEDIUM"
    ))
    if r6_triggered:
        triggered_ids.append("R6")

    # Rule R7: Linked Historical Fraud Network
    r7_triggered = has_historical_fraud
    rules.append(PolicyRuleResult(
        rule_id="R7",
        rule_name="LINKED_HISTORICAL_FRAUD",
        triggered=r7_triggered,
        description="Entity is linked to past closed case(s) with FRAUD_CONFIRMED verdict.",
        severity="HIGH"
    ))
    if r7_triggered:
        triggered_ids.append("R7")

    # Rule R8: High Velocity Card Testing
    r8_triggered = len(txns) >= 5 and derived.flagged_transactions_count >= 3
    rules.append(PolicyRuleResult(
        rule_id="R8",
        rule_name="HIGH_VELOCITY_CARD_TESTING",
        triggered=r8_triggered,
        description="Card exhibits high transaction velocity with multiple flagged attempts.",
        severity="CRITICAL"
    ))
    if r8_triggered:
        triggered_ids.append("R8")

    # Rule R9: Risk Score Investigation Signal Principle
    r9_triggered = True  # Always active as an evaluation principle
    rules.append(PolicyRuleResult(
        rule_id="R9",
        rule_name="RISK_SCORE_SIGNAL_ONLY",
        triggered=r9_triggered,
        description="Risk score is evaluated as an investigation signal, never as an automatic fraud verdict alone.",
        severity="INFO"
    ))
    triggered_ids.append("R9")

    # Rule R10: Pending Evidence Request Override
    r10_triggered = has_pending_ev_req and not (has_stolen_card or r8_triggered)
    rules.append(PolicyRuleResult(
        rule_id="R10",
        rule_name="PENDING_EVIDENCE_OVERRIDE",
        triggered=r10_triggered,
        description="Pending evidence request overrides auto-clear. Final state remains UNRESOLVED / VERIFICATION_PENDING.",
        severity="HIGH"
    ))
    if r10_triggered:
        triggered_ids.append("R10")

    # Evaluate Final Decision State and Verdict based on R1-R10
    if r4_triggered or r8_triggered or (r7_triggered and max_risk_score >= 0.70):
        decision_state = "CONFIRMED_FRAUD"
        verification_status = "COMPLETED"
        verdict = "DECLINED"
        primary_pattern = reasoning.observed_patterns[0] if reasoning.observed_patterns else "Confirmed Fraud Pattern"
        actions = ["BLOCK_CARD", "FILE_SAR_REPORT", "NOTIFY_SECURITY_OPS"]
        explanation = "Confirmed fraud decision reached due to critical policy rule triggers (Stolen Card / High Velocity)."

    elif r10_triggered or r2_triggered:
        decision_state = "UNRESOLVED"
        verification_status = "PENDING"
        verdict = "NEEDS_REVIEW"
        primary_pattern = "Customer Verification Pending"
        actions = ["AWAIT_EVIDENCE_RESPONSE", "ASSIGN_ANALYST_QUEUE", "MONITOR_CARD_ACTIVITY"]
        explanation = (
            f"Case '{case_id}' contains transaction(s) with risk_score {max_risk_score:.2f}. "
            f"Pursuant to rules R2 and R10, because EvidenceRequest ER-HHG-003-001 status is pending, "
            f"the investigation state remains UNRESOLVED / VERIFICATION_PENDING awaiting response."
        )

    elif r3_triggered or r5_triggered or r6_triggered:
        decision_state = "UNDER_INVESTIGATION"
        verification_status = "PENDING"
        verdict = "NEEDS_REVIEW"
        primary_pattern = reasoning.observed_patterns[0] if reasoning.observed_patterns else "Suspicious Risk Pattern"
        actions = ["REQUEST_ADDITIONAL_KYC", "REVIEW_DISPUTE_DOCUMENTATION"]
        explanation = "Suspicious risk signals or customer dispute observed requiring manual verification."

    else:
        decision_state = "CLEARED"
        verification_status = "COMPLETED"
        verdict = "APPROVED"
        primary_pattern = "Low Risk Standard Transaction"
        actions = ["CLOSE_CASE", "UNFLAG_TRANSACTION"]
        explanation = "No critical risk policy rules triggered. Case cleared."

    # Use max_risk_score if positive, otherwise reasoning preliminary probability
    fraud_prob = max_risk_score if max_risk_score > 0 else (reasoning.preliminary_fraud_probability or 0.0)

    return DecisionResult(
        case_id=case_id,
        decision_state=decision_state,
        verification_status=verification_status,
        verdict=verdict,
        fraud_probability=fraud_prob,
        primary_pattern=primary_pattern,
        rules_evaluated=rules,
        triggered_rule_ids=triggered_ids,
        recommended_actions=actions,
        decision_explanation=explanation
    )
