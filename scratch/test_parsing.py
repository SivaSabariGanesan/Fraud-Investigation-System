import sys
import os
import asyncio
import json
import re

repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
backend_dir = os.path.join(repo_root, "backend")
sys.path.insert(0, backend_dir)

from dotenv import load_dotenv
load_dotenv(os.path.join(backend_dir, ".env"))

from app.services.tigergraph import tigergraph_service

def parse_text_transaction(case_id: str, raw_id: str) -> dict:
    """
    Parses a text-encoded TigerGraph edge destination into a structured transaction vertex.
    """
    # Regex to extract risk score after 'at '
    risk_match = re.search(r'at\s+([0-9]+\.[0-9]+)', raw_id)
    risk_score = float(risk_match.group(1)) if risk_match else 0.50

    # Regex to extract amount after 'region ' or before ') at'
    amount_match = re.search(r'region\s+([0-9]+\.[0-9]+)', raw_id) or re.search(r'([0-9]+\.[0-9]+)\s*\)\s*at', raw_id)
    amount = float(amount_match.group(1)) if amount_match else 49.00

    channel = "online" if "online" in raw_id.lower() else "in_person"
    clean_id = f"TXN-{case_id}"

    return {
        "id": clean_id,
        "TransactionID": clean_id,
        "transaction_id": clean_id,
        "amount": amount,
        "risk_score": risk_score,
        "channel": channel,
        "status": "SUSPICIOUS" if risk_score >= 0.50 else "APPROVED",
        "raw_edge_id": raw_id
    }

async def main():
    print("=== TESTING TRANSACTIONS PARSING FOR ALL 20 CASES ===", flush=True)

    for i in range(1, 21):
        case_id = f"HHG-{i:03d}"
        edges = await tigergraph_service.get_edges("ClosedCase", case_id, "INVOLVES")
        if not edges:
            print(f"{case_id}: NO EDGES", flush=True)
            continue

        for e in edges:
            to_id = e.get("to_id")
            if not to_id:
                continue

            # Check if to_id is a numeric transaction ID vertex in TigerGraph
            txn_v = await tigergraph_service.get_vertex("Transaction", to_id)
            if txn_v and txn_v.get("amount", 0) > 0:
                print(f"{case_id} [Real TG Vertex]: ID={to_id}, amount={txn_v.get('amount')}, risk={txn_v.get('risk_score')}", flush=True)
            else:
                parsed = parse_text_transaction(case_id, to_id)
                print(f"{case_id} [Parsed Text Edge]: ID={parsed['id']}, amount={parsed['amount']}, risk={parsed['risk_score']}, channel={parsed['channel']}", flush=True)

if __name__ == "__main__":
    asyncio.run(main())
