# Autonomous Fraud Investigation System

An end-to-end **Autonomous Fraud Investigation System** integrating a FastAPI backend, SQLite persistent audit storage, real TigerGraph Cloud graph database, Groq LLM reasoning (`openai/gpt-oss-120b`), deterministic R1–R10 policy engine, and a React + TypeScript + Vite frontend analyst dashboard.

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

- **Persistent Investigation History & Audit Trail**:
  - Every agent run persists an immutable, complete snapshot to SQLite (`investigations`, `investigation_evidence`, `investigation_actions`, `investigation_rules`, `audit_events`).
  - Step-by-step workflow audit events (`INVESTIGATION_STARTED`, `EVIDENCE_COLLECTED`, `LLM_REASONING_COMPLETED`, `POLICY_EVALUATED`, `DECISION_GENERATED`, `INVESTIGATION_COMPLETED`).
  - Instant historical playback served directly from SQLite without re-querying TigerGraph or Groq APIs.

- **Fraud Investigation Analyst Dashboard (React + TS + Tailwind)**:
  - Dynamic routing (`/cases/:caseId`).
  - Interactive case evidence graphs, transaction breakdown with individual timestamps, and customer entity grounding.
  - **Investigation History Modal**: View exact past investigation runs, R1-R10 rule results, and snapshots.
  - **Chronological Audit Log**: Visual timeline showing fine-grained workflow lifecycle events.

---

## 📁 Project Structure

```text
task4/
│
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI entry point, CORS, startup migrations
│   │   │
│   │   ├── api/                     # REST API Endpoints
│   │   │   ├── cases.py             # GET /api/cases, GET /api/cases/{case_id}, history & audit endpoints
│   │   │   ├── investigations.py    # POST /api/investigations/{case_id}, GET /api/investigations/{id}
│   │   │   └── health.py            # GET /health
│   │   │
│   │   ├── agent/                   # Autonomous Agent Architecture
│   │   │   ├── investigator.py      # FraudInvestigatorAgent workflow orchestrator
│   │   │   ├── reasoning.py         # Groq LLM reasoning layer (openai/gpt-oss-120b)
│   │   │   ├── decision.py          # Deterministic R1–R10 policy engine
│   │   │   ├── evidence.py          # Graph evidence normalization
│   │   │   ├── tools.py             # TigerGraph query tools
│   │   │   ├── context.py           # Investigation context builder
│   │   │   ├── prompts.py           # System prompts & grounding rules
│   │   │   └── schemas.py           # Agent data models & output schemas
│   │   │
│   │   ├── core/                    # Configuration & security
│   │   │   └── config.py            # Settings loader (.env parser)
│   │   │
│   │   ├── models/                  # SQLAlchemy ORM Models
│   │   │   └── investigation.py     # CaseModel, InvestigationModel, AuditEventModel, etc.
│   │   │
│   │   ├── schemas/                 # Pydantic API Data Models
│   │   │   └── investigation.py     # Request/Response schemas & DTOs
│   │   │
│   │   ├── services/                # Backend Services
│   │   │   ├── database.py          # SQLAlchemy SQLite setup (fraud.db)
│   │   │   ├── tigergraph.py        # Real TigerGraph RESTPP & token service
│   │   │   └── history_service.py   # Investigation snapshot & audit trail persistence
│   │   │
│   │   └── database/                # SQLite Storage (fraud.db)
│   │
│   ├── tests/                       # Backend Pytest Test Suite (35 tests)
│   │   ├── test_real_tigergraph.py
│   │   ├── test_groq_reasoning.py
│   │   ├── test_grounding_regressions.py
│   │   └── test_investigation_history_audit.py
│   │
│   ├── requirements.txt             # Python dependencies
│   └── .env                         # Environment variables (Credentials)
│
├── frontend/
│   ├── src/
│   │   ├── components/              # Navbar, Sidebar, StatusBadge, AuditTimeline, InvestigationHistoryModal
│   │   ├── pages/                   # Dashboard, Cases, CaseDetails
│   │   ├── services/                # Axios API client (api.ts)
│   │   ├── types/                   # TypeScript interfaces (investigation.ts)
│   │   ├── lib/                     # Utilities & date formatting
│   │   ├── App.tsx                  # Routing & layout
│   │   └── main.tsx                 # Entry point
│   │
│   ├── package.json                 # Node dependencies & scripts
│   └── vite.config.ts               # Vite bundler configuration
│
└── README.md                        # Documentation
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

Run the full pytest suite (35 automated unit, regression, and integration tests):
```bash
cd backend
py -m pytest tests -v
```

Test coverage includes:
1. `test_real_tigergraph.py`: Real RESTPP connectivity, token generation, query invocation.
2. `test_groq_reasoning.py`: Groq LLM reasoning execution, prompt grounding, API key protection.
3. `test_grounding_regressions.py`: Customer ID grounding (`C08623`), individual transaction timestamps, stop reason logic.
4. `test_investigation_history_audit.py`: Persistent SQLite investigation runs, snapshot immutability, playback without external API calls, step-by-step audit logging.

Build the frontend bundle:
```bash
cd frontend
npm run build
```

---

## 🔒 Security Compliance

- **No Plaintext Secrets**: TigerGraph Database Secrets and Groq API keys are read strictly from environment variables.
- **Audit Data Sanitization**: Audit logs automatically strip sensitive key strings (`secret`, `key`, `token`, `password`) before database persistence.
- **Isolated Playback**: Viewing historical investigation runs queries local SQLite snapshots only and makes zero calls to external APIs.