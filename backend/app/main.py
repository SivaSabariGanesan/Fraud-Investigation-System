import logging
from datetime import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.services.database import engine, Base, SessionLocal
from app.models.investigation import CaseModel, EvidenceRequestModel
from app.api import health, cases, investigations
from app.api import evidence_requests

logging.basicConfig(level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO))
logger = logging.getLogger("fraud_investigation")

# Initialize database tables (creates all tables including evidence_requests)
Base.metadata.create_all(bind=engine)

# Runtime schema migrations for existing SQLite databases
_migrations = [
    "ALTER TABLE cases ADD COLUMN customer_id VARCHAR;",
]
try:
    with engine.connect() as conn:
        from sqlalchemy import text
        for stmt in _migrations:
            try:
                conn.execute(text(stmt))
                conn.commit()
            except Exception:
                # Column already exists or other benign error — continue
                pass
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
app.include_router(evidence_requests.router)


@app.on_event("startup")
def seed_initial_data():
    """
    Seed initial investigation cases into SQLite if the database is empty.

    HHG-003 is seeded as a PENDING case stub so it appears in the case list
    and its evidence request (ER-HHG-003-001 from TigerGraph) has a parent.
    HHG-003 status is NOT set to COMPLETED or CLEARED — it remains PENDING
    until the analyst runs an actual investigation via POST /api/investigations/HHG-003.

    CRITICAL: ER-HHG-003-001 is NOT seeded here with any response.
    It will be synced from TigerGraph the first time HHG-003 is investigated
    via sync_tigergraph_requests(), which is idempotent and never overwrites
    lifecycle state.
    """
    db = SessionLocal()
    try:
        count = db.query(CaseModel).count()
        if count == 0:
            logger.info("Seeding initial fraud investigation cases into SQLite...")
            now = datetime.utcnow()
            sample_cases = [
                CaseModel(
                    case_id="CASE-2026-001",
                    status="COMPLETED",
                    verdict="DECLINED",
                    fraud_probability=0.94,
                    pattern="Account Takeover & Device Spoofing",
                    exposure=4340.50,
                    created_at=now,
                    updated_at=now,
                    notes="Flagged by high-velocity risk trigger from foreign IP."
                ),
                CaseModel(
                    case_id="CASE-2026-002",
                    status="PENDING",
                    verdict=None,
                    fraud_probability=0.76,
                    pattern="Synthetic ID & Velocity Surge",
                    exposure=12500.00,
                    created_at=now,
                    updated_at=now,
                    notes="Multiple new cards registered to disposable email domain."
                ),
                CaseModel(
                    case_id="CASE-2026-003",
                    status="COMPLETED",
                    verdict="APPROVED",
                    fraud_probability=0.08,
                    pattern="Verified Recurring Customer",
                    exposure=120.00,
                    created_at=now,
                    updated_at=now,
                    notes="Verified transaction from trusted home device fingerprint."
                ),
                CaseModel(
                    case_id="CASE-2026-004",
                    status="PENDING",
                    verdict=None,
                    fraud_probability=0.62,
                    pattern="Card Testing & Regional Mismatch",
                    exposure=8900.00,
                    created_at=now,
                    updated_at=now,
                    notes="Billed in East Europe with US issued card."
                ),
                # HHG-003: seeded as PENDING stub so it appears in the case list.
                # Actual status/verdict is determined by running the investigation agent.
                CaseModel(
                    case_id="HHG-003",
                    customer_id="C08623",
                    status="PENDING",
                    verdict=None,
                    fraud_probability=None,
                    pattern=None,
                    exposure=49.00,
                    created_at=now,
                    updated_at=now,
                    notes=(
                        "HHG-003: Hacker House Goa case. Customer C08623. "
                        "Transaction 3530164 ($49.00). "
                        "Evidence request ER-HHG-003-001 PENDING from TigerGraph. "
                        "Do not simulate customer response."
                    )
                ),
            ]
            db.add_all(sample_cases)
            db.commit()
            logger.info("Successfully seeded %d sample cases.", len(sample_cases))
    except Exception as e:
        logger.error("Error seeding initial database: %s", str(e))
        db.rollback()
    finally:
        db.close()
