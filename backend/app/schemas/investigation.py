from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class HealthCheck(BaseModel):
    status: str = "ok"

class EvidenceItem(BaseModel):
    id: str
    type: str  # Card, Transaction, DeviceProfile, BillingRegion, EmailDomain, ClosedCase
    details: Dict[str, Any]
    risk_signal: Optional[str] = None

class InvestigationRequest(BaseModel):
    notes: Optional[str] = None
    force_reinvestigate: bool = False

class InvestigationResult(BaseModel):
    case_id: str
    status: str
    verdict: Optional[str] = None
    fraud_probability: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    pattern: Optional[str] = None
    exposure: Optional[float] = None
    evidence_count: int = 0
    reasoning_summary: Optional[str] = None
    evidence: List[EvidenceItem] = []
    created_at: datetime
    updated_at: datetime

class CaseBase(BaseModel):
    case_id: str
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
