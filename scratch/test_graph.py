import sys
sys.path.insert(0, 'backend')
from dotenv import load_dotenv
load_dotenv('backend/.env')
import asyncio
import json
from app.main import app
from app.api.cases import get_case_graph
from app.services.database import SessionLocal
from app.models.investigation import CaseModel, InvestigationModel, AuditEventModel, EvidenceRequestModel

async def main():
    db = SessionLocal()
    # Ensure DEMO-001 is present
    c = db.query(CaseModel).filter(CaseModel.case_id == 'DEMO-001').first()
    if not c:
        c = CaseModel(
            case_id='DEMO-001',
            customer_id='C08623',
            transaction_id='3530164',
            trigger_type='customer_report',
            trigger_text='I never made this purchase.',
            status='UNDER_INVESTIGATION',
            exposure=49.00
        )
        db.add(c)
        db.commit()

    res = await get_case_graph("DEMO-001", db)
    res_hhg = await get_case_graph("HHG-003", db)

    out = []
    out.append("=== DEMO-001 GRAPH NODES ===")
    for n in res.nodes:
        out.append(f"ID: {n.id} | Type: {n.type} | Label: {n.label}")

    out.append("\n=== DEMO-001 GRAPH EDGES ===")
    for e in res.edges:
        out.append(f"Edge: {e.id} | Type: {e.type} | {e.source} -> {e.target}")

    out.append(f"\nHHG-003 Nodes count: {len(res_hhg.nodes)}")
    out.append(f"HHG-003 Edges count: {len(res_hhg.edges)}")

    with open("scratch/graph_result.txt", "w") as f:
        f.write("\n".join(out))

    db.close()

if __name__ == "__main__":
    asyncio.run(main())
