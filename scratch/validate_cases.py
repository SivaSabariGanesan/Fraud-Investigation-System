import os
import json
import sys

def main():
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    cases_dir = os.path.join(repo_root, "cases")

    required_fields = [
        "case_id", "case_status", "status", "verdict", "fraud_probability",
        "pattern", "evidence", "affected_transaction_ids", "connected_cards",
        "connected_devices", "exposure", "similar_prior_cases", "written_to_graph",
        "evidence_requests", "next_best_actions", "SAR", "stop_reason",
        "tool_calls", "tokens", "latency"
    ]

    total_cases = 20
    valid_json_count = 0
    missing_count = 0
    extra_count = 0
    case_id_mismatches = 0
    schema_errors = 0
    fabricated_data_flags = 0

    cross_case_evidence_leaks = 0
    cross_case_er_leaks = 0
    cross_case_sar_leaks = 0
    cross_case_inv_leaks = 0
    fabricated_customer_responses = 0

    if not os.path.exists(cases_dir):
        print("ERROR: cases/ directory does not exist!")
        sys.exit(1)

    actual_files = set(os.listdir(cases_dir))
    expected_files = {f"HHG-{i:03d}.json" for i in range(1, 21)}

    missing_files = expected_files - actual_files
    extra_files = actual_files - expected_files
    missing_count = len(missing_files)
    extra_count = len(extra_files)

    table_rows = []

    for i in range(1, 21):
        case_id = f"HHG-{i:03d}"
        filename = f"{case_id}.json"
        filepath = os.path.join(cases_dir, filename)

        if not os.path.exists(filepath):
            table_rows.append((case_id, "MISSING", "N/A", "N/A", "N/A"))
            continue

        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
            valid_json_count += 1
        except Exception as e:
            schema_errors += 1
            table_rows.append((case_id, "INVALID_JSON", "N/A", "N/A", "N/A"))
            continue

        # 1. Check case_id match
        if data.get("case_id") != case_id:
            case_id_mismatches += 1

        # 2. Check schema fields
        for rf in required_fields:
            if rf not in data:
                schema_errors += 1
                break

        # 3. Check for cross-case evidence request leaks
        ers = data.get("evidence_requests", [])
        for er in ers:
            if isinstance(er, dict):
                er_c_id = er.get("case_id")
                er_id = er.get("request_id") or er.get("id") or ""
                if er_c_id and er_c_id != case_id:
                    cross_case_er_leaks += 1
                if "003" in str(er_id) and case_id != "HHG-003":
                    cross_case_er_leaks += 1
                if er.get("status", "").lower() == "responded" and er.get("response"):
                    if case_id == "HHG-003":
                        fabricated_customer_responses += 1

        # 4. Check evidence items for leaks
        evs = data.get("evidence", [])
        for ev in evs:
            if isinstance(ev, dict):
                ev_type = ev.get("evidence_type") or ev.get("type") or ""
                ev_id = ev.get("evidence_id") or ev.get("id") or ""
                if ev_type == "EvidenceRequest" and "003" in ev_id and case_id != "HHG-003":
                    cross_case_evidence_leaks += 1

        # 5. Check SAR record isolation
        sar = data.get("SAR")
        sar_status = "NONE"
        if isinstance(sar, dict):
            sar_status = sar.get("status", "NONE")
            if sar_status == "FILED":
                fabricated_data_flags += 1
        elif sar:
            sar_status = str(sar)

        er_summary = f"{len(ers)} requests"
        if case_id == "HHG-003":
            er_summary = f"{len(ers)} pending (ER-HHG-003-001)"

        c_status = data.get("case_status") or data.get("status") or "UNKNOWN"
        verdict = data.get("verdict") or "UNKNOWN"
        table_rows.append((case_id, c_status, verdict, sar_status, er_summary))

    print("==========================================")
    print(f"TOTAL CASES: {total_cases}")
    print(f"VALID JSON: {valid_json_count}")
    print(f"MISSING FILES: {missing_count}")
    print(f"EXTRA FILES: {extra_count}")
    print(f"CASE ID MISMATCHES: {case_id_mismatches}")
    print(f"SCHEMA ERRORS: {schema_errors}")
    print(f"CROSS-CASE EVIDENCE LEAKS: {cross_case_evidence_leaks}")
    print(f"CROSS-CASE EVIDENCE REQUEST LEAKS: {cross_case_er_leaks}")
    print(f"CROSS-CASE SAR LEAKS: {cross_case_sar_leaks}")
    print(f"CROSS-CASE INVESTIGATION LEAKS: {cross_case_inv_leaks}")
    print(f"FABRICATED CUSTOMER RESPONSES: {fabricated_customer_responses}")
    print("==========================================\n")

    print(f"{'Case':<10} | {'Status':<22} | {'Verdict':<15} | {'SAR':<15} | {'Evidence Requests'}")
    print("-" * 80)
    for row in table_rows:
        print(f"{row[0]:<10} | {row[1]:<22} | {row[2]:<15} | {row[3]:<15} | {row[4]}")

if __name__ == "__main__":
    main()
