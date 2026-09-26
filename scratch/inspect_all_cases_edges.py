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
    print("=== INSPECTING ALL 20 CLOSEDCASE VERTICES AND EDGES ===", flush=True)

    for i in range(1, 21):
        case_id = f"HHG-{i:03d}"
        v = await tigergraph_service.get_vertex("ClosedCase", case_id)
        print(f"\n--- {case_id} ---", flush=True)
        print(f"Vertex attrs: {json.dumps(v)}", flush=True)
        
        # Check all possible edge types
        edge_types = [
            "INVOLVES", "reverse_INVOLVES", 
            "FOR_CASE", "reverse_FOR_CASE", 
            "CONNECTED_TO", "reverse_CONNECTED_TO"
        ]
        for et in edge_types:
            try:
                edges = await tigergraph_service.get_edges("ClosedCase", case_id, et)
                if edges:
                    print(f"  Edge '{et}': {json.dumps(edges)}", flush=True)
            except Exception as e:
                pass

if __name__ == "__main__":
    asyncio.run(main())
