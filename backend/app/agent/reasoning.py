import json
import time
import logging
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field, ValidationError

from app.core.config import settings
from app.agent.context import InvestigationContext
from app.agent.prompts import GROQ_INVESTIGATION_SYSTEM_PROMPT, format_groq_user_prompt

logger = logging.getLogger(__name__)

class KeyEvidenceItem(BaseModel):
    """Schema for individual evidence finding item in LLM output."""
    evidence_id: str
    finding: str = ""
    significance: str = "NEUTRAL"  # LOW, MEDIUM, HIGH, NEUTRAL

class GroqLLMReasoningSchema(BaseModel):
    """Strict structured Pydantic schema for Groq LLM output."""
    summary: str = ""
    key_evidence: List[KeyEvidenceItem] = Field(default_factory=list)
    observed_patterns: List[str] = Field(default_factory=list)
    conflicting_evidence: List[str] = Field(default_factory=list)
    missing_evidence: List[str] = Field(default_factory=list)
    uncertainties: List[str] = Field(default_factory=list)
    relevant_rules: List[str] = Field(default_factory=list)
    reasoning: str = ""

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
    preliminary_fraud_probability: Optional[float] = None
    customer_disputes_represented: List[str] = Field(default_factory=list)
    pending_evidence_requests: List[str] = Field(default_factory=list)
    analytical_summary: str = ""
    # Observability metrics (No sensitive key logging)
    llm_model: Optional[str] = None
    llm_latency: float = 0.0
    llm_tokens: Dict[str, int] = Field(default_factory=lambda: {"prompt": 0, "completion": 0, "total": 0})

def _build_bounded_context_payload(context: InvestigationContext) -> Dict[str, Any]:
    """
    Constructs a bounded text payload from InvestigationContext to prevent excessive token usage.
    """
    facts = context.observed_facts
    derived = context.derived_observations
    evidence_items = context.normalized_evidence

    # Flagged transactions summary
    txns_summary = [
        {
            "id": t.get("id") or t.get("TransactionID"),
            "amount": t.get("amount"),
            "channel": t.get("channel"),
            "product_code": t.get("product_code"),
            "risk_signal": t.get("risk_score"),
            "disputed": t.get("disputed", False)
        }
        for t in facts.transactions[:10]  # Max 10 transactions
    ]

    # Connected entities summary
    connected_summary = {
        "customer_id": facts.customer_info.get("customer_id") if facts.customer_info else None,
        "cards": [c.get("card_id") or c.get("id") for c in facts.cards_info[:5]],
        "devices": [d.get("device_id") or d.get("id") for d in facts.devices_info[:5]],
        "billing_regions": [r.get("region_id") or r.get("id") for r in facts.billing_regions_info[:5]],
        "email_domains": [e.get("email_domain") or e.get("id") for e in facts.email_domains_info[:5]],
        "evidence_requests": [
            {
                "id": er.get("request_id") or er.get("id"),
                "type": er.get("request_type") or er.get("type"),
                "status": er.get("status"),
                "request_text": er.get("request_text") or er.get("details", {}).get("request_text") or "Confirm transaction"
            }
            for er in facts.evidence_requests_info[:5]
        ]
    }

    # Bounded normalized evidence items (max 15)
    max_evidence_items = 15
    truncated = len(evidence_items) > max_evidence_items
    bounded_evidence = [
        {
            "id": ev.evidence_id,
            "type": ev.evidence_type,
            "description": ev.description,
            "strength": ev.strength,
            "risk_signal": getattr(ev, "risk_signal", None) or getattr(ev, "strength", None) or ev.raw_data.get("risk_score")
        }
        for ev in evidence_items[:max_evidence_items]
    ]

    return {
        "case_id": context.case_id,
        "txns_summary": json.dumps(txns_summary),
        "connected_summary": json.dumps(connected_summary),
        "derived_summary": json.dumps({
            "stolen_cards": derived.stolen_cards_count,
            "vpn_devices": derived.vpn_devices_count,
            "regional_mismatches": derived.regional_mismatches_count,
            "disposable_emails": derived.disposable_email_domains_count,
            "historical_fraud_cases": derived.historical_fraud_cases_count,
            "total_exposure": derived.total_exposure_amount
        }),
        "evidence_summary": json.dumps(bounded_evidence),
        "evidence_count": len(evidence_items),
        "truncated": truncated
    }

def analyze_investigation_context(context: InvestigationContext) -> InvestigationReasoningOutput:
    """
    Analyzes InvestigationContext using Groq LLM (openai/gpt-oss-120b).
    Produces structured reasoning for downstream deterministic policy rules (R1-R10).
    """
    case_id = context.case_id
    facts = context.observed_facts
    derived = context.derived_observations
    evidence_items = context.normalized_evidence

    # Extract base IDs
    affected_txns = [t.get("id") for t in facts.transactions if t.get("id")]
    connected_cards = [c.get("id") for c in facts.cards_info if c.get("id")]
    connected_devs = [d.get("id") for d in facts.devices_info if d.get("id")]
    exposure = derived.total_exposure_amount

    # Collect customer disputes and pending evidence requests
    trig_info = facts.trigger_info
    trig_summary = ""
    if trig_info:
        trig_summary = (
            f"Trigger Type: {trig_info.trigger_type or 'customer_report'}\n"
            f"Customer Report / Notes: \"{trig_info.trigger_text or 'Dispute reported.'}\"\n"
            f"Customer Dispute Active: {'YES' if derived.customer_dispute else 'NO'}"
        )

    customer_disputes = [
        f"Transaction {t.get('id') or t.get('transaction_id')} disputed by customer report: '{trig_info.trigger_text if trig_info else 'Disputed'}'."
        for t in facts.transactions if t.get("disputed") is True
    ]
    if not customer_disputes and derived.customer_dispute:
        customer_disputes = [f"Customer report explicitly disputes transaction: '{trig_info.trigger_text if trig_info else 'Disputed'}'."]

    pending_requests = [
        f"EvidenceRequest {er.get('id') or er.get('request_id')} status is '{er.get('status')}'"
        for er in facts.evidence_requests_info
        if str(er.get("status")).lower() in ("pending", "submitted")
    ]

    supporting_ids = [e.evidence_id for e in evidence_items]

    # Prepare context payload for Groq
    payload = _build_bounded_context_payload(context)
    user_prompt = format_groq_user_prompt(
        case_id=case_id,
        manual_trigger_summary=trig_summary or "None",
        observed_facts_summary=f"Transactions: {payload['txns_summary']}\nConnected Entities: {payload['connected_summary']}",
        derived_observations_summary=payload['derived_summary'],
        normalized_evidence_summary=payload['evidence_summary'],
        evidence_count=payload['evidence_count']
    )

    llm_output: Optional[GroqLLMReasoningSchema] = None
    llm_tokens = {"prompt": 0, "completion": 0, "total": 0}
    llm_model = settings.GROQ_MODEL
    latency = 0.0

    api_key = settings.GROQ_API_KEY
    if settings.USE_LOCAL_LLM or settings.LLM_PROVIDER in ("ollama", "local"):
        api_key = None
        # Try local Ollama model (e.g. llama3.2:3b running in Docker)
        try:
            import httpx
            start_time = time.time()
            ollama_url = getattr(settings, "OLLAMA_HOST", "http://localhost:11434/api/chat")
            ollama_model = getattr(settings, "OLLAMA_MODEL", "llama3.2:3b")
            
            res = httpx.post(
                ollama_url,
                json={
                    "model": ollama_model,
                    "messages": [
                        {"role": "system", "content": GROQ_INVESTIGATION_SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt}
                    ],
                    "format": "json",
                    "stream": False
                },
                timeout=30.0
            )
            latency = round(time.time() - start_time, 3)
            if res.status_code == 200:
                raw_content = res.json().get("message", {}).get("content", "")
                if raw_content:
                    parsed_json = json.loads(raw_content)
                    llm_output = GroqLLMReasoningSchema.model_validate(parsed_json)
                    llm_model = f"ollama/{ollama_model}"
                    eval_count = res.json().get("eval_count", 0)
                    prompt_eval_count = res.json().get("prompt_eval_count", 0)
                    llm_tokens = {
                        "prompt": prompt_eval_count,
                        "completion": eval_count,
                        "total": prompt_eval_count + eval_count
                    }
        except Exception as e:
            logger.warning(f"Ollama local LLM reasoning execution error: {str(e)}")
            llm_output = None

    if api_key and not llm_output:
        try:
            from groq import Groq
            client = Groq(api_key=api_key)
            start_time = time.time()
            
            completion = client.chat.completions.create(
                model=settings.GROQ_MODEL,
                messages=[
                    {"role": "system", "content": GROQ_INVESTIGATION_SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.1
            )
            
            latency = round(time.time() - start_time, 3)
            if completion.usage:
                llm_tokens = {
                    "prompt": getattr(completion.usage, "prompt_tokens", 0),
                    "completion": getattr(completion.usage, "completion_tokens", 0),
                    "total": getattr(completion.usage, "total_tokens", 0)
                }
            if completion.model:
                llm_model = completion.model

            raw_content = completion.choices[0].message.content
            if raw_content:
                parsed_json = json.loads(raw_content)
                llm_output = GroqLLMReasoningSchema.model_validate(parsed_json)

        except Exception as e:
            logger.warning(f"Groq LLM reasoning execution error: {str(e)}")
            llm_output = None

    # Construct final reasoning output combining LLM structured findings or clear fallback
    if llm_output:
        key_findings = [item.finding for item in llm_output.key_evidence]
        if not key_findings and llm_output.reasoning:
            key_findings = [llm_output.reasoning]

        observed_patterns = llm_output.observed_patterns
        contradictory = llm_output.conflicting_evidence
        missing = llm_output.missing_evidence
        uncertainties = llm_output.uncertainties
        summary = llm_output.summary or llm_output.reasoning

        if payload["truncated"]:
            missing.append("Context payload was truncated to 15 key evidence items for LLM processing.")

        if pending_requests:
            # Ensure pending evidence requests are never mischaracterized as undisputed
            summary = summary.replace("undisputed", "subject to pending customer verification")
            summary = summary.replace("Undisputed", "subject to pending customer verification")
            summary = summary.replace("undisputed transaction", "transaction pending customer verification")
            summary = summary.replace("undisputed transactions", "transactions pending customer verification")

    else:
        # Factual fallback if Groq API is unavailable (No fake verdicts or mock data)
        key_findings = [
            f"Case {case_id} contains {len(affected_txns)} transaction(s) totaling ${exposure:,.2f} USD exposure."
        ]
        if pending_requests:
            key_findings.append(f"Pending evidence request(s): {', '.join(pending_requests)}")

        observed_patterns = []
        if derived.stolen_cards_count > 0:
            observed_patterns.append("Stolen Card Usage")
        if derived.vpn_devices_count > 0:
            observed_patterns.append("Device Spoofing / Anonymized Proxy")
        if derived.regional_mismatches_count > 0:
            observed_patterns.append("Geographic Mismatch")
        if derived.disposable_email_domains_count > 0:
            observed_patterns.append("Disposable Email Service")
        if derived.historical_fraud_cases_count > 0:
            observed_patterns.append("Historical Recurrent Fraud Link")

        contradictory = []
        missing = []
        if not facts.customer_info:
            missing.append("Customer profile metadata is missing or unlinked.")
        if not facts.devices_info:
            missing.append("Device fingerprint metadata is missing.")

        uncertainties = [f"The transaction is subject to a pending customer verification request. No customer response has been received."] if pending_requests else []

        if pending_requests:
            summary = (
                f"The transaction is subject to a pending customer verification request. No customer response has been received."
            )
        else:
            summary = (
                f"Factual reasoning for Case {case_id}: Analyzed {len(affected_txns)} transaction(s) with ${exposure:,.2f} exposure."
            )

    # CRITICAL: preliminary_fraud_probability remains None to avoid converting risk_score into fraud_probability
    return InvestigationReasoningOutput(
        case_id=case_id,
        key_findings=key_findings,
        observed_patterns=list(set(observed_patterns)),
        supporting_evidence_ids=supporting_ids,
        contradictory_evidence=contradictory,
        missing_evidence=missing,
        uncertainty=uncertainties,
        affected_transaction_ids=affected_txns,
        potentially_connected_cards=connected_cards,
        potentially_connected_devices=connected_devs,
        exposure=exposure,
        preliminary_fraud_probability=None,
        customer_disputes_represented=customer_disputes,
        pending_evidence_requests=pending_requests,
        analytical_summary=summary,
        llm_model=llm_model,
        llm_latency=latency,
        llm_tokens=llm_tokens
    )
