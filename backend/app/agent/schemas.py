from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class AgentEvidenceItem(BaseModel):
    id: str
    type: str
    details: Dict[str, Any]
    risk_signal: Optional[str] = None

class PolicyEvaluation(BaseModel):
    policy_name: str
    triggered: bool
    description: str
    severity: str  # HIGH, MEDIUM, LOW

class AgentInvestigationOutput(BaseModel):
    case_id: str
    verdict: str  # APPROVED, DECLINED, NEEDS_REVIEW
    fraud_probability: float = Field(ge=0.0, le=1.0)
    pattern: str
    exposure: float
    reasoning_summary: str
    policies_evaluated: List[PolicyEvaluation] = []
    collected_evidence: List[AgentEvidenceItem] = []
