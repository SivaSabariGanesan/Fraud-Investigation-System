from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime

class InvestigationRequest(BaseModel):
    """Input payload to request a case investigation."""
    case_id: str
    notes: Optional[str] = None
    force_reinvestigate: bool = False
    metadata: Dict[str, Any] = Field(default_factory=dict)

class EvidenceItem(BaseModel):
    """Normalized evidence item schema."""
    evidence_id: str
    evidence_type: str
    source: str = "TigerGraph"
    description: str
    related_entity: Optional[str] = None
    transaction_id: Optional[str] = None
    card_id: Optional[str] = None
    strength: Optional[str] = "NEUTRAL"
    raw_data: Dict[str, Any] = Field(default_factory=dict)
    timestamp: Optional[datetime] = None

class InvestigationContext(BaseModel):
    """Unified context object passed to reasoning layer."""
    case_id: str
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    observed_facts: Dict[str, Any] = Field(default_factory=dict)
    derived_observations: Dict[str, Any] = Field(default_factory=dict)
    normalized_evidence: List[EvidenceItem] = Field(default_factory=list)

class InvestigationFinding(BaseModel):
    """Specific key finding generated during evidence reasoning."""
    finding_id: str
    finding_type: str
    description: str
    severity: str = "INFO"  # HIGH, MEDIUM, LOW, INFO
    supporting_evidence_ids: List[str] = Field(default_factory=list)

class ReasoningResult(BaseModel):
    """Structured analytical output from reasoning layer."""
    case_id: str
    key_findings: List[InvestigationFinding] = Field(default_factory=list)
    observed_patterns: List[str] = Field(default_factory=list)
    supporting_evidence_ids: List[str] = Field(default_factory=list)
    contradictory_evidence: List[str] = Field(default_factory=list)
    missing_evidence: List[str] = Field(default_factory=list)
    uncertainties: List[str] = Field(default_factory=list)
    preliminary_fraud_probability: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    reasoning_summary: str = ""

class EvidenceRequestResult(BaseModel):
    """Status and payload of an evidence request."""
    request_id: str
    case_id: str
    request_type: str
    status: str = "PENDING"  # PENDING, SUBMITTED, FULFILLED, EXPIRED
    details: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)

class DecisionResult(BaseModel):
    """Output from decision and policy evaluation layer."""
    case_id: str
    verdict: str  # APPROVED, DECLINED, NEEDS_REVIEW
    fraud_probability: float = Field(ge=0.0, le=1.0)
    primary_pattern: str
    policies_evaluated: List[Dict[str, Any]] = Field(default_factory=list)
    recommended_actions: List[str] = Field(default_factory=list)

class InvestigationResult(BaseModel):
    """
    Complete project-required investigation output model.
    Contains full investigation findings, verdict, graph tracking, SAR, actions, and performance metrics.
    """
    case_id: str
    case_status: str = "COMPLETED"
    verdict: Optional[str] = None  # APPROVED, DECLINED, NEEDS_REVIEW
    fraud_probability: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    pattern: Optional[str] = None
    evidence: List[EvidenceItem] = Field(default_factory=list)
    affected_transaction_ids: List[str] = Field(default_factory=list)
    connected_card_ids: List[str] = Field(default_factory=list)
    connected_device_ids: List[str] = Field(default_factory=list)
    exposure: float = 0.0
    similar_prior_cases: List[str] = Field(default_factory=list)
    written_to_graph: bool = False
    evidence_requests: List[EvidenceRequestResult] = Field(default_factory=list)
    next_best_actions_initial: List[str] = Field(default_factory=list)
    next_best_actions_final: List[str] = Field(default_factory=list)
    SAR: Optional[Dict[str, Any]] = None
    stop_reason: Optional[str] = "WORKFLOW_COMPLETE"
    tool_calls: List[Dict[str, Any]] = Field(default_factory=list)
    tokens: Dict[str, int] = Field(default_factory=lambda: {"prompt": 0, "completion": 0, "total": 0})
    latency: float = 0.0

# Aliases for backward compatibility
AgentEvidenceItem = EvidenceItem
AgentInvestigationOutput = InvestigationResult
