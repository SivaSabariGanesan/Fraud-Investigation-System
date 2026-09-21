from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime

class InvestigationRequest(BaseModel):
    """Input payload to request a case investigation."""
    case_id: Optional[str] = None
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
    # Compatibility aliases for API/Frontend
    id: Optional[str] = None
    type: Optional[str] = None
    details: Dict[str, Any] = Field(default_factory=dict)
    risk_signal: Optional[str] = None

    def model_post_init(self, __context: Any) -> None:
        if not self.id:
            self.id = self.evidence_id
        if not self.type:
            self.type = self.evidence_type
        if not self.details:
            self.details = self.raw_data or {"description": self.description}

class InvestigationContext(BaseModel):
    """Unified context object passed to reasoning layer."""
    case_id: str
    customer_id: Optional[str] = None
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
    customer_id: Optional[str] = None
    verdict: str  # APPROVED, DECLINED, NEEDS_REVIEW
    fraud_probability: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    primary_pattern: str
    policies_evaluated: List[Dict[str, Any]] = Field(default_factory=list)
    recommended_actions: List[str] = Field(default_factory=list)

class InvestigationResult(BaseModel):
    """
    Complete project-required investigation output model.
    Contains full investigation findings, verdict, graph tracking, SAR, actions, and performance metrics.
    """
    investigation_id: Optional[str] = None
    case_id: str
    customer_id: Optional[str] = None
    case_status: str = "COMPLETED"
    status: str = "COMPLETED"
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
    rules_evaluated: List[Dict[str, Any]] = Field(default_factory=list)
    SAR: Optional[Dict[str, Any]] = None
    stop_reason: Optional[str] = "WORKFLOW_COMPLETE"
    tool_calls: List[Dict[str, Any]] = Field(default_factory=list)
    tokens: Dict[str, int] = Field(default_factory=lambda: {"prompt": 0, "completion": 0, "total": 0})
    latency: float = 0.0
    # API / Frontend compatibility
    evidence_count: int = 0
    reasoning_summary: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    def model_post_init(self, __context: Any) -> None:
        if not self.evidence_count:
            self.evidence_count = len(self.evidence)
        if not self.created_at:
            self.created_at = datetime.utcnow()
        if not self.updated_at:
            self.updated_at = datetime.utcnow()

# Aliases for backward compatibility
AgentEvidenceItem = EvidenceItem
AgentInvestigationOutput = InvestigationResult
