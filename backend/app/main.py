import logging
from datetime import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.services.database import engine, Base, SessionLocal
from app.models.investigation import CaseModel, EvidenceRequestModel
from app.api import health, cases, investigations, evidence_requests, sar


logging.basicConfig(level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO))
logger = logging.getLogger("fraud_investigation")

# Initialize database tables (creates all tables including evidence_requests)
Base.metadata.create_all(bind=engine)

# Runtime schema migrations for existing SQLite databases
_migrations = [
    "ALTER TABLE cases ADD COLUMN customer_id VARCHAR;",
    "ALTER TABLE cases ADD COLUMN transaction_id VARCHAR;",
    "ALTER TABLE cases ADD COLUMN trigger_type VARCHAR;",
    "ALTER TABLE cases ADD COLUMN trigger_text TEXT;",
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

# ── Data integrity repair ──────────────────────────────────────────────────
# Correct any evidence request rows whose case_id was misassigned due to test
# cross-contamination (e.g., ER-HHG-003-001 stored under TEST-ER-CREDS).
# This is a one-time idempotent repair that runs on every startup.
_KNOWN_REQUEST_CASE_MAP = {
    "ER-HHG-003-001": "HHG-003",
}
try:
    _repair_db = SessionLocal()
    for _req_id, _correct_case_id in _KNOWN_REQUEST_CASE_MAP.items():
        _er = _repair_db.query(EvidenceRequestModel).filter(
            EvidenceRequestModel.request_id == _req_id
        ).first()
        if _er and _er.case_id != _correct_case_id:
            logger.warning(
                "Startup repair: correcting case_id for %s from %r to %r",
                _req_id, _er.case_id, _correct_case_id,
            )
            _er.case_id = _correct_case_id
            _er.updated_at = datetime.utcnow()
            _repair_db.commit()
    _repair_db.close()
except Exception as _repair_exc:
    logger.warning("Startup data-integrity repair failed: %s", _repair_exc)

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
app.include_router(sar.router)




@app.on_event("startup")
def seed_initial_data():
    """
    Seed initial benchmark cases (HHG-001 to HHG-020) into SQLite database.
    Removes legacy dummy test cases (e.g., CASE-2026-*, TEST-ER-*, DEMO-*, DUP-TEST-*)
    so only valid benchmark cases HHG-001 through HHG-020 populate the database.
    """
    import os
    import json

    db = SessionLocal()
    try:
        # 1. Purge legacy dummy sample cases from database (do NOT delete manual cases)
        legacy_patterns = ["CASE-2026-%", "DEMO-%", "DUP-TEST-%", "TEST-ER-%"]
        from sqlalchemy import or_
        filters = [CaseModel.case_id.like(pat) for pat in legacy_patterns]
        dummy_cases = db.query(CaseModel).filter(or_(*filters)).all()
        if dummy_cases:
            logger.info("Purging %d legacy dummy sample case(s) from SQLite database...", len(dummy_cases))
            for dummy in dummy_cases:
                db.delete(dummy)
            db.commit()

        # 2. Seed HHG-001 through HHG-020 benchmark cases
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        cases_dir = os.path.join(base_dir, "cases")
        if not os.path.exists(cases_dir):
            cases_dir = os.path.abspath("cases")

        now = datetime.utcnow()
        seeded_count = 0

        for i in range(1, 21):
            case_id = f"HHG-{i:03d}"
            existing = db.query(CaseModel).filter(CaseModel.case_id == case_id).first()

            filepath = os.path.join(cases_dir, f"{case_id}.json")
            if os.path.exists(filepath):
                try:
                    with open(filepath, "r", encoding="utf-8") as f:
                        data = json.load(f)

                    cust_id = data.get("customer_id") or f"CUST-{case_id}"
                    status = data.get("case_status") or data.get("status") or "CLEARED"
                    verdict = data.get("verdict")
                    fraud_prob = data.get("fraud_probability")
                    pattern = data.get("pattern") or "Standard Benchmark Case"
                    exposure = float(data.get("exposure") or 0.0)

                    aff_txns = data.get("affected_transaction_ids", [])
                    txn_id = str(aff_txns[0]) if aff_txns else None

                    opened_at_str = None
                    for ev in data.get("evidence", []):
                        if ev.get("type") == "ClosedCase" or ev.get("evidence_type") == "ClosedCase":
                            opened_at_str = (ev.get("raw_data") or {}).get("opened_at") or (ev.get("details") or {}).get("opened_at")
                            break
                    
                    created_at = now
                    if opened_at_str:
                        try:
                            created_at = datetime.strptime(opened_at_str, "%Y-%m-%d %H:%M:%S")
                        except Exception:
                            pass

                    trig_type = data.get("trigger_type") or "benchmark"
                    trig_text = data.get("trigger_text") or f"Benchmark case {case_id}"

                    if existing:
                        # Ensure fields are correctly synced from benchmark file
                        existing.customer_id = cust_id
                        existing.transaction_id = txn_id or existing.transaction_id
                        existing.trigger_type = trig_type or existing.trigger_type
                        existing.trigger_text = trig_text or existing.trigger_text
                        existing.pattern = pattern or existing.pattern
                        if existing.exposure is None or existing.exposure == 0.0:
                            existing.exposure = exposure
                    else:
                        new_case = CaseModel(
                            case_id=case_id,
                            customer_id=cust_id,
                            transaction_id=txn_id,
                            trigger_type=trig_type,
                            trigger_text=trig_text,
                            status=status,
                            verdict=verdict,
                            fraud_probability=fraud_prob,
                            pattern=pattern,
                            exposure=exposure,
                            created_at=created_at,
                            updated_at=created_at,
                            notes=f"Hacker House Goa Benchmark Case {case_id}"
                        )
                        db.add(new_case)
                        seeded_count += 1
                except Exception as file_err:
                    logger.warning("Error loading benchmark file for %s: %s", case_id, file_err)
            else:
                if not existing:
                    new_case = CaseModel(
                        case_id=case_id,
                        customer_id=None,
                        status="CLEARED",
                        verdict="APPROVED",
                        exposure=0.0,
                        pattern="Standard Benchmark Case",
                        created_at=now,
                        updated_at=now,
                        notes=f"Hacker House Goa Benchmark Case {case_id}"
                    )
                    db.add(new_case)
                    seeded_count += 1

        db.commit()
        if seeded_count > 0:
            logger.info("Successfully seeded %d HHG benchmark cases into SQLite.", seeded_count)
    except Exception as e:
        logger.error("Error in seed_initial_data: %s", str(e))
        db.rollback()
    finally:
        db.close()

