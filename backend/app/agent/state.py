from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime

class ToolCallRecord(BaseModel):
    """Record of a tool invocation by the agent."""
    tool_name: str
    arguments: Dict[str, Any] = Field(default_factory=dict)
    result: Optional[Any] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    error: Optional[str] = None

class EvidenceRecord(BaseModel):
    """Structured evidence item collected during investigation."""
    id: str
    entity_type: str
    details: Dict[str, Any] = Field(default_factory=dict)
    risk_signal: Optional[str] = None

class InvestigationState(BaseModel):
    """
    Shared state object for a single fraud case investigation.
    Maintains graph entity IDs, collected evidence, policy results, tool invocation logs, and final risk score.
    """
    case_id: str
    customer_id: Optional[str] = None
    card_ids: List[str] = Field(default_factory=list)
    transaction_ids: List[str] = Field(default_factory=list)
    flagged_transaction_ids: List[str] = Field(default_factory=list)
    device_ids: List[str] = Field(default_factory=list)
    billing_regions: List[str] = Field(default_factory=list)
    email_domains: List[str] = Field(default_factory=list)
    connected_case_ids: List[str] = Field(default_factory=list)
    evidence_requests: List[Dict[str, Any]] = Field(default_factory=list)
    evidence_items: List[EvidenceRecord] = Field(default_factory=list)
    exposure: float = 0.0
    investigation_status: str = "PENDING"  # PENDING, IN_PROGRESS, COMPLETED, FAILED
    verification_status: Optional[str] = None  # e.g., UNVERIFIED, VERIFIED_CLEAN, VERIFIED_FRAUD
    verdict: Optional[str] = None  # APPROVED, DECLINED, NEEDS_REVIEW
    fraud_probability: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    pattern: Optional[str] = None
    investigation_notes: List[str] = Field(default_factory=list)
    errors: List[str] = Field(default_factory=list)
    tool_calls: List[ToolCallRecord] = Field(default_factory=list)

    def add_note(self, note: str) -> None:
        """Helper method to append an investigation note."""
        self.investigation_notes.append(note)

    def add_error(self, error_msg: str) -> None:
        """Helper method to log an error message into state."""
        self.errors.append(error_msg)

    def log_tool_call(
        self, 
        tool_name: str, 
        arguments: Dict[str, Any], 
        result: Optional[Any] = None, 
        error: Optional[str] = None
    ) -> None:
        """Helper method to log a tool execution record."""
        self.tool_calls.append(
            ToolCallRecord(
                tool_name=tool_name,
                arguments=arguments,
                result=result,
                error=error
            )
        )
