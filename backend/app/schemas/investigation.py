from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.agent.schemas import (
    EvidenceItem,
    InvestigationRequest,
    InvestigationResult
)

# ---------------------------------------------------------------------------
# Evidence Request lifecycle schemas
# ---------------------------------------------------------------------------

class EvidenceRequestCreate(BaseModel):
    """Payload for creating a new evidence request."""
    transaction_id: Optional[str] = None
    request_type: str = "customer_verification"
    request_text: str = Field(..., min_length=5, description="The question / verification text sent to the customer.")
    notes: Optional[str] = None
    actor: Optional[str] = "ANALYST"


class EvidenceRequestRespond(BaseModel):
    """Payload for recording an actual customer / analyst response to a PENDING request."""
    response: str = Field(..., min_length=1, description="The actual response text received from the customer or analyst.")
    response_source: str = Field(default="CUSTOMER", description="Who provided the response: CUSTOMER, ANALYST, or SYSTEM.")
    response_assumptions: Optional[str] = None
    actor: Optional[str] = "ANALYST"


class EvidenceRequestCancel(BaseModel):
    """Payload for cancelling a PENDING evidence request."""
    cancelled_reason: Optional[str] = None
    actor: Optional[str] = "ANALYST"


class EvidenceRequestResponse(BaseModel):
    """API response schema for a persisted evidence request."""
    request_id: str
    case_id: str
    transaction_id: Optional[str] = None
    request_type: str
    request_text: str
    status: str  # PENDING, RESPONDED, CANCELLED
    response: Optional[str] = None
    response_source: Optional[str] = None
    response_assumptions: Optional[str] = None
    responded_at: Optional[datetime] = None
    cancelled_reason: Optional[str] = None
    cancelled_at: Optional[datetime] = None
    triggered_investigation_id: Optional[str] = None
    actor: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    notes: Optional[str] = None

    class Config:
        from_attributes = True


class EvidenceRequestRespondResult(BaseModel):
    """Extended response returned when a respond action also triggers a new investigation."""
    evidence_request: EvidenceRequestResponse
    new_investigation_id: Optional[str] = None
    investigation_triggered: bool = False
    investigation_error: Optional[str] = None

class HealthCheck(BaseModel):
    status: str = "ok"

class CaseBase(BaseModel):
    case_id: str
    customer_id: Optional[str] = None
    status: str
    verdict: Optional[str] = None
    fraud_probability: Optional[float] = None
    pattern: Optional[str] = None
    exposure: Optional[float] = None

class CaseCreate(CaseBase):
    notes: Optional[str] = None

class CaseResponse(CaseBase):
    created_at: datetime
    updated_at: datetime
    notes: Optional[str] = None

    class Config:
        from_attributes = True

class InvestigationHistoryItem(BaseModel):
    investigation_id: str
    case_id: str
    customer_id: Optional[str] = None
    case_status: Optional[str] = None
    status: Optional[str] = None
    verdict: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    reasoning_summary: Optional[str] = None
    stop_reason: Optional[str] = None

    class Config:
        from_attributes = True

class InvestigationHistoryResponse(BaseModel):
    case_id: str
    investigations: List[InvestigationHistoryItem]

class AuditEventItem(BaseModel):
    id: int
    case_id: str
    investigation_id: Optional[str] = None
    event_type: str
    description: Optional[str] = None
    actor: str = "AGENT"
    metadata_json: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class InvestigationDetailResponse(BaseModel):
    investigation_id: str
    case_id: str
    customer_id: Optional[str] = None
    case_status: Optional[str] = None
    status: Optional[str] = None
    verdict: Optional[str] = None
    fraud_probability: Optional[float] = None
    pattern: Optional[str] = None
    reasoning_summary: Optional[str] = None
    stop_reason: Optional[str] = None
    exposure: Optional[float] = None
    sar_status: Optional[str] = None
    sar_reason: Optional[str] = None
    llm_provider: Optional[str] = None
    llm_model: Optional[str] = None
    llm_latency: Optional[float] = None
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None
    total_tokens: Optional[int] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    evidence: List[Dict[str, Any]] = []
    actions_initial: List[str] = []
    actions_final: List[str] = []
    rules: List[Dict[str, Any]] = []
    audit_events: List[AuditEventItem] = []

    class Config:
        from_attributes = True

