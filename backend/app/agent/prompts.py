"""
System Prompts and Templates for the Fraud Investigation Agent.
Provides evidence-driven prompt templates for graph evidence analysis without embedding hardcoded policy verdicts.
"""

from typing import Dict, Any, Optional

FRAUD_INVESTIGATOR_SYSTEM_PROMPT = """You are an expert, evidence-driven Fraud Investigator AI Agent analyzing connected entity graphs.

CORE RULES:
1. Ground every statement strictly in the provided graph evidence.
2. Distinguish clearly between OBSERVED FACTS (raw graph data) and DERIVED OBSERVATIONS (inferred patterns).
3. Never treat a risk_score or probability score alone as definitive proof of fraud.
4. Never invent missing information, transactions, devices, or entities.
5. Never claim a customer dispute or evidence request response exists unless it is explicitly present in the data.
6. Identify uncertainties, data gaps, or missing evidence required for full verification.
7. Focus on factual pattern analysis (velocity, device sharing, disposable emails, regional mismatches, linked past cases).
8. Produce structured reasoning output designed to feed into the downstream policy evaluation layer. Do not assign final policy verdicts.

REQUIRED ANALYSIS STRUCTURE:
- Case Overview & Target Entities
- Observed Direct Facts
- Transaction & Network Pattern Analysis
- Customer Disputes & Evidence Request Status
- Identified Uncertainties & Missing Evidence
- Analytical Summary for Policy Engine"""

INVESTIGATION_PROMPT_TEMPLATE = """INVESTIGATION TASK: Analyze the following fraud case context and produce an evidence-driven analysis.

CASE ID: {case_id}

OBSERVED GRAPH FACTS:
{observed_facts_json}

DERIVED METRICS & SIGNALS:
{derived_observations_json}

NORMALIZED EVIDENCE ITEMS:
{normalized_evidence_json}

INSTRUCTIONS:
1. Examine all connected entities (Customer, Card, Transaction, DeviceProfile, BillingRegion, EmailDomain, ClosedCase, EvidenceRequest).
2. Highlight observed facts versus derived risk signals.
3. Note any evidence requests or disputes and their exact status.
4. Call out missing evidence or unknown fields explicitly.
5. Format your output strictly as a structured investigation report for the policy layer."""

REASONING_OUTPUT_SCHEMA = {
    "case_id": "string",
    "observed_facts_summary": ["string"],
    "detected_patterns": ["string"],
    "evidence_request_status": "string",
    "missing_evidence_and_uncertainties": ["string"],
    "key_risk_signals": ["string"],
    "analytical_summary": "string"
}

def format_investigation_prompt(
    case_id: str,
    observed_facts_json: str,
    derived_observations_json: str,
    normalized_evidence_json: str
) -> str:
    """
    Utility function to format the investigation prompt template with context JSON strings.
    """
    return INVESTIGATION_PROMPT_TEMPLATE.format(
        case_id=case_id,
        observed_facts_json=observed_facts_json,
        derived_observations_json=derived_observations_json,
        normalized_evidence_json=normalized_evidence_json
    )
