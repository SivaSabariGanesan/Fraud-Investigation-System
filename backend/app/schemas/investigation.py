from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.agent.schemas import (
    EvidenceItem,
    InvestigationRequest,
    InvestigationResult
)

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

