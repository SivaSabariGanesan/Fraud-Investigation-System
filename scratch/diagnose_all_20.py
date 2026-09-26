import sys
import os
import asyncio
import json

repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
backend_dir = os.path.join(repo_root, "backend")
sys.path.insert(0, backend_dir)

from dotenv import load_dotenv
load_dotenv(os.path.join(backend_dir, ".env"))

from app.services.tigergraph import tigergraph_service
from app.services.database import SessionLocal
from app.models.investigation import CaseModel

async def diagnose_20():
    db = SessionLocal()
    print("=== DIAGNOSING ALL 20 CASES (TigerGraph vs SQLite) ===", flush=True)

    for i in range(1, 21):
        case_id = f"HHG-{i:03d}"
        print(f"\n--- {case_id} ---", flush=True)
        
        # SQLite
        c_db = db.query(CaseModel).filter(CaseModel.case_id == case_id).first()
        db_txn = c_db.transaction_id if c_db else None
        db_cust = c_db.customer_id if c_db else None
        print(f"SQLite -> txn_id: {db_txn}, cust_id: {db_cust}", flush=True)

        # TigerGraph ClosedCase vertex
        cv = await tigergraph_service.get_vertex("ClosedCase", case_id)
        if cv:
            print(f"TG ClosedCase attrs: {json.dumps(cv)}", flush=True)

        # TG INVOLVES edges
        edges = await tigergraph_service.get_edges("ClosedCase", case_id, "INVOLVES")
        print(f"TG INVOLVES edges count: {len(edges)}", flush=True)
        for e in edges:
            to_id = e.get("to_id")
            print(f"  Edge to_id: {repr(to_id)}", flush=True)
            if to_id:
                txn_v = await tigergraph_service.get_vertex("Transaction", to_id)
                print(f"    Transaction vertex get_vertex: {json.dumps(txn_v)}", flush=True)
                # Check MADE card edges
                card_edges = await tigergraph_service.get_edges("Transaction", to_id, "MADE")
                print(f"    Transaction MADE card edges: {json.dumps(card_edges)}", flush=True)

    db.close()

if __name__ == "__main__":
    asyncio.run(diagnose_20())
