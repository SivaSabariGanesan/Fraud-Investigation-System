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
    transaction_id = Column(String, nullable=True)               # e.g., 3530164
    trigger_type = Column(String, nullable=True)                 # e.g., customer_report, fraud_signal, analyst_review
    trigger_text = Column(Text, nullable=True)                   # e.g., Customer report or analyst notes
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


class EvidenceRequestModel(Base):
    """
    SQLAlchemy Model representing an analyst-managed Evidence Request lifecycle record.

    Lifecycle: PENDING -> RESPONDED or CANCELLED.
    Only PENDING requests can receive a response or be cancelled.

    Note: ER-HHG-003-001 originates from TigerGraph FraudGraph and is seeded into this
    table on first investigation. Its status remains PENDING until an actual analyst
    response is explicitly recorded via POST /api/evidence-requests/{request_id}/respond.
    """
    __tablename__ = "evidence_requests"

    request_id = Column(String, primary_key=True, index=True)
    case_id = Column(String, index=True, nullable=False)
    transaction_id = Column(String, nullable=True)
    request_type = Column(String, nullable=False, default="customer_verification")
    request_text = Column(Text, nullable=False)
    status = Column(String, nullable=False, default="PENDING")  # PENDING, RESPONDED, CANCELLED
    # Response fields — populated only when status == RESPONDED
    response = Column(Text, nullable=True)
    response_source = Column(String, nullable=True)   # e.g., CUSTOMER, ANALYST, SYSTEM
    response_assumptions = Column(Text, nullable=True)
    responded_at = Column(DateTime, nullable=True)
    # Cancellation fields — populated only when status == CANCELLED
    cancelled_reason = Column(Text, nullable=True)
    cancelled_at = Column(DateTime, nullable=True)
    # New investigation created after a response
    triggered_investigation_id = Column(String, nullable=True)
    # Provenance
    actor = Column(String, nullable=True, default="ANALYST")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    notes = Column(Text, nullable=True)


class SarRecordModel(Base):
    """
    SQLAlchemy Model representing a persistent Suspicious Activity Report (SAR) record
    for internal candidate review, report preparation, and status tracking.
    """
    __tablename__ = "sar_records"

    sar_id = Column(String, primary_key=True, index=True)
    case_id = Column(String, index=True, nullable=False)
    investigation_id = Column(String, index=True, nullable=False)
    status = Column(String, nullable=False, default="NOT_RECOMMENDED") # NOT_RECOMMENDED, CANDIDATE, UNDER_REVIEW, APPROVED, NOT_FILED, PREPARED, SUBMISSION_PENDING, FILED
    eligibility = Column(String, nullable=False, default="NOT_ELIGIBLE") # ELIGIBLE, NOT_ELIGIBLE, INCONCLUSIVE
    eligibility_reason = Column(Text, nullable=True)
    exposure_usd = Column(Float, nullable=True)

    # JSON encoded lists/dicts of related entities and snapshot evidence
    related_transaction_ids = Column(Text, nullable=True)
    related_card_ids = Column(Text, nullable=True)
    related_customer_ids = Column(Text, nullable=True)
    related_device_ids = Column(Text, nullable=True)
    related_regions = Column(Text, nullable=True)
    related_closed_case_ids = Column(Text, nullable=True)
    supporting_evidence = Column(Text, nullable=True)
    policy_rules = Column(Text, nullable=True)

    # Review fields
    analyst_decision = Column(String, nullable=True)  # APPROVE, DO_NOT_FILE
    analyst_notes = Column(Text, nullable=True)
    reviewer_id = Column(String, nullable=True, default="ANALYST")

    # Prepared report draft
    report_reference = Column(String, nullable=True)
    report_draft_json = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    reviewed_at = Column(DateTime, nullable=True)
    prepared_at = Column(DateTime, nullable=True)
    submitted_at = Column(DateTime, nullable=True)


