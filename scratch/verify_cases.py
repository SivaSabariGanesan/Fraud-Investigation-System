import sys
import os
import asyncio
import json

repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
backend_dir = os.path.join(repo_root, "backend")
sys.path.insert(0, backend_dir)

from dotenv import load_dotenv
load_dotenv(os.path.join(backend_dir, ".env"))

from app.core.config import settings
settings.USE_LOCAL_LLM = True

from app.agent.investigator import investigate

async def main():
    target_cases = ["HHG-001", "HHG-003", "HHG-007", "HHG-008"]
    print("=== DIRECT VERIFICATION FOR HHG-001, HHG-003, HHG-007, HHG-008 ===", flush=True)

    for case_id in target_cases:
        print(f"\nInvestigating {case_id}...", flush=True)
        res = await investigate(case_id)
        print(f"Case: {res.case_id}", flush=True)
        print(f"  customer_id: {res.customer_id}", flush=True)
        print(f"  transaction IDs: {res.affected_transaction_ids}", flush=True)
        print(f"  card IDs: {res.connected_card_ids}", flush=True)
        print(f"  device IDs: {res.connected_device_ids}", flush=True)
        print(f"  exposure: {res.exposure}", flush=True)
        print(f"  evidence count: {len(res.evidence)}", flush=True)
        print(f"  evidence request count: {len(res.evidence_requests)}", flush=True)

if __name__ == "__main__":
    asyncio.run(main())
