import React, { useState } from 'react';
import { TigerGraphSchemaVisualizer } from '../components/TigerGraphSchemaVisualizer';
import { ShieldCheck, ArrowRight, Terminal, GitBranch, Database } from 'lucide-react';

interface LandingProps {
  onNavigateDashboard: () => void;
  onNewInvestigation?: () => void;
}

export const Landing: React.FC<LandingProps> = ({ onNavigateDashboard, onNewInvestigation }) => {
  const [activeTab, setActiveTab] = useState<'schema' | 'restpp' | 'rules' | 'workflow'>('schema');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, paddingBottom: 40 }}>
      
      {/* Clean Technical Header */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          padding: '24px 28px',
          borderRadius: 12,
          background: 'linear-gradient(135deg, #02050b 0%, #0c121e 100%)',
          border: '1px solid rgba(255, 103, 0, 0.3)',
          color: '#f8fafc',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 600, padding: '3px 8px', borderRadius: 4, background: 'rgba(255, 103, 0, 0.15)', color: '#ff6700', border: '1px solid rgba(255, 103, 0, 0.3)' }}>
              TigerGraph FraudGraph v1.0
            </span>
            <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 600, padding: '3px 8px', borderRadius: 4, background: 'rgba(49, 142, 208, 0.15)', color: '#8cbee0', border: '1px solid rgba(49, 142, 208, 0.3)' }}>
              RESTPP & GSQL API
            </span>
            <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 600, padding: '3px 8px', borderRadius: 4, background: 'rgba(254, 186, 18, 0.15)', color: '#feba12', border: '1px solid rgba(254, 186, 18, 0.3)' }}>
              Deterministic Rules R1–R10
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={onNavigateDashboard}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 14px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                background: 'linear-gradient(135deg, #ff6700 0%, #d85200 100%)',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Operations Dashboard
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            {onNewInvestigation && (
              <button
                onClick={onNewInvestigation}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 14px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 500,
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#f8fafc',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  cursor: 'pointer',
                }}
              >
                + New Manual Investigation
              </button>
            )}
          </div>
        </div>

        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em', color: '#ffffff' }}>
            System Architecture & Technical Engineering Specification
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>
            Technical documentation covering graph schema topology, RESTPP endpoints, multi-hop sub-graph traversal, Groq LLM grounded reasoning, and deterministic policy rule evaluation.
          </p>
        </div>
      </div>

      {/* Interactive Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--border-default)', paddingBottom: 10 }}>
        <button
          onClick={() => setActiveTab('schema')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            background: activeTab === 'schema' ? 'rgba(255, 103, 0, 0.12)' : 'transparent',
            color: activeTab === 'schema' ? '#ff6700' : 'var(--text-secondary)',
            border: activeTab === 'schema' ? '1px solid rgba(255, 103, 0, 0.3)' : '1px solid transparent',
            cursor: 'pointer',
          }}
        >
          <Database className="w-3.5 h-3.5" />
          Graph Schema Topology
        </button>

        <button
          onClick={() => setActiveTab('restpp')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            background: activeTab === 'restpp' ? 'rgba(49, 142, 208, 0.12)' : 'transparent',
            color: activeTab === 'restpp' ? '#318ed0' : 'var(--text-secondary)',
            border: activeTab === 'restpp' ? '1px solid rgba(49, 142, 208, 0.3)' : '1px solid transparent',
            cursor: 'pointer',
          }}
        >
          <Terminal className="w-3.5 h-3.5" />
          RESTPP & GSQL API Pipeline
        </button>

        <button
          onClick={() => setActiveTab('workflow')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            background: activeTab === 'workflow' ? 'rgba(168, 85, 247, 0.12)' : 'transparent',
            color: activeTab === 'workflow' ? '#c084fc' : 'var(--text-secondary)',
            border: activeTab === 'workflow' ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid transparent',
            cursor: 'pointer',
          }}
        >
          <GitBranch className="w-3.5 h-3.5" />
          12-Step Agent State Machine
        </button>

        <button
          onClick={() => setActiveTab('rules')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            background: activeTab === 'rules' ? 'rgba(254, 186, 18, 0.12)' : 'transparent',
            color: activeTab === 'rules' ? '#feba12' : 'var(--text-secondary)',
            border: activeTab === 'rules' ? '1px solid rgba(254, 186, 18, 0.3)' : '1px solid transparent',
            cursor: 'pointer',
          }}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          Policy Rules (R1 – R10)
        </button>
      </div>

      {/* Tab 1: Interactive Schema Visualizer */}
      {activeTab === 'schema' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <TigerGraphSchemaVisualizer />
        </div>
      )}

      {/* Tab 2: RESTPP & GSQL Pipeline Spec */}
      {activeTab === 'restpp' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Terminal className="w-4 h-4" style={{ color: '#ff6700' }} />
              TigerGraph Cloud RESTPP Endpoints & Authentication
            </h3>
            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              The application authenticates against TigerGraph RESTPP API by requesting a bearer token from <code>/gsql/v1/tokens</code> using the Database Secret configured in <code>TIGERGRAPH_SECRET</code>. Tokens are cached in-memory and automatically refreshed upon expiration.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 14 }}>
              <div style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 8, padding: 14, fontFamily: 'monospace', fontSize: 11, color: '#e6edf3' }}>
                <div style={{ color: '#ff6700', fontWeight: 600, marginBottom: 6 }}># Token Acquisition</div>
                <div style={{ color: '#79c0ff' }}>POST /gsql/v1/tokens</div>
                <div style={{ color: '#8b949e', marginTop: 4 }}>Payload: {`{"secret": "<TIGERGRAPH_SECRET>"}`}</div>
              </div>

              <div style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 8, padding: 14, fontFamily: 'monospace', fontSize: 11, color: '#e6edf3' }}>
                <div style={{ color: '#ff6700', fontWeight: 600, marginBottom: 6 }}># Vertex Retrieval</div>
                <div style={{ color: '#79c0ff' }}>GET /restpp/graph/FraudGraph/vertices/{'{VertexType}'}/{'{v_id}'}</div>
                <div style={{ color: '#8b949e', marginTop: 4 }}>Headers: Authorization: Bearer {'<token>'}</div>
              </div>

              <div style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 8, padding: 14, fontFamily: 'monospace', fontSize: 11, color: '#e6edf3' }}>
                <div style={{ color: '#ff6700', fontWeight: 600, marginBottom: 6 }}># Edge Traversal</div>
                <div style={{ color: '#79c0ff' }}>GET /restpp/graph/FraudGraph/edges/{'{SourceType}'}/{'{v_id}'}/{'{EdgeType}'}</div>
                <div style={{ color: '#8b949e', marginTop: 4 }}>Returns all connected target vertices & edge attributes</div>
              </div>

              <div style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 8, padding: 14, fontFamily: 'monospace', fontSize: 11, color: '#e6edf3' }}>
                <div style={{ color: '#ff6700', fontWeight: 600, marginBottom: 6 }}># Installed GSQL Query Execution</div>
                <div style={{ color: '#79c0ff' }}>GET /restpp/query/FraudGraph/hhg003_policy_decision</div>
                <div style={{ color: '#8b949e', marginTop: 4 }}>Executes server-side GSQL query for graph decisioning</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: 12-Step Agent State Machine */}
      {activeTab === 'workflow' && (
        <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <GitBranch className="w-4 h-4" style={{ color: '#c084fc' }} />
            12-Step Agent Execution Sequence
          </h3>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            The <code>FraudInvestigatorAgent</code> executes a strict 12-step autonomous workflow to investigate any case ID without hardcoded heuristics or hallucinations.
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--bg-raised)', textAlign: 'left' }}>
                  <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-default)', fontFamily: 'monospace', width: 60 }}>Step</th>
                  <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-default)' }}>Workflow Stage</th>
                  <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-default)' }}>TigerGraph / System Action</th>
                  <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-default)' }}>Output Data</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { step: '01', stage: 'Load Case Details', action: 'Query ClosedCase vertex or SQLite CaseModel record', out: 'case_info (case_id, customer_id, exposure)' },
                  { step: '02', stage: 'Retrieve Transactions', action: 'Traverse INVOLVES edges from ClosedCase to Transaction', out: 'txns (TransactionID, amount, risk_score, ts)' },
                  { step: '03', stage: 'Retrieve Cards & Customer', action: 'Traverse MADE edges to Card and OWNS edges to Customer', out: 'cards_info (stolen_flag), customer_info' },
                  { step: '04', stage: 'Retrieve Card History', action: 'Traverse reverse_MADE edges to fetch all transactions on card', out: 'historical_transactions' },
                  { step: '05', stage: 'Retrieve Device Profiles', action: 'Traverse FROM_DEVICE edges from Transaction to DeviceProfile', out: 'devices_info (vpn_detected, proxy_flag)' },
                  { step: '06', stage: 'Retrieve Billing Regions', action: 'Traverse BILLED_IN edges from Transaction to BillingRegion', out: 'billing_regions_info (mismatch_flag)' },
                  { step: '07', stage: 'Retrieve Purchaser Emails', action: 'Traverse PURCHASER_EMAIL edges to EmailDomain', out: 'email_domains_info (disposable)' },
                  { step: '08', stage: 'Retrieve Historical Fraud', action: 'Traverse reverse_CONNECTED_TO edges to past ClosedCase', out: 'connected_cases_info (verdict)' },
                  { step: '09', stage: 'Retrieve Evidence Requests', action: 'Traverse reverse_FOR_CASE edges to EvidenceRequest', out: 'evidence_requests_info (status)' },
                  { step: '10', stage: 'Normalize Evidence Items', action: 'Transform raw facts into grounded EvidenceItem instances', out: 'normalized_evidence list' },
                  { step: '11', stage: 'Groq LLM Reasoning', action: 'Pass context to Groq (gpt-oss-120b) for structured synthesis', out: 'InvestigationReasoningOutput' },
                  { step: '12', stage: 'Evaluate Policy Engine', action: 'Run evaluate_policy_rules() against R1-R10 rules matrix', out: 'DecisionResult (CONFIRMED_FRAUD / DECLINED)' },
                ].map((s, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 700, color: '#ff6700' }}>{s.step}</td>
                    <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>{s.stage}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{s.action}</td>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)' }}>{s.out}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Deterministic Policy Rules Matrix (R1 - R10) */}
      {activeTab === 'rules' && (
        <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck className="w-4 h-4" style={{ color: '#feba12' }} />
            Deterministic Policy Rules Matrix (R1 – R10)
          </h3>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Every investigation concludes with policy evaluation in <code>evaluate_policy_rules()</code>. Rules are evaluated deterministically to guarantee reproducible, zero-hallucination fraud verdicts.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
            {[
              { id: 'R1', name: 'LOW_RISK_BASELINE', sev: 'INFO', desc: 'Single transaction without risk signals or customer dispute clears automatically.' },
              { id: 'R2', name: 'PENDING_EVIDENCE_VERIFICATION', sev: 'MEDIUM', desc: 'Pending evidence request forces state to UNRESOLVED / VERIFICATION_PENDING.' },
              { id: 'R3', name: 'CUSTOMER_DISPUTE_TRIGGER', sev: 'HIGH', desc: 'Customer reported transaction dispute triggers verification workflow & NEEDS_REVIEW verdict.' },
              { id: 'R4', name: 'STOLEN_CARD_FLAG', sev: 'CRITICAL', desc: 'Stolen card flag in graph records immediately triggers CONFIRMED_FRAUD & DECLINED verdict.' },
              { id: 'R5', name: 'DEVICE_SPOOFING_HIGH_RISK', sev: 'HIGH', desc: 'VPN/Proxy device profile combined with risk score ≥ 0.70 flags suspicious spoofing.' },
              { id: 'R6', name: 'REGIONAL_OR_EMAIL_MISMATCH', sev: 'MEDIUM', desc: 'Billing region mismatch or disposable email domain triggers compliance audit.' },
              { id: 'R7', name: 'LINKED_HISTORICAL_FRAUD', sev: 'HIGH', desc: 'Connected entity linked to past closed case with FRAUD_CONFIRMED verdict.' },
              { id: 'R8', name: 'HIGH_VELOCITY_CARD_TESTING', sev: 'CRITICAL', desc: 'Card exhibits high velocity testing (≥5 txns, ≥3 flagged) triggering CONFIRMED_FRAUD.' },
              { id: 'R9', name: 'RISK_SCORE_SIGNAL_ONLY', sev: 'INFO', desc: 'Risk score acts strictly as an investigation signal, never as an automatic fraud verdict alone.' },
              { id: 'R10', name: 'PENDING_EVIDENCE_OVERRIDE', sev: 'HIGH', desc: 'Pending evidence request overrides auto-clearing. State remains UNRESOLVED.' },
            ].map((rule) => (
              <div
                key={rule.id}
                style={{
                  padding: '12px 14px',
                  borderRadius: 8,
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border-default)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'monospace', color: '#ff6700' }}>
                    {rule.id} — {rule.name}
                  </span>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: rule.sev === 'CRITICAL' ? 'rgba(239, 68, 68, 0.12)' : rule.sev === 'HIGH' ? 'rgba(234, 179, 8, 0.12)' : 'rgba(56, 189, 248, 0.12)',
                      color: rule.sev === 'CRITICAL' ? '#ef4444' : rule.sev === 'HIGH' ? '#eab308' : '#38bdf8',
                      border: `1px solid ${rule.sev === 'CRITICAL' ? 'rgba(239, 68, 68, 0.3)' : rule.sev === 'HIGH' ? 'rgba(234, 179, 8, 0.3)' : 'rgba(56, 189, 248, 0.3)'}`,
                    }}
                  >
                    {rule.sev}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.45 }}>
                  {rule.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
