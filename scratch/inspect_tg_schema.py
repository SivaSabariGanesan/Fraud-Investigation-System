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
    print("=== INSPECTING TIGERGRAPH SCHEMAS & ALL VERTICES ===", flush=True)

    # Fetch 5 sample Transaction vertices directly from TigerGraph if possible
    # We can try getting known transaction IDs or checking edges
    for t_id in ["3530164", "3583227", "3558054", "3581141", "3583368", "3478561", "3534820", "3491361"]:
        v = await tigergraph_service.get_vertex("Transaction", t_id)
        if v:
            print(f"Transaction {t_id}: {json.dumps(v)}", flush=True)
            # Check outgoing edges from this transaction
            for edge_type in ["MADE", "reverse_MADE", "FROM_DEVICE", "reverse_FROM_DEVICE", "BILLED_IN", "reverse_BILLED_IN", "PURCHASER_EMAIL", "reverse_PURCHASER_EMAIL", "INVOLVES", "reverse_INVOLVES"]:
                try:
                    edges = await tigergraph_service.get_edges("Transaction", t_id, edge_type)
                    if edges:
                        print(f"  Txn {t_id} -> {edge_type}: {json.dumps(edges)}", flush=True)
                except Exception as e:
                    pass

    # Check for Customer vertices
    for c_id in ["C08623", "CUST-HHG-001", "CUST-HHG-003", "CUST-HHG-004"]:
        v = await tigergraph_service.get_vertex("Customer", c_id)
        if v:
            print(f"Customer {c_id}: {json.dumps(v)}", flush=True)

if __name__ == "__main__":
    asyncio.run(main())
