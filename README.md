# Autonomous Fraud Investigation System

An end-to-end **Autonomous Fraud Investigation System** integrating a FastAPI backend, SQLite persistent audit storage, real TigerGraph Cloud graph database, Groq LLM reasoning (`openai/gpt-oss-120b`), deterministic R1–R10 policy engine, evidence request lifecycle management, and a modern React + TypeScript + Vite analyst dashboard.

---

## 🚀 Key Features & Capabilities

- **Real TigerGraph Cloud Graph Analytics**:
  - Connects to TigerGraph Cloud `FraudGraph` schema (`Customer`, `Card`, `Transaction`, `DeviceProfile`, `BillingRegion`, `EmailDomain`, `ClosedCase`, `EvidenceRequest`).
  - Dynamic GSQL query invocation via Savanna RESTPP authentication (Token auto-generated & refreshed using Database Secret, no plain-text token exposure).
  - Traverses graph relationships up to multi-hop connections for any arbitrary `case_id`.

- **Groq LLM Reasoning Layer (`openai/gpt-oss-120b`)**:
  - Analyzes normalized graph evidence and outputs structured reasoning summaries grounded strictly in evidence.
  - Strictly prohibited from making final fraud decisions (fraud decision logic is reserved for the deterministic policy engine).
  - Enforces prompt-level constraints (e.g., cannot claim transactions are "undisputed" when pending customer evidence requests exist).

- **Deterministic Policy Engine (R1–R10)**:
  - Evaluates rules including stolen card status, chargeback history, device fingerprint sharing, high velocity, disposable email usage, regional mismatch, and pending evidence requests.
  - Outputs binding verdicts (`FRAUD_CONFIRMED`, `VERIFICATION_PENDING`, `NO_ACTION_REQUIRED`), SAR recommendations, and action lists.

- **Evidence Request Lifecycle Management**:
  - Full state-machine workflow: `PENDING` $\rightarrow$ `RESPONDED` or `CANCELLED` (terminal states with validation).
  - **Immutable Re-investigation**: Recording a genuine customer response via `/api/evidence-requests/{request_id}/respond` automatically triggers a brand-new investigation run (`INV-...`), incorporating the customer response into the reasoning layer while preserving all previous runs untouched.
  - **TigerGraph Idempotent Sync**: Discovered `EvidenceRequest` vertices (e.g., `ER-HHG-003-001`) are synced into SQLite as `PENDING` without overwriting existing lifecycle states.
  - **Grounding Constraints**: Case `HHG-003` / `ER-HHG-003-001` remains strictly `PENDING` until an analyst submits a real response (no simulated or fabricated responses).
  - **Comprehensive Audit Trail**: Emits dedicated audit events (`EVIDENCE_REQUEST_CREATED`, `EVIDENCE_REQUEST_RESPONDED`, `EVIDENCE_REQUEST_CANCELLED`, `INVESTIGATION_STARTED_FROM_EVIDENCE_RESPONSE`).

- **Persistent Investigation History & Audit Trail**:
  - Every agent run persists an immutable, complete snapshot to SQLite (`investigations`, `investigation_evidence`, `investigation_actions`, `investigation_rules`, `audit_events`).
  - Step-by-step workflow audit events (`INVESTIGATION_STARTED`, `EVIDENCE_COLLECTED`, `LLM_REASONING_COMPLETED`, `POLICY_EVALUATED`, `DECISION_GENERATED`, `INVESTIGATION_COMPLETED`).
  - Instant historical playback served directly from SQLite without re-querying TigerGraph or Groq APIs.

- **Fraud Investigation Analyst Dashboard (React + TypeScript + Tailwind CSS)**:
  - Dynamic routing (`/cases/:caseId`).
  - Interactive case evidence graphs, transaction breakdown with individual timestamps, and customer entity grounding.
  - **Interactive Evidence Requests Section**: Create verification requests, view status badges (`PENDING`, `RESPONDED`, `CANCELLED`), record customer responses with one-click re-investigation, and cancel pending requests.
  - **Investigation History Modal**: View exact past investigation runs, R1–R10 rule results, and snapshots.
  - **Chronological Audit Log**: Visual timeline showing fine-grained workflow lifecycle events.

---

## 📁 Project Structure

```text
Fraud-Investigation-System/
│
├── backend/
│   ├── app/
│   │   ├── main.py                       # FastAPI entry point, CORS, startup migrations & seed data
│   │   │
│   │   ├── api/                          # REST API Endpoints
│   │   │   ├── cases.py                  # GET /api/cases, GET /api/cases/{case_id}, history & audit endpoints
│   │   │   ├── investigations.py         # POST /api/investigations/{case_id}, GET /api/investigations/{id}
│   │   │   ├── evidence_requests.py      # Evidence Request lifecycle endpoints (GET, POST, respond, cancel)
│   │   │   └── health.py                 # GET /health
│   │   │
│   │   ├── agent/                        # Autonomous Agent Architecture
│   │   │   ├── investigator.py           # FraudInvestigatorAgent workflow orchestrator
│   │   │   ├── reasoning.py              # Groq LLM reasoning layer (openai/gpt-oss-120b)
│   │   │   ├── decision.py               # Deterministic R1–R10 policy engine
│   │   │   ├── evidence.py               # Graph evidence normalization
│   │   │   ├── tools.py                  # TigerGraph query tools
│   │   │   ├── context.py                # Investigation context builder
│   │   │   ├── prompts.py                # System prompts & grounding rules
│   │   │   └── schemas.py                # Agent data models & output schemas
│   │   │
│   │   ├── core/                         # Configuration & security
│   │   │   └── config.py                 # Settings loader (.env parser)
│   │   │
│   │   ├── models/                       # SQLAlchemy ORM Models
│   │   │   └── investigation.py          # CaseModel, EvidenceRequestModel, InvestigationModel, AuditEventModel
│   │   │
│   │   ├── schemas/                      # Pydantic API Data Models
│   │   │   └── investigation.py          # Evidence request DTOs, response schemas, CaseResponse
│   │   │
│   │   ├── services/                     # Backend Services
│   │   │   ├── database.py               # SQLAlchemy SQLite setup (fraud.db)
│   │   │   ├── tigergraph.py             # Real TigerGraph RESTPP & token service
│   │   │   ├── history_service.py        # Investigation snapshot & audit trail persistence
│   │   │   └── evidence_request_service.py # Evidence request state machine, sync & re-investigation
│   │   │
│   │   └── database/                     # SQLite Storage (fraud.db)
│   │
│   ├── tests/                            # Backend Pytest Test Suite (58 tests across 5 test suites)
│   │   ├── test_real_tigergraph.py
│   │   ├── test_groq_reasoning.py
│   │   ├── test_grounding_regressions.py
│   │   ├── test_investigation_history_audit.py
│   │   └── test_evidence_request_lifecycle.py
│   │
│   ├── requirements.txt                  # Python dependencies (FastAPI, SQLAlchemy, Groq, httpx, etc.)
│   └── .env                              # Environment variables (Credentials)
│
├── frontend/
│   ├── src/
│   │   ├── components/                   # Navbar, Sidebar, StatusBadge, AuditTimeline, InvestigationHistoryModal
│   │   ├── pages/                        # Dashboard, Cases, CaseDetails (with Evidence Request lifecycle UI)
│   │   ├── services/                     # Axios API client (api.ts) with evidence request endpoints
│   │   ├── types/                        # TypeScript interfaces (investigation.ts)
│   │   ├── lib/                          # Utilities & date formatting
│   │   ├── App.tsx                       # Routing & layout
│   │   └── main.tsx                      # Entry point
│   │
│   ├── package.json                      # Node dependencies & scripts
│   └── vite.config.ts                    # Vite bundler configuration
│
└── README.md                             # Documentation
```

---

## 🔌 API Endpoints Reference

### Cases & Investigations
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/cases` | List all fraud investigation cases |
| `GET` | `/api/cases/{case_id}` | Retrieve case summary, customer, and current verdict |
| `POST` | `/api/investigations/{case_id}` | Trigger full 12-step autonomous investigation run |
| `GET` | `/api/cases/{case_id}/investigations` | List historical investigation runs for a case |
| `GET` | `/api/cases/{case_id}/investigations/{investigation_id}` | Fetch immutable snapshot of a specific past investigation |
| `GET` | `/api/cases/{case_id}/audit` | Retrieve chronological audit timeline for a case |
| `GET` | `/health` | API health check |

### Evidence Requests Lifecycle
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/evidence-requests/{case_id}` | List all evidence requests for a case |
| `GET` | `/api/evidence-requests/{case_id}/{request_id}` | Fetch single evidence request by ID |
| `POST` | `/api/evidence-requests/{case_id}` | Create a new `PENDING` evidence request |
| `POST` | `/api/evidence-requests/{request_id}/respond` | Record actual customer response & trigger new investigation |
| `POST` | `/api/evidence-requests/{request_id}/cancel` | Cancel a `PENDING` evidence request with a reason |

---

## 🔄 Evidence Request Lifecycle Workflow

```
       ┌───────────────────────────────┐
       │   TigerGraph Graph Discovery  │
       │     or Analyst POST Request   │
       └──────────────┬────────────────┘
                      │
                      ▼
               [ PENDING ] ◄───────────────── Status remains PENDING
                 │     │                      (no fabricated responses)
  Record Response│     │ Cancel Request
                 │     │
                 ▼     ▼
          [ RESPONDED ] [ CANCELLED ]   (Terminal States)
                 │
                 ▼
     Triggers NEW Investigation
     - Runs full 12-step investigator agent
     - Incorporates customer response into LLM reasoning
     - Evaluates deterministic R1–R10 policy rules
     - Emits audit events (EVIDENCE_REQUEST_RESPONDED, INVESTIGATION_COMPLETED)
     - Preserves all previous investigation runs immutably
```

---

## ⚙️ Backend Setup & Environment

### Prerequisites
- Python 3.10+

### Environment Variables (`backend/.env`)
```ini
# Database
DATABASE_URL=sqlite:///./app/database/fraud.db

# Real TigerGraph Cloud Credentials
TIGERGRAPH_HOST=https://your-instance.cloud.tigergraph.com
TIGERGRAPH_SECRET=your-database-secret
TIGERGRAPH_GRAPH_NAME=FraudGraph

# Groq LLM Credentials
LLM_PROVIDER=groq
GROQ_API_KEY=gsk_your_groq_api_key
GROQ_MODEL=openai/gpt-oss-120b

# App Environment
APP_ENV=development
LOG_LEVEL=INFO
```

### Installation & Run
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

- **Swagger Documentation**: `http://localhost:8000/docs`
- **Health Check**: `http://localhost:8000/health`

---

## 🎨 Frontend Setup & Run

### Prerequisites
- Node.js 18+ and `npm`

### Environment Variables (`frontend/.env`)
```ini
VITE_API_BASE_URL=http://localhost:8000
```

### Installation & Run
```bash
cd frontend
npm install
npm run dev
```

Application runs locally at `http://localhost:5173`.

---

## 🧪 Testing & Verification

Run the full pytest suite (58 automated unit, regression, integration, and lifecycle tests):
```bash
cd backend
py -m pytest tests -v
```

Test coverage includes:
1. `test_real_tigergraph.py`: Real RESTPP connectivity, token generation, query invocation.
2. `test_groq_reasoning.py`: Groq LLM reasoning execution, prompt grounding, API key protection.
3. `test_grounding_regressions.py`: Customer ID grounding (`C08623`), individual transaction timestamps, stop reason logic.
4. `test_investigation_history_audit.py`: Persistent SQLite investigation runs, snapshot immutability, playback without external API calls, step-by-step audit logging.
5. `test_evidence_request_lifecycle.py`: State-machine transitions (`PENDING` $\rightarrow$ `RESPONDED` / `CANCELLED`), 409 conflict guards, automated re-investigation triggering, immutability of prior runs, HHG-003 preservation without fabricated responses, audit trail verification, and credential safety.

Build the frontend bundle:
```bash
cd frontend
npm run build
```

---

## 🔒 Security Compliance

- **No Plaintext Secrets**: TigerGraph Database Secrets and Groq API keys are read strictly from environment variables.
- **Audit Data Sanitization**: Audit logs automatically strip sensitive key strings (`secret`, `key`, `token`, `password`, `Authorization`) before database persistence.
- **Isolated Playback**: Viewing historical investigation runs queries local SQLite snapshots only and makes zero calls to external APIs.
- **Strict Evidence Request Guardrails**: State transitions are strictly validated server-side. Once `RESPONDED` or `CANCELLED`, requests cannot be modified.