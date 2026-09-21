import logging
from datetime import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.services.database import engine, Base, SessionLocal
from app.models.investigation import CaseModel
from app.api import health, cases, investigations

logging.basicConfig(level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO))
logger = logging.getLogger("fraud_investigation")

# Initialize database tables
Base.metadata.create_all(bind=engine)

# Ensure customer_id column exists on SQLite cases table
try:
    with engine.connect() as conn:
        from sqlalchemy import text
        conn.execute(text("ALTER TABLE cases ADD COLUMN customer_id VARCHAR;"))
        conn.commit()
except Exception:
    pass

app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="Backend API for AI Fraud Investigation System & TigerGraph Integration"
)

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(health.router)
app.include_router(cases.router)
app.include_router(investigations.router)

@app.on_event("startup")
def seed_initial_cases():
    """
    Seed initial investigation cases into SQLite if database is empty.
    """
    db = SessionLocal()
    try:
        count = db.query(CaseModel).count()
        if count == 0:
            logger.info("Seeding initial fraud investigation cases into SQLite...")
            sample_cases = [
                CaseModel(
                    case_id="CASE-2026-001",
                    status="COMPLETED",
                    verdict="DECLINED",
                    fraud_probability=0.94,
                    pattern="Account Takeover & Device Spoofing",
                    exposure=4340.50,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                    notes="Flagged by high-velocity risk trigger from foreign IP."
                ),
                CaseModel(
                    case_id="CASE-2026-002",
                    status="PENDING",
                    verdict=None,
                    fraud_probability=0.76,
                    pattern="Synthetic ID & Velocity Surge",
                    exposure=12500.00,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                    notes="Multiple new cards registered to disposable email domain."
                ),
                CaseModel(
                    case_id="CASE-2026-003",
                    status="COMPLETED",
                    verdict="APPROVED",
                    fraud_probability=0.08,
                    pattern="Verified Recurring Customer",
                    exposure=120.00,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                    notes="Verified transaction from trusted home device fingerprint."
                ),
                CaseModel(
                    case_id="CASE-2026-004",
                    status="PENDING",
                    verdict=None,
                    fraud_probability=0.62,
                    pattern="Card Testing & Regional Mismatch",
                    exposure=8900.00,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                    notes="Billed in East Europe with US issued card."
                ),
            ]
            db.add_all(sample_cases)
            db.commit()
            logger.info(f"Successfully seeded {len(sample_cases)} sample cases.")
    except Exception as e:
        logger.error(f"Error seeding initial database: {str(e)}")
        db.rollback()
    finally:
        db.close()
