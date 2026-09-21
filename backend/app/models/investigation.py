from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, Text
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
