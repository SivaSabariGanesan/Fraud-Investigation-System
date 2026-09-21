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
