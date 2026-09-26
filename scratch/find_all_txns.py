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

async def main():
    print("=== SEARCHING FOR ALL TRANSACTIONS LINKED TO HHG CASES ===", flush=True)

    # Let's inspect installed queries or run a GSQL query or search vertices
    # First, let's test if there is an installed query or RESTPP query endpoint for vertices
    # Let's check restpp/graph/FraudGraph/vertices/Transaction for sample vertices
    url = f"{tigergraph_service.host}/restpp/graph/{tigergraph_service.graph_name}/vertices/Transaction?limit=100"
    headers = await tigergraph_service._get_auth_headers()
    
    import httpx
    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.get(url, headers=headers)
        if res.status_code == 200:
            txns = res.json().get("results", [])
            print(f"Total sample transactions fetched: {len(txns)}", flush=True)
            for t in txns:
                v_id = t.get("v_id")
                attr = t.get("attributes", {})
                # Check reverse_INVOLVES edges for this transaction
                edges = await tigergraph_service.get_edges("Transaction", v_id, "reverse_INVOLVES")
                case_ids = [e.get("to_id") for e in edges]
                if case_ids:
                    print(f"Txn {v_id} (amount={attr.get('amount')}, risk={attr.get('risk_score')}) -> Cases: {case_ids}", flush=True)
                else:
                    print(f"Txn {v_id} (amount={attr.get('amount')}, risk={attr.get('risk_score')}) -> No case edge", flush=True)

if __name__ == "__main__":
    asyncio.run(main())
