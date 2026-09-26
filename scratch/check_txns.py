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

CASES_METADATA = [
    ("HHG-001", "2016-12-05 01:55:28", "risk_score", "Real-time model scored transaction 3514030 ($77.07, in billing region 444.0) at 0.61. Review and decide.", "3514030", "C12382-K1", "C12382", 0.61),
    ("HHG-002", "2016-11-22 23:27:07", "risk_score", "Real-time model scored transaction 3478782 ($292.36, online) at 0.79. Review and decide.", "3478782", "C11891-K1", "C11891", 0.79),
    ("HHG-003", "2016-12-10 15:01:21", "customer_report", "Customer C08623 message: 'I never made this $49.00 purchase. Please check my card.' Refers to 3530164.", "3530164", "C08623-K2", "C08623", None),
    ("HHG-004", "2016-12-29 07:53:54", "customer_report", "Customer C08106 message: 'I never made this $128.33 purchase. Please check my card.' Refers to 3583227.", "3583227", "C08106-K1", "C08106", None),
    ("HHG-005", "2016-12-08 03:38:37", "risk_score", "Real-time model scored transaction 3523199 ($100.07, online) at 0.54. Review and decide.", "3523199", "C02923-K1", "C02923", 0.54),
    ("HHG-006", "2016-11-22 02:30:00", "customer_report", "Customer C07297 message: 'I never made this $482.12 purchase. Please check my card.' Refers to 3476682.", "3476682", "C07297-K1", "C07297", None),
    ("HHG-007", "2016-12-05 03:46:14", "risk_score", "Real-time model scored transaction 3514948 ($111.92, in billing region 264.0) at 0.87. Review and decide.", "3514948", "C09933-K2", "C09933", 0.87),
    ("HHG-008", "2016-12-20 03:08:56", "customer_report", "Customer C13171 message: 'I never made this $55.68 purchase. Please check my card.' Refers to 3558054.", "3558054", "C13171-K2", "C13171", None),
    ("HHG-009", "2016-12-28 17:10:53", "customer_report", "Customer C08299 message: 'I never made this $30.02 purchase. Please check my card.' Refers to 3581141.", "3581141", "C08299-K1", "C08299", None),
    ("HHG-010", "2016-12-02 18:18:27", "risk_score", "Real-time model scored transaction 3506725 ($1,000.03, online) at 0.90. Review and decide.", "3506725", "C10434-K1", "C10434", 0.90),
    ("HHG-011", "2016-12-29 06:27:44", "customer_report", "Customer C11923 message: 'I never made this $131.30 purchase. Please check my card.' Refers to 3583368.", "3583368", "C11923-K2", "C11923", None),
    ("HHG-012", "2016-12-18 05:00:31", "risk_score", "Real-time model scored transaction 3553342 ($30.91, in billing region 494.0) at 0.55. Review and decide.", "3553342", "C05876-K2", "C05876", 0.55),
    ("HHG-013", "2016-12-09 05:39:29", "risk_score", "Real-time model scored transaction 3526826 ($35.66, online) at 0.76. Review and decide.", "3526826", "C07671-K2", "C07671", 0.76),
    ("HHG-014", "2016-11-22 20:11:00", "analyst_request", "Analyst request: several cards this month show purchases from the same unusual device profile. Review transaction 3478561 on card C13487-K1 and look for related activity.", "3478561", "C13487-K1", "C13487", None),
    ("HHG-015", "2016-11-17 19:03:36", "risk_score", "Real-time model scored transaction 3464869 ($599.94, online) at 0.77. Review and decide.", "3464869", "C03042-K1", "C03042", 0.77),
    ("HHG-016", "2016-12-12 01:39:08", "customer_report", "Customer C09988 message: 'I never made this $59.67 purchase. Please check my card.' Refers to 3534820.", "3534820", "C09988-K1", "C09988", None),
    ("HHG-017", "2016-11-12 00:46:24", "risk_score", "Real-time model scored transaction 3450629 ($100.09, online) at 0.57. Review and decide.", "3450629", "C04570-K1", "C04570", 0.57),
    ("HHG-018", "2016-11-27 14:41:26", "customer_report", "Customer C02354 message: 'I never made this $39.08 purchase. Please check my card.' Refers to 3491361.", "3491361", "C02354-K2", "C02354", None),
    ("HHG-019", "2016-12-01 22:28:53", "risk_score", "Real-time model scored transaction 3503878 ($99.92, online) at 0.90. Review and decide.", "3503878", "C07987-K2", "C07987", 0.90),
    ("HHG-020", "2016-12-03 12:04:26", "risk_score", "Real-time model scored transaction 3509359 ($125.08, online) at 0.52. Review and decide.", "3509359", "C12265-K2", "C12265", 0.52),
]

async def check_transactions():
    for case_id, opened_at, trig_type, trig_text, txn_id, card_id, cust_id, risk_score in CASES_METADATA:
        t_v = await tigergraph_service.get_vertex("Transaction", txn_id)
        c_v = await tigergraph_service.get_vertex("Customer", cust_id)
        card_v = await tigergraph_service.get_vertex("Card", card_id)
        print(f"{case_id} -> Txn {txn_id}: {'FOUND' if t_v else 'MISSING'}, Cust {cust_id}: {'FOUND' if c_v else 'MISSING'}, Card {card_id}: {'FOUND' if card_v else 'MISSING'}")

if __name__ == "__main__":
    asyncio.run(check_transactions())
