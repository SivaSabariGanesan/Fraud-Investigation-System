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

async def diagnose():
    print("--- Diagnosing TigerGraph Connection & Traversal ---", flush=True)
    print(f"Host: {tigergraph_service.host}", flush=True)
    print(f"Graph: {tigergraph_service.graph_name}", flush=True)
    print(f"Is Configured: {tigergraph_service.is_configured()}", flush=True)

    if not tigergraph_service.is_configured():
        print("TigerGraph is NOT configured!", flush=True)
        return

    for case_id in ["HHG-001", "HHG-003", "HHG-007", "HHG-008"]:
        print(f"\n================ Case: {case_id} ================", flush=True)
        try:
            cv = await tigergraph_service.get_vertex("ClosedCase", case_id)
            print(f"ClosedCase vertex ({case_id}): {json.dumps(cv)}", flush=True)
        except Exception as e:
            print(f"Error getting ClosedCase vertex ({case_id}): {e}", flush=True)

        for edge_type in ["INVOLVES", "reverse_INVOLVES", "MADE", "reverse_MADE", "FOR_CASE", "reverse_FOR_CASE"]:
            try:
                edges = await tigergraph_service.get_edges("ClosedCase", case_id, edge_type)
                if edges:
                    print(f"  ClosedCase edge '{edge_type}': {json.dumps(edges)}", flush=True)
                else:
                    print(f"  ClosedCase edge '{edge_type}': []", flush=True)
            except Exception as e:
                print(f"  Error checking ClosedCase edge '{edge_type}': {e}", flush=True)

if __name__ == "__main__":
    asyncio.run(diagnose())
