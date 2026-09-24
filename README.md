# Autonomous Fraud Investigation System

An end-to-end, enterprise-grade **Autonomous Fraud Investigation System** integrating a FastAPI backend, persistent SQLite audit storage, real TigerGraph Cloud graph analytics, Groq LLM reasoning (`openai/gpt-oss-120b`), deterministic R1–R10 policy rule evaluation, evidence request lifecycle management, SAR workflow automation, and a modern React + TypeScript + Vite analyst dashboard.

---

## 📐 Architectural Overview & Workflow Diagram

```text
 ┌──────────────────────────────────────────────────────────────────────────────────┐
 │                            ANALYST DASHBOARD (React + TS)                        │
 │   - Interactive Graph Visualizer   - Evidence Request Management Widget          │
 │   - Investigation History Playback  - Chronological Audit Trail Timeline         │
 └────────────────                        ▲                                         │
                                          │ REST API (FastAPI)                      │
 ┌────────────────────────────────────────┴─────────────────────────────────────────┐
 │                            FASTAPI BACKEND ROUTERS                               │
 │   /api/cases   │   /api/investigations   │   /api/evidence-requests   │  /api/sar  │
 └────────────────                        ▲                                         │
                                          │                                         │
 ┌────────────────────────────────────────┴─────────────────────────────────────────┐
 │               12-STEP AUTONOMOUS FRAUD INVESTIGATOR AGENT ENGINE                 │
 │                                                                                  │
 │  1. Graph Query Tools ─────► 2. Evidence Normalizer ──► 3. InvestigationContext  │
 │     (TigerGraph RESTPP)         (collect_and_normalize)    (facts & observations)│
 │                                                                    │             │
 │  6. Final Result ◄────────── 5. Deterministic Policy ◄── 4. Groq LLM Reasoning   │
 │     (InvestigationResult)       (R1–R10 Rule Engine)       (openai/gpt-oss-120b) │
 └───────┬────────────────────────────────┬───────────────────────────┬─────────────┘
         │                                │                           │
         ▼                                ▼                           ▼
 ┌──────────────┐                 ┌──────────────┐            ┌──────────────┐
 │ TIGERGRAPH   │                 │ GROQ LLM API │            │ SQLITE DB    │
 │ CLOUD        │                 │ (Reasoning)  │            │ (fraud.db)   │
 └──────────────┘                 └──────────────┘            └──────────────┘
```

---

## 🚀 Detailed System Capabilities & Technical Architecture

### 1. Real TigerGraph Cloud Integration & RESTPP Traversal
- **Graph Schema (`FraudGraph`)**:
  - Vertices: `ClosedCase`, `Customer`, `Card`, `Transaction`, `DeviceProfile`, `BillingRegion`, `EmailDomain`, `EvidenceRequest`.
  - Edges: `INVOLVES` (`ClosedCase` $\rightarrow$ `Transaction`), `MADE` (`Transaction` $\rightarrow$ `Card`), `OWNS` (`Customer` $\rightarrow$ `Card`), `FROM_DEVICE` (`Transaction` $\rightarrow$ `DeviceProfile`), `BILLED_IN` (`Transaction` $\rightarrow$ `BillingRegion`), `PURCHASER_EMAIL` (`Transaction` $\rightarrow$ `EmailDomain`), `FOR_CASE` (`EvidenceRequest` $\rightarrow$ `ClosedCase`), `CONNECTED_TO` (`ClosedCase` $\rightarrow$ `Card`).
- **Savanna RESTPP Bearer Authentication**:
  - Automatically requests access tokens from `/gsql/v1/tokens` using the configured Database Secret (`TIGERGRAPH_SECRET`).
  - Caches access tokens safely for 6 days with automatic refresh on token expiry or HTTP 401/403 responses.
- **Dynamic & GSQL Query Traversal**:
  - Calls installed GSQL query `hhg003_policy_decision` for case `HHG-003`.
  - Traverses vertex edges dynamically up to multi-hop depth for arbitrary case IDs across FraudGraph.

### 2. Strict Case Isolation & Immutability Invariant
- **Case Boundary Scoping**: All graph traversal, evidence request lookup, and reasoning context generation functions strictly scope queries to the target `case_id`.
- **Evidence Request Immutability**:
  - `EvidenceRequest.case_id` is strictly **IMMUTABLE**. Once created, an evidence request's `case_id` can never be reassigned, overwritten, or mutated by subsequent investigation runs or sync operations.
  - `sync_tigergraph_requests()` enforces that requests belonging to another case are ignored/discarded during sync rather than reassigned.
- **Zero Cross-Case Contamination**:
  - `ER-HHG-003-001` is permanently bound to `HHG-003`.
  - Scanned and verified across all 20 benchmark case files: `ER-HHG-003-001` exists exclusively in `HHG-003.json` and 0 occurrences exist in `HHG-001`..`HHG-020` (excluding HHG-003).

### 3. 12-Step Autonomous Fraud Investigation Workflow
The `FraudInvestigatorAgent` orchestrator executes a 12-step sequence for every investigation run:
1. **Load Case Vertex**: Retrieves `ClosedCase` record from TigerGraph/SQLite.
2. **Retrieve Case Transactions**: Fetches flagged transaction(s) via `ClosedCase` $\rightarrow$ `INVOLVES` $\rightarrow$ `Transaction`.
3. **Retrieve Customer & Card Info**: Fetches card details (`Transaction` $\rightarrow$ `MADE` $\rightarrow$ `Card`) and customer ownership (`Card` $\rightarrow$ `reverse_OWNS` $\rightarrow$ `Customer`).
4. **Retrieve Transaction History**: Fetches historical transactions across customer cards (`Card` $\rightarrow$ `reverse_MADE` $\rightarrow$ `Transaction`).
5. **Retrieve Telemetry Metadata**: Fetches linked device profiles (`FROM_DEVICE`), billing regions (`BILLED_IN`), and purchaser email domains (`PURCHASER_EMAIL`).
6. **Retrieve Connected Entities**: Fetches connected historical cases (`Card` $\rightarrow$ `reverse_CONNECTED_TO` $\rightarrow$ `ClosedCase`).
7. **Retrieve Evidence Requests**: Queries case-scoped evidence requests (`FOR_CASE`).
8. **Normalize Graph Evidence**: Transforms raw graph vertices into structured, un-interpreted `EvidenceItem` instances.
9. **Build InvestigationContext**: Aggregates observed facts, derived metrics (stolen card count, VPN count, regional mismatch count, exposure), and normalized evidence items.
10. **Analyze Context via Groq LLM**: Sends bounded context payload to `openai/gpt-oss-120b` for structured analytical reasoning.
11. **Evaluate Deterministic Policy Rules (R1–R10)**: Evaluates policy rules against reasoning findings and observed facts to compute binding decision states, verdicts, and recommended action lists.
12. **Return InvestigationResult**: Constructs structured result payload, persists run immutably to SQLite, and updates case summary status.

### 4. Groq LLM Reasoning Layer (`openai/gpt-oss-120b`)
- **Strict Evidence Grounding Constraints**:
  - Prohibited from inventing transactions, cards, customers, devices, or customer responses.
  - Prohibited from deciding final fraud verdicts or policy states.
  - Prohibited from converting TigerGraph `risk_score` into a fraud probability percentage.
- **Pending Evidence Guardrail**:
  - When pending evidence requests exist, the LLM prompt and reasoning layer strictly prohibit characterizing transactions as "undisputed" or "confirmed".
  - Automatically appends explicit statement: *"The transaction is subject to a pending customer verification request. No customer response has been received."*
- **Bounded Context Payload**: Limits context payload to top 10 transactions and 15 key evidence items to optimize token usage while preserving essential risk signals.
- **Factual Fallback Mode**: If Groq API or Ollama is unavailable, the reasoning layer operates in factual fallback mode, generating factual evidence summaries without inventing verdicts or mock data.

### 5. Deterministic Policy Engine (R1–R10 Rules)

| Rule ID | Rule Name | Trigger Condition | Output Severity | Primary Effect |
|---|---|---|---|---|
| **R1** | `LOW_RISK_BASELINE` | Single transaction, `max_risk_score` < 0.50, no stolen card, no VPN, no pending request, no dispute, no historical fraud | `INFO` | Baseline clearing for single low-risk transactions |
| **R2** | `PENDING_EVIDENCE_VERIFICATION` | Case has at least one pending evidence request | `MEDIUM` | Requires awaiting customer verification response |
| **R3** | `CUSTOMER_DISPUTE_TRIGGER` | Transaction or case flagged as disputed by customer | `HIGH` | Triggers manual dispute review workflow |
| **R4** | `STOLEN_CARD_FLAG` | Card associated with transaction has `stolen_flag == True` | `CRITICAL` | Binding `CONFIRMED_FRAUD` / `DECLINED` verdict |
| **R5** | `DEVICE_SPOOFING_HIGH_RISK` | `vpn_detected == True` AND `max_risk_score >= 0.70` | `HIGH` | Flags anonymized proxy fraud risk |
| **R6** | `REGIONAL_OR_EMAIL_MISMATCH` | Billing region mismatch flag set OR disposable email domain used | `MEDIUM` | Flags regional/email risk signal |
| **R7** | `LINKED_HISTORICAL_FRAUD` | Customer/card linked to past closed case with `FRAUD_CONFIRMED` verdict | `HIGH` | Flags historical fraud network connection |
| **R8** | `HIGH_VELOCITY_CARD_TESTING` | $\ge 5$ transactions AND $\ge 3$ flagged attempts on card | `CRITICAL` | Binding `CONFIRMED_FRAUD` / `DECLINED` verdict |
| **R9** | `RISK_SCORE_SIGNAL_ONLY` | Always active as an evaluation principle | `INFO` | Enforces that risk score is an investigation signal, NOT a fraud probability or verdict by itself |
| **R10** | `PENDING_EVIDENCE_OVERRIDE` | Pending evidence request exists AND card is NOT stolen AND velocity is NOT critical | `HIGH` | Overrides auto-clearing; holds state at `UNRESOLVED` / `VERIFICATION_PENDING` / `NEEDS_REVIEW` |

#### Decision State Mapping:
- **`CONFIRMED_FRAUD` / `DECLINED`**: Triggered if R4 (Stolen Card) OR R8 (High Velocity) OR (R7 AND `max_risk_score >= 0.70`). Recommended actions: `["BLOCK_CARD", "FILE_SAR_REPORT", "NOTIFY_SECURITY_OPS"]`.
- **`UNRESOLVED` / `VERIFICATION_PENDING` / `NEEDS_REVIEW`**: Triggered if R10 or R2 (Pending Evidence Request). Recommended actions: `["AWAIT_EVIDENCE_RESPONSE", "ASSIGN_ANALYST_QUEUE", "MONITOR_CARD_ACTIVITY"]`. Stop reason: `PENDING_EVIDENCE_RESPONSE`.
- **`UNDER_INVESTIGATION` / `NEEDS_REVIEW`**: Triggered if R3 (Dispute) OR R5 (Device Spoofing) OR R6 (Regional/Email Mismatch). Recommended actions: `["REQUEST_ADDITIONAL_KYC", "REVIEW_DISPUTE_DOCUMENTATION"]`.
- **`CLEARED` / `APPROVED`**: Default state when no critical risk policy rules trigger. Recommended actions: `["CLOSE_CASE", "UNFLAG_TRANSACTION"]`. Stop reason: `WORKFLOW_COMPLETE`.

### 6. Evidence Request Lifecycle & Automated Re-Investigation

```text
 ┌───────────────────────────────────┐
 │     TigerGraph Graph Discovery    │
 │    or Analyst POST /api/requests  │
 └─────────────────┬─────────────────┘
                   │
                   ▼
            [  PENDING  ] ◄──────────────── Case HHG-003 / ER-HHG-003-001
              │       │                     remains PENDING until real response
Record Response│       │ Cancel Request
              │       │
              ▼       ▼
       [ RESPONDED ] [ CANCELLED ]   (Terminal States - 409 Guarded)
              │
              ▼
   Triggers NEW Investigation Run
   - Generates new unique investigation_id (INV-...)
   - Passes customer response into reasoning layer
   - Evaluates deterministic R1–R10 policy engine
   - Immutably persists run to SQLite (prior runs untouched)
   - Emits audit events (EVIDENCE_REQUEST_RESPONDED, INVESTIGATION_STARTED_FROM_EVIDENCE_RESPONSE)
```

- **Non-Reversible Lifecycle**: Once an evidence request enters `RESPONDED` or `CANCELLED`, attempting to modify or respond again returns HTTP 409 Conflict.
- **Audit Logging**: Emits fine-grained audit events (`EVIDENCE_REQUEST_CREATED`, `EVIDENCE_REQUEST_RESPONDED`, `EVIDENCE_REQUEST_CANCELLED`).

### 7. SAR (Suspicious Activity Report) Workflow & State Machine

```text
 [ NOT_RECOMMENDED ] ──► [ CANDIDATE ] ──► [ UNDER_REVIEW ] ──► [ APPROVED ] ──► [ PREPARED ] ──► [ SUBMISSION_PENDING ]
                                │                                    │
                                └────────────────────────────────────┴──► [ NOT_FILED ]
```

- **Deterministic SAR Evaluation**: SAR eligibility is evaluated strictly from confirmed fraud verdicts (`DECLINED` / `CONFIRMED_FRAUD` / R4 / R8 triggers) or high exposure linked to historical fraud networks (R7/R5 + exposure > $1,000 USD).
- **Pending Evidence Exclusion**: If pending evidence requests exist, SAR eligibility is set to `INCONCLUSIVE` / `NOT_RECOMMENDED` because evidence is incomplete.
- **Analyst Review**: `POST /api/cases/{case_id}/sar/review` transitions `CANDIDATE` or `UNDER_REVIEW` to `APPROVED` or `NOT_FILED`.
- **Report Draft Preparation**: `POST /api/cases/{case_id}/sar/prepare` generates a structured internal report draft (`SAR-REP-...`) containing involved transactions, customer IDs, card IDs, device IDs, policy rule triggers, and analyst notes.
- **Submission Tracking**: `POST /api/cases/{case_id}/sar/submission-status` updates status to `SUBMISSION_PENDING` for internal tracking. Setting status directly to `FILED` is rejected with HTTP 400 because external filing API integrations are not configured.
- **Historical Immutability**: Once a SAR record reaches `APPROVED`, re-investigation runs cannot downgrade or overwrite its approved status.

---

## 📁 Repository Sitemap & Directory Structure

```text
Task4/
│
├── backend/
│   ├── app/
│   │   ├── main.py                       # FastAPI application entry point, CORS middleware, startup lifespan
│   │   ├── api/                          # REST API Routers
│   │   │   ├── cases.py                  # GET /api/cases, GET /api/cases/{case_id}, graph visualization, history & audit
│   │   │   ├── investigations.py         # POST /api/investigations/{case_id}, GET /api/investigations/{id}
│   │   │   ├── evidence_requests.py      # Evidence Request lifecycle endpoints (GET, POST, respond, cancel)
│   │   │   ├── sar.py                    # SAR review, report draft preparation & submission tracking
│   │   │   └── health.py                 # GET /health health check endpoint
│   │   ├── agent/                        # Autonomous Agent System
│   │   │   ├── investigator.py           # FraudInvestigatorAgent 12-step workflow orchestrator
│   │   │   ├── reasoning.py              # Groq LLM reasoning layer (openai/gpt-oss-120b)
│   │   │   ├── decision.py               # Deterministic R1–R10 policy engine & verdict evaluator
│   │   │   ├── evidence.py               # EvidenceItem data models & normalization functions
│   │   │   ├── tools.py                  # TigerGraph RESTPP query tool wrappers & transaction validation
│   │   │   ├── context.py                # InvestigationContext builder & metrics aggregation
│   │   │   ├── prompts.py                # System prompts, grounding constraints & templates
│   │   │   ├── schemas.py                # Agent output schemas (InvestigationResult, EvidenceItem)
│   │   │   └── state.py                  # InvestigationState execution tracking
│   │   ├── core/                         # Configuration & Core Settings
│   │   │   └── config.py                 # Settings loader (.env parser via BaseSettings)
│   │   ├── models/                       # SQLAlchemy ORM Models
│   │   │   └── investigation.py          # CaseModel, EvidenceRequestModel, InvestigationModel, InvestigationEvidenceModel, InvestigationActionModel, InvestigationRuleModel, SarRecordModel, AuditEventModel
│   │   ├── schemas/                      # Pydantic DTO Schemas
│   │   │   └── investigation.py          # Request/Response DTOs for Cases, Investigations, Evidence Requests, SAR
│   │   ├── services/                     # Business Logic & Infrastructure Services
│   │   │   ├── tigergraph.py             # Real TigerGraph RESTPP service & Savanna token manager
│   │   │   ├── evidence_request_service.py # Evidence request state machine, immutability & re-investigation trigger
│   │   │   ├── sar_service.py            # SAR lifecycle state machine & draft report generator
│   │   │   ├── history_service.py        # SQLite investigation snapshot persistence & audit event logging
│   │   │   └── database.py               # SQLAlchemy SQLite database engine & SessionLocal setup
│   │   └── database/                     # Persistent Database Storage
│   │       └── fraud.db                  # SQLite database file
│   ├── tests/                            # Pytest Test Suite
│   │   ├── conftest.py                   # Autouse fixture mocking TigerGraph RESTPP calls for offline test execution
│   │   ├── test_case_isolation.py        # Case isolation, scoping & case_id immutability regression tests
│   │   ├── test_evidence_request_lifecycle.py # State machine, 409 conflict guards & audit trail tests
│   │   ├── test_sar_workflow.py          # SAR state machine transitions & immutability tests
│   │   ├── test_graph_visualization.py   # Graph visualizer nodes/edges API tests
│   │   ├── test_groq_reasoning.py        # Groq reasoning layer tests
│   │   ├── test_grounding_regressions.py # Evidence grounding & stop reason tests
│   │   ├── test_investigation_history_audit.py # Snapshot immutability & audit event playback tests
│   │   └── test_real_tigergraph.py       # Live TigerGraph configuration tests
│   └── requirements.txt                  # Python dependencies
│
├── cases/                                # Benchmark Case Answer Files
│   ├── HHG-001.json ... HHG-020.json     # 20 benchmark case answer files
│
├── scratch/                              # Benchmarking & Validation Tools
│   ├── generate_all_cases.py             # Bulk 20 case investigation generator script
│   ├── validate_cases.py                 # Case isolation & schema validation script
│   ├── debug_leaks.py                    # Cross-case evidence leak detection script
│   └── test_ollama.py                    # Local Ollama LLM test script
│
├── frontend/                             # React + TypeScript + Vite Analyst Dashboard
│   ├── src/
│   │   ├── components/                   # Navbar, Sidebar, StatusBadge, AuditTimeline, InvestigationHistoryModal
│   │   ├── pages/                        # Dashboard, Cases, CaseDetails (Visual Graph & Evidence Request UI)
│   │   ├── services/                     # Axios API client (api.ts)
│   │   ├── types/                        # TypeScript interfaces (investigation.ts)
│   │   ├── lib/                          # Utility functions & date formatting
│   │   ├── App.tsx                       # React Router navigation & layout
│   │   └── main.tsx                      # Application entry point
│   ├── package.json                      # Node dependencies & scripts
│   └── vite.config.ts                    # Vite bundler configuration
│
└── README.md                             # Complete System Documentation
```

---

## 🔌 Complete API Reference Table

### 1. Cases & Investigations API
| Method | Endpoint | Query / Body Params | Response Schema | Description |
|---|---|---|---|---|
| `GET` | `/api/cases` | None | `List[CaseResponse]` | Retrieve list of all fraud cases |
| `GET` | `/api/cases/{case_id}` | `case_id: str` | `CaseResponse` | Retrieve single case summary |
| `GET` | `/api/cases/{case_id}/graph` | `case_id: str` | `CaseGraphResponse` | Retrieve normalized graph nodes and edges for visual rendering |
| `POST` | `/api/investigations/{case_id}` | `body: InvestigationRequest` | `InvestigationResult` | Trigger full 12-step autonomous fraud investigation workflow |
| `GET` | `/api/cases/{case_id}/investigations` | `case_id: str` | `InvestigationHistoryResponse` | Retrieve historical investigation runs for a case ID |
| `GET` | `/api/investigations/{investigation_id}` | `investigation_id: str` | `InvestigationDetailResponse` | Retrieve immutable historical snapshot of a specific past investigation run |
| `GET` | `/api/cases/{case_id}/audit` | `case_id: str` | `List[AuditEventItem]` | Retrieve chronological audit log timeline |
| `GET` | `/health` | None | `{"status": "ok"}` | API health check endpoint |

### 2. Evidence Requests Lifecycle API
| Method | Endpoint | Query / Body Params | Response Schema | Description |
|---|---|---|---|---|
| `GET` | `/api/evidence-requests/{case_id}` | `case_id: str` | `List[EvidenceRequestResponse]` | List all evidence requests for a case |
| `GET` | `/api/evidence-requests/{case_id}/{request_id}` | `case_id: str, request_id: str` | `EvidenceRequestResponse` | Fetch single evidence request by ID |
| `POST` | `/api/evidence-requests/{case_id}` | `payload: EvidenceRequestCreate` | `EvidenceRequestResponse` | Create a new `PENDING` evidence request |
| `POST` | `/api/evidence-requests/{request_id}/respond` | `payload: EvidenceRequestRespond` | `EvidenceRequestRespondResult` | Record customer response & trigger new investigation run |
| `POST` | `/api/evidence-requests/{request_id}/cancel` | `payload: EvidenceRequestCancel` | `EvidenceRequestResponse` | Cancel a `PENDING` evidence request with a reason |

### 3. SAR (Suspicious Activity Report) Workflow API
| Method | Endpoint | Query / Body Params | Response Schema | Description |
|---|---|---|---|---|
| `GET` | `/api/cases/{case_id}/sar` | `case_id: str` | `SarRecordResponse` | Retrieve current SAR record for a case |
| `POST` | `/api/cases/{case_id}/sar/review` | `payload: SarReviewRequest` | `SarRecordResponse` | Analyst review (`approve` $\rightarrow$ `APPROVED`, `do_not_file` $\rightarrow$ `NOT_FILED`) |
| `POST` | `/api/cases/{case_id}/sar/prepare` | `payload: SarPrepareRequest` | `SarRecordResponse` | Prepare internal SAR report draft (`APPROVED` $\rightarrow$ `PREPARED`) |
| `POST` | `/api/cases/{case_id}/sar/submission-status` | `payload: SarSubmissionStatusRequest` | `SarRecordResponse` | Update submission status (`PREPARED` $\rightarrow$ `SUBMISSION_PENDING`) |

---

## 📊 Benchmark Cases Suite (HHG-001 through HHG-020)

The repository contains 20 benchmark case answer files in `cases/` generated by running the 12-step autonomous investigator against graph evidence:

| Case ID | Status | Verdict | SAR Status | Evidence Requests | Stop Reason |
|---|---|---|---|---|---|
| **HHG-001** | `CLEARED` | `APPROVED` | `NOT_RECOMMENDED` | 0 requests | `WORKFLOW_COMPLETE` |
| **HHG-002** | `CLEARED` | `APPROVED` | `NOT_RECOMMENDED` | 0 requests | `WORKFLOW_COMPLETE` |
| **HHG-003** | `VERIFICATION_PENDING` | `NEEDS_REVIEW` | `NOT_RECOMMENDED` | 1 pending (`ER-HHG-003-001`) | `PENDING_EVIDENCE_RESPONSE` |
| **HHG-004** | `CLEARED` | `APPROVED` | `NOT_RECOMMENDED` | 0 requests | `WORKFLOW_COMPLETE` |
| **HHG-005** | `CLEARED` | `APPROVED` | `NOT_RECOMMENDED` | 0 requests | `WORKFLOW_COMPLETE` |
| **HHG-006** | `CLEARED` | `APPROVED` | `NOT_RECOMMENDED` | 0 requests | `WORKFLOW_COMPLETE` |
| **HHG-007** | `CLEARED` | `APPROVED` | `NOT_RECOMMENDED` | 0 requests | `WORKFLOW_COMPLETE` |
| **HHG-008** | `CLEARED` | `APPROVED` | `NOT_RECOMMENDED` | 0 requests | `WORKFLOW_COMPLETE` |
| **HHG-009** | `CLEARED` | `APPROVED` | `NOT_RECOMMENDED` | 0 requests | `WORKFLOW_COMPLETE` |
| **HHG-010** | `CLEARED` | `APPROVED` | `NOT_RECOMMENDED` | 0 requests | `WORKFLOW_COMPLETE` |
| **HHG-011** | `CLEARED` | `APPROVED` | `NOT_RECOMMENDED` | 0 requests | `WORKFLOW_COMPLETE` |
| **HHG-012** | `CLEARED` | `APPROVED` | `NOT_RECOMMENDED` | 0 requests | `WORKFLOW_COMPLETE` |
| **HHG-013** | `CLEARED` | `APPROVED` | `NOT_RECOMMENDED` | 0 requests | `WORKFLOW_COMPLETE` |
| **HHG-014** | `CLEARED` | `APPROVED` | `NOT_RECOMMENDED` | 0 requests | `WORKFLOW_COMPLETE` |
| **HHG-015** | `CLEARED` | `APPROVED` | `NOT_RECOMMENDED` | 0 requests | `WORKFLOW_COMPLETE` |
| **HHG-016** | `CLEARED` | `APPROVED` | `NOT_RECOMMENDED` | 0 requests | `WORKFLOW_COMPLETE` |
| **HHG-017** | `CLEARED` | `APPROVED` | `NOT_RECOMMENDED` | 0 requests | `WORKFLOW_COMPLETE` |
| **HHG-018** | `CLEARED` | `APPROVED` | `NOT_RECOMMENDED` | 0 requests | `WORKFLOW_COMPLETE` |
| **HHG-019** | `CLEARED` | `APPROVED` | `NOT_RECOMMENDED` | 0 requests | `WORKFLOW_COMPLETE` |
| **HHG-020** | `CLEARED` | `APPROVED` | `NOT_RECOMMENDED` | 0 requests | `WORKFLOW_COMPLETE` |

---

## ⚙️ Setup & Quickstart Guide

### Prerequisites
- Python 3.10 or higher
- Node.js 18 or higher and `npm`

### 1. Backend Setup & Run
```bash
# 1. Change directory to backend
cd backend

# 2. Install Python dependencies
pip install -r requirements.txt

# 3. Launch FastAPI server
uvicorn app.main:app --reload --port 8000
```
- **Interactive Swagger Documentation**: `http://localhost:8000/docs`
- **Health Check**: `http://localhost:8000/health`

#### Environment Configuration Template (`backend/.env`)
```ini
# Database
DATABASE_URL=sqlite:///./app/database/fraud.db

# TigerGraph Cloud Credentials
TIGERGRAPH_HOST=https://your-tigergraph-instance.cloud.tigergraph.com
TIGERGRAPH_GRAPH_NAME=FraudGraph
TIGERGRAPH_SECRET=your_tigergraph_database_secret_here

# AI / LLM Configuration
LLM_PROVIDER=groq
GROQ_MODEL=openai/gpt-oss-120b
GROQ_API_KEY=your_groq_api_key_here

# App Environment
APP_ENV=development
LOG_LEVEL=INFO
```

### 2. Frontend Setup & Run
```bash
# 1. Change directory to frontend
cd frontend

# 2. Install Node dependencies
npm install

# 3. Start Vite development server
npm run dev
```
- Analyst Dashboard runs locally at `http://localhost:5173`.

---

## 🧪 Testing & Verification Instructions

### 1. Run Backend Pytest Suite
Run the full backend test suite covering case isolation, SAR workflow, evidence request lifecycle, and graph visualization:
```bash
cd backend
py -m pytest tests/test_case_isolation.py tests/test_sar_workflow.py tests/test_evidence_request_lifecycle.py tests/test_graph_visualization.py -v
```
**Expected Outcome**: **61 PASSED, 0 FAILED**

### 2. Validate Benchmark Case Answer Files
Run the case isolation and schema validation script to audit all 20 benchmark case JSON files:
```bash
py scratch/validate_cases.py
```
**Expected Outcome**:
```text
==========================================
TOTAL CASES: 20
VALID JSON: 20
MISSING FILES: 0
EXTRA FILES: 0
CASE ID MISMATCHES: 0
SCHEMA ERRORS: 0
CROSS-CASE EVIDENCE LEAKS: 0
CROSS-CASE EVIDENCE REQUEST LEAKS: 0
CROSS-CASE SAR LEAKS: 0
CROSS-CASE INVESTIGATION LEAKS: 0
FABRICATED CUSTOMER RESPONSES: 0
==========================================
```

### 3. Build Production Frontend Bundle
Compile TypeScript and build Vite production bundle:
```bash
cd frontend
npm run build
```
**Expected Outcome**: **Builds successfully with 0 TypeScript/Vite errors**.

---

## 🔒 Security & Compliance Controls

1. **Secret Redaction in Audit Logs**: The audit event logger (`create_audit_event()`) automatically sanitizes metadata dictionaries to strip sensitive key strings (`secret`, `token`, `password`, `key`, `Authorization`) before persisting to SQLite.
2. **Environment Secret Protection**: Credentials (TigerGraph Database Secret, Groq API key) are read exclusively from environment variables (`.env`) and are never returned in visualizer API payloads.
3. **Offline Test Execution**: Backend test runs use deterministic pytest fixtures (`conftest.py`) to mock TigerGraph RESTPP responses without calling live cloud endpoints, avoiding API failure dependencies while preserving production error handling.
4. **Isolated Snapshot Playback**: Historical investigation runs and audit trails are served directly from SQLite database records, requiring zero calls to external APIs.