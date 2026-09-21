from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, Text, Integer, Boolean
from app.services.database import Base

class CaseModel(Base):
    """
    SQLAlchemy Model representing a Fraud Investigation Case.
    """
    __tablename__ = "cases"

    case_id = Column(String, primary_key=True, index=True)
    customer_id = Column(String, nullable=True)                  # e.g., C08623
    status = Column(String, nullable=False, default="PENDING")  # PENDING, INVESTIGATING, COMPLETED, CLOSED
    verdict = Column(String, nullable=True)                      # APPROVED, DECLINED, NEEDS_REVIEW
    fraud_probability = Column(Float, nullable=True)            # Risk score (0.0 to 1.0)
    pattern = Column(String, nullable=True)                      # e.g., Card Testing, Synthetic ID, Velocity Surge
    exposure = Column(Float, nullable=True)                     # Financial risk exposure in USD
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    notes = Column(Text, nullable=True)


class InvestigationModel(Base):
    """
    SQLAlchemy Model representing a historical investigation run for a case.
    Immutably records the state and outcome of an agent execution run.
    """
    __tablename__ = "investigations"

    investigation_id = Column(String, primary_key=True, index=True)
    case_id = Column(String, index=True, nullable=False)
    customer_id = Column(String, nullable=True)
    case_status = Column(String, nullable=True)
    status = Column(String, nullable=True)
    verdict = Column(String, nullable=True)
    fraud_probability = Column(Float, nullable=True)
    pattern = Column(String, nullable=True)
    reasoning_summary = Column(Text, nullable=True)
    stop_reason = Column(String, nullable=True)
    exposure = Column(Float, nullable=True)
    sar_status = Column(String, nullable=True)
    sar_reason = Column(Text, nullable=True)
    llm_provider = Column(String, nullable=True)
    llm_model = Column(String, nullable=True)
    llm_latency = Column(Float, nullable=True)
    prompt_tokens = Column(Integer, nullable=True)
    completion_tokens = Column(Integer, nullable=True)
    total_tokens = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)


class InvestigationEvidenceModel(Base):
    """
    Preserves evidence snapshot used during a specific investigation run.
    """
    __tablename__ = "investigation_evidence"

    id = Column(Integer, primary_key=True, autoincrement=True)
    investigation_id = Column(String, index=True, nullable=False)
    evidence_id = Column(String, nullable=True)
    evidence_type = Column(String, nullable=True)
    source = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    strength = Column(String, nullable=True)
    related_transaction_id = Column(String, nullable=True)
    related_card_id = Column(String, nullable=True)
    risk_signal = Column(String, nullable=True)
    raw_data = Column(Text, nullable=True)
    timestamp = Column(String, nullable=True)
    request_id = Column(String, nullable=True)
    request_type = Column(String, nullable=True)
    request_status = Column(String, nullable=True)
    request_text = Column(Text, nullable=True)
    request_response = Column(Text, nullable=True)
    requested_at = Column(String, nullable=True)
    responded_at = Column(String, nullable=True)


class InvestigationActionModel(Base):
    """
    Stores initial and final recommended actions from an investigation.
    """
    __tablename__ = "investigation_actions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    investigation_id = Column(String, index=True, nullable=False)
    action = Column(String, nullable=False)
    phase = Column(String, nullable=False)  # INITIAL or FINAL
    created_at = Column(DateTime, default=datetime.utcnow)


class InvestigationRuleModel(Base):
    """
    Stores evaluation results of deterministic rules (R1-R10).
    """
    __tablename__ = "investigation_rules"

    id = Column(Integer, primary_key=True, autoincrement=True)
    investigation_id = Column(String, index=True, nullable=False)
    rule_id = Column(String, nullable=False)  # R1, R2, ..., R10
    triggered = Column(Boolean, nullable=False, default=False)
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class AuditEventModel(Base):
    """
    Audit log event tracking workflow steps chronologically.
    """
    __tablename__ = "audit_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    case_id = Column(String, index=True, nullable=False)
    investigation_id = Column(String, index=True, nullable=True)
    event_type = Column(String, nullable=False)  # CASE_OPENED, EVIDENCE_COLLECTED, etc.
    description = Column(Text, nullable=True)
    actor = Column(String, nullable=False, default="AGENT")  # SYSTEM, AGENT, ANALYST
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

