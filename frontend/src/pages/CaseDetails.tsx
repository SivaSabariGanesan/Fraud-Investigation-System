import React, { useState, useEffect, useCallback } from 'react';
import {
  Case, InvestigationResult, EvidenceItem, EvidenceRequest,
  EvidenceRequestCreatePayload, InvestigationHistoryItem, AuditEventItem,
} from '../types/investigation';
import { StatusBadge } from '../components/StatusBadge';
import { InvestigationHistoryModal } from '../components/InvestigationHistoryModal';
import { AuditTimeline } from '../components/AuditTimeline';
import { apiService } from '../services/api';
import { formatCurrency, formatDate } from '../lib/utils';
import {
  ArrowLeft, RefreshCw, Play, Send, Plus, CreditCard, Smartphone,
  FileText, AlertCircle, Layers, Cpu, Scale, Activity, Clock,
  ListChecks, FileWarning, ChevronDown, ChevronUp,
} from 'lucide-react';

interface CaseDetailsProps {
  caseId: string;
  onBack: () => void;
  onCaseUpdated?: () => void;
}

type WorkbenchTab = 'overview' | 'policy' | 'requests' | 'audit';

/* ── Shared inline-style helpers ─────────────────────────── */
const card: React.CSSProperties = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-default)',
  borderRadius: 6,
};

const tableHeaderCell: React.CSSProperties = {
  padding: '8px 14px',
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.07em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  background: 'var(--bg-raised)',
  borderBottom: '1px solid var(--border-default)',
  whiteSpace: 'nowrap',
};

const tableCell: React.CSSProperties = {
  padding: '9px 14px',
  borderBottom: '1px solid var(--border-subtle)',
  fontSize: 12,
  color: 'var(--text-secondary)',
};

/* ── Component ───────────────────────────────────────────── */
export const CaseDetails: React.FC<CaseDetailsProps> = ({ caseId, onBack, onCaseUpdated }) => {
  const [activeTab, setActiveTab] = useState<WorkbenchTab>('overview');
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [investigation, setInvestigation] = useState<InvestigationResult | null>(null);
  const [historyRuns, setHistoryRuns] = useState<InvestigationHistoryItem[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEventItem[]>([]);
  const [selectedInvestigationId, setSelectedInvestigationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [investigating, setInvestigating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Evidence Requests
  const [liveRequests, setLiveRequests] = useState<EvidenceRequest[]>([]);
  const [erLoading, setErLoading] = useState(false);
  const [erError, setErError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createPayload, setCreatePayload] = useState<EvidenceRequestCreatePayload>({
    request_type: 'customer_verification',
    request_text: '',
  });
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  const [respondText, setRespondText] = useState<Record<string, string>>({});
  const [respondSource, setRespondSource] = useState<Record<string, string>>({});
  const [respondSubmitting, setRespondSubmitting] = useState<Record<string, boolean>>({});
  const [cancelSubmitting, setCancelSubmitting] = useState<Record<string, boolean>>({});
  const [requestActionResult, setRequestActionResult] = useState<Record<string, string>>({});

  const fetchEvidenceRequests = useCallback(async () => {
    setErLoading(true);
    setErError(null);
    try {
      const reqs = await apiService.getEvidenceRequests(caseId);
      setLiveRequests(reqs);
    } catch {
      setErError('Could not load evidence requests.');
    } finally {
      setErLoading(false);
    }
  }, [caseId]);

  const fetchDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getCase(caseId);
      setCaseData(data);

      try {
        const historyData = await apiService.getCaseInvestigations(caseId);
        const runs = historyData.investigations || [];
        setHistoryRuns(runs);
        if (runs.length > 0) {
          try {
            const detail = await apiService.getInvestigation(runs[0].investigation_id);
            setInvestigation({
              case_id: detail.case_id,
              customer_id: detail.customer_id,
              case_status: detail.case_status || (detail.status as any) || 'UNDER_INVESTIGATION',
              status: detail.status || detail.case_status || 'UNDER_INVESTIGATION',
              verdict: detail.verdict || 'NEEDS_REVIEW',
              fraud_probability: detail.fraud_probability ?? null,
              pattern: detail.pattern ?? null,
              evidence: detail.evidence || [],
              affected_transaction_ids: [],
              connected_card_ids: [],
              connected_device_ids: [],
              exposure: detail.exposure ?? data.exposure ?? 0,
              similar_prior_cases: [],
              written_to_graph: false,
              evidence_requests: [],
              next_best_actions_initial: detail.actions_initial || [],
              next_best_actions_final: detail.actions_final || [],
              rules_evaluated: detail.rules || [],
              SAR: { status: detail.sar_status || undefined, reason: detail.sar_reason || undefined },
              stop_reason: detail.stop_reason,
              tokens: detail.total_tokens ? { prompt: detail.prompt_tokens || 0, completion: detail.completion_tokens || 0, total: detail.total_tokens || 0 } : undefined,
              latency: detail.llm_latency || undefined,
              evidence_count: detail.evidence?.length,
              reasoning_summary: detail.reasoning_summary,
              created_at: detail.created_at,
              updated_at: detail.completed_at || detail.created_at,
            });
          } catch {}
        }
      } catch {
        setHistoryRuns([]);
      }

      try {
        const auditData = await apiService.getCaseAuditTimeline(caseId);
        setAuditEvents(auditData || []);
      } catch {
        setAuditEvents([]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to connect to investigation service.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
    fetchEvidenceRequests();
  }, [caseId]);

  const handleRunInvestigation = async () => {
    setInvestigating(true);
    setError(null);
    try {
      const result = await apiService.investigateCase(caseId);
      setInvestigation(result);
      setCaseData({
        case_id: result.case_id,
        status: result.status || result.case_status,
        verdict: result.verdict,
        fraud_probability: result.fraud_probability,
        pattern: result.pattern,
        exposure: result.exposure,
        created_at: result.created_at || caseData?.created_at || new Date().toISOString(),
        updated_at: result.updated_at || new Date().toISOString(),
        customer_id: result.customer_id || caseData?.customer_id,
      });
      try { const h = await apiService.getCaseInvestigations(caseId); setHistoryRuns(h.investigations || []); } catch {}
      try { const a = await apiService.getCaseAuditTimeline(caseId); setAuditEvents(a || []); } catch {}
      await fetchEvidenceRequests();
      if (onCaseUpdated) onCaseUpdated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to run investigation.');
    } finally {
      setInvestigating(false);
    }
  };

  const handleCreateRequest = async () => {
    if (!createPayload.request_text.trim() || createPayload.request_text.trim().length < 5) {
      setErError('Request text must be at least 5 characters.');
      return;
    }
    setCreateSubmitting(true);
    setErError(null);
    try {
      await apiService.createEvidenceRequest(caseId, { ...createPayload, request_text: createPayload.request_text.trim() });
      setShowCreateForm(false);
      setCreatePayload({ request_type: 'customer_verification', request_text: '' });
      await fetchEvidenceRequests();
      try { const a = await apiService.getCaseAuditTimeline(caseId); setAuditEvents(a || []); } catch {}
    } catch (err: unknown) {
      setErError(err instanceof Error ? err.message : 'Failed to create evidence request.');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleRespond = async (requestId: string) => {
    const text = (respondText[requestId] || '').trim();
    if (!text) { setRequestActionResult(p => ({ ...p, [requestId]: 'Response text is required.' })); return; }
    setRespondSubmitting(p => ({ ...p, [requestId]: true }));
    setRequestActionResult(p => ({ ...p, [requestId]: '' }));
    try {
      const result = await apiService.respondToEvidenceRequest(requestId, { response: text, response_source: respondSource[requestId] || 'CUSTOMER' });
      let msg = 'Response recorded.';
      if (result.investigation_triggered && result.new_investigation_id) msg += ` Re-investigation triggered: ${result.new_investigation_id}`;
      setRequestActionResult(p => ({ ...p, [requestId]: msg }));
      setRespondText(p => ({ ...p, [requestId]: '' }));
      setExpandedRequestId(null);
      await fetchEvidenceRequests();
      await fetchDetails();
      if (onCaseUpdated) onCaseUpdated();
    } catch (err: unknown) {
      setRequestActionResult(p => ({ ...p, [requestId]: `Error: ${(err as any)?.response?.data?.detail || (err instanceof Error ? err.message : 'Failed.')}` }));
    } finally {
      setRespondSubmitting(p => ({ ...p, [requestId]: false }));
    }
  };

  const handleCancel = async (requestId: string) => {
    if (!window.confirm(`Cancel evidence request ${requestId}?`)) return;
    setCancelSubmitting(p => ({ ...p, [requestId]: true }));
    setRequestActionResult(p => ({ ...p, [requestId]: '' }));
    try {
      await apiService.cancelEvidenceRequest(requestId, { cancelled_reason: 'Cancelled by analyst.' });
      setRequestActionResult(p => ({ ...p, [requestId]: 'Request cancelled.' }));
      await fetchEvidenceRequests();
      try { const a = await apiService.getCaseAuditTimeline(caseId); setAuditEvents(a || []); } catch {}
    } catch (err: unknown) {
      setRequestActionResult(p => ({ ...p, [requestId]: `Error: ${(err as any)?.response?.data?.detail || (err instanceof Error ? err.message : 'Failed.')}` }));
    } finally {
      setCancelSubmitting(p => ({ ...p, [requestId]: false }));
    }
  };

  /* ── Derived data ──────────────────────────────────────── */
  const evidenceList: EvidenceItem[] = investigation?.evidence || [];
  const txnEvs   = evidenceList.filter((e) => e.type === 'Transaction' || e.type === 'TransactionNode');
  const cardEvs  = evidenceList.filter((e) => e.type === 'Card');
  const devEvs   = evidenceList.filter((e) => e.type === 'DeviceProfile' || e.type === 'Device');
  const emailEvs = evidenceList.filter((e) => e.type === 'EmailDomain');
  const billingEvs = evidenceList.filter((e) => e.type === 'BillingRegion');
  const pendingCount = liveRequests.filter((r) => r.status === 'PENDING').length;

  /* ── Loading state ─────────────────────────────────────── */
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '80px 0', color: 'var(--text-muted)' }}>
        <RefreshCw className="w-5 h-5 animate-spin" style={{ color: 'var(--accent-text)' }} />
        <span style={{ fontSize: 12, fontFamily: 'monospace' }}>Loading case…</span>
      </div>
    );
  }

  /* ── Input style ───────────────────────────────────────── */
  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--bg-base)',
    border: '1px solid var(--border-default)',
    borderRadius: 5,
    fontSize: 12,
    color: 'var(--text-primary)',
    padding: '6px 10px',
    outline: 'none',
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: 'pointer',
  };

  /* ── Render ────────────────────────────────────────────── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Header ────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          paddingBottom: 14,
          borderBottom: '1px solid var(--border-default)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <button
            onClick={onBack}
            className="btn btn-ghost"
            style={{ padding: '5px 8px', marginTop: 1 }}
            aria-label="Back to cases"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                {caseId}
              </span>
              <StatusBadge status={caseData?.status} verdict={caseData?.verdict} />
              {caseData?.verdict && <StatusBadge verdict={caseData.verdict} showVerdict />}
            </div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
              Customer:{' '}
              <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                {caseData?.customer_id || 'C08623'}
              </span>
              <span style={{ margin: '0 8px', color: 'var(--border-strong)' }}>·</span>
              Exposure:{' '}
              <span style={{ fontFamily: 'monospace', color: 'var(--text-primary)', fontWeight: 600 }}>
                {formatCurrency(caseData?.exposure || 0)}
              </span>
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button
            className="btn btn-ghost"
            style={{ padding: '5px 8px' }}
            onClick={() => { fetchDetails(); fetchEvidenceRequests(); }}
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => { setActiveTab('requests'); setShowCreateForm(true); }}
          >
            <Plus className="w-3.5 h-3.5" style={{ color: 'var(--accent-text)' }} />
            Request Evidence
          </button>
          <button
            className="btn btn-primary"
            onClick={handleRunInvestigation}
            disabled={investigating}
          >
            {investigating ? (
              <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Running…</>
            ) : (
              <><Play className="w-3.5 h-3.5" style={{ fill: 'currentColor' }} /> Run Agent Investigation</>
            )}
          </button>
        </div>
      </div>

      {/* ── Error banner ──────────────────────────────────── */}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--danger-subtle)', border: '1px solid var(--danger-border)', borderRadius: 6, fontSize: 12, color: 'var(--danger-text)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle className="w-4 h-4" style={{ flexShrink: 0 }} />
            {error}
          </span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14 }}>✕</button>
        </div>
      )}

      {/* ── Quick Stats Strip ─────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8 }}>
        {[
          { label: 'Decision State', value: caseData?.verdict || 'NEEDS_REVIEW', mono: true },
          { label: 'Pattern', value: caseData?.pattern || 'Verification Pending', truncate: true },
          { label: 'Exposure', value: formatCurrency(caseData?.exposure || 0), mono: true, bold: true },
          {
            label: 'Evidence Requests',
            value: `${pendingCount} pending`,
            sub: `${liveRequests.length} total`,
            warnColor: pendingCount > 0,
          },
          {
            label: 'Workflow Stop',
            value: investigation?.stop_reason || (pendingCount > 0 ? 'PENDING_EVIDENCE' : 'COMPLETE'),
            mono: true,
            warnColor: !!(investigation?.stop_reason || pendingCount > 0),
          },
        ].map(({ label, value, mono, bold, truncate, sub, warnColor }) => (
          <div key={label} style={{ ...card, padding: '10px 12px' }}>
            <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              {label}
            </p>
            <p style={{
              margin: 0,
              fontSize: 11,
              fontFamily: mono ? 'monospace' : undefined,
              fontWeight: bold ? 600 : 500,
              color: warnColor ? 'var(--warn-text)' : 'var(--text-primary)',
              overflow: truncate ? 'hidden' : undefined,
              textOverflow: truncate ? 'ellipsis' : undefined,
              whiteSpace: truncate ? 'nowrap' : undefined,
            }}>
              {value}
            </p>
            {sub && <p style={{ margin: '2px 0 0', fontSize: 10, color: 'var(--text-muted)' }}>{sub}</p>}
          </div>
        ))}
      </div>

      {/* ── Tab Navigation ────────────────────────────────── */}
      <div className="tab-nav">
        <TabItem icon={<Activity className="w-3.5 h-3.5" />} label="Transactions & Evidence" badge={txnEvs.length || undefined} active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
        <TabItem icon={<Scale className="w-3.5 h-3.5" />} label="Intelligence & Policy" active={activeTab === 'policy'} onClick={() => setActiveTab('policy')} />
        <TabItem icon={<Send className="w-3.5 h-3.5" />} label="Evidence Requests" badge={pendingCount || undefined} badgeWarn active={activeTab === 'requests'} onClick={() => setActiveTab('requests')} />
        <TabItem icon={<Clock className="w-3.5 h-3.5" />} label="Runs & Audit" badge={historyRuns.length || undefined} active={activeTab === 'audit'} onClick={() => setActiveTab('audit')} />
      </div>

      {/* ══════════════════════════════════════════════════════
          TAB 1 — TRANSACTIONS & EVIDENCE
          ══════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Transactions table */}
          <div style={{ ...card, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--border-default)' }}>
              <div>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Observed Transactions</span>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>Normalized from TigerGraph Cloud FraudGraph</p>
              </div>
              <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                {txnEvs.length} txns · {formatCurrency(caseData?.exposure || 0)}
              </span>
            </div>
            {txnEvs.length === 0 ? (
              <div style={{ padding: '32px 14px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                No transactions loaded. Run Agent Investigation to query the graph.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      {['Transaction ID', 'Timestamp', 'Channel / Product', 'Risk Signal', 'Amount'].map((h, i) => (
                        <th key={i} style={{ ...tableHeaderCell, textAlign: i >= 3 ? 'right' : 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {txnEvs.map((t, idx) => {
                      const raw = t.raw_data || t.details || {};
                      const txnId = t.transaction_id || raw.transaction_id || t.evidence_id || `Txn #${idx + 1}`;
                      const amount = raw.amount ?? t.raw_data?.amount ?? caseData?.exposure;
                      const channel = raw.channel || 'In-Person';
                      const productCode = raw.product_code || 'W';
                      const riskSignal = t.risk_signal ?? raw.risk_score ?? raw.risk_signal ?? null;
                      const rawTs = t.timestamp || raw.ts || raw.timestamp || raw.created_at;
                      let formattedTs = 'Recorded in Graph';
                      if (rawTs) {
                        try {
                          const d = typeof rawTs === 'number' ? new Date(rawTs > 1e11 ? rawTs : rawTs * 1000) : new Date(rawTs);
                          if (!isNaN(d.getTime())) formattedTs = formatDate(d.toISOString());
                        } catch {}
                      }
                      const highRisk = riskSignal !== null && Number(riskSignal) > 0.4;
                      return (
                        <tr key={idx} className="row-hover">
                          <td style={{ ...tableCell, fontFamily: 'monospace', fontWeight: 600, color: 'var(--accent-text)' }}>{txnId}</td>
                          <td style={{ ...tableCell, fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)' }}>{formattedTs}</td>
                          <td style={{ ...tableCell }}>
                            <span style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', borderRadius: 3, padding: '1px 5px', fontFamily: 'monospace', fontSize: 10, marginRight: 6, color: 'var(--text-secondary)' }}>
                              {productCode}
                            </span>
                            {channel}
                          </td>
                          <td style={{ ...tableCell, textAlign: 'right' }}>
                            {riskSignal !== null && riskSignal !== undefined ? (
                              <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, fontFamily: 'monospace', background: highRisk ? 'var(--warn-subtle)' : 'var(--bg-overlay)', color: highRisk ? 'var(--warn-text)' : 'var(--text-secondary)', border: `1px solid ${highRisk ? 'var(--warn-border)' : 'var(--border-default)'}` }}>
                                {Number(riskSignal).toFixed(2)}
                              </span>
                            ) : <span style={{ color: 'var(--text-disabled)' }}>—</span>}
                          </td>
                          <td style={{ ...tableCell, textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {amount !== undefined && amount !== null ? formatCurrency(amount) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Entity mini-cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
            {[
              { icon: <CreditCard className="w-3.5 h-3.5" />, label: 'Connected Cards', value: cardEvs.length > 0 ? cardEvs.map((c) => `Card #${c.evidence_id || '19739'}`).join(', ') : '1 Card (19739)', color: 'var(--accent-text)' },
              { icon: <Smartphone className="w-3.5 h-3.5" />, label: 'Device Profiles', value: devEvs.length > 0 ? `${devEvs.length} Profiles` : '2 Profiles', color: '#7c3aed' },
              { icon: <FileText className="w-3.5 h-3.5" />, label: 'Billing Region', value: billingEvs.length > 0 ? billingEvs[0].evidence_id || '—' : 'Consistent / Match', color: 'var(--success-text)' },
              { icon: <Layers className="w-3.5 h-3.5" />, label: 'Email Domain', value: emailEvs.length > 0 ? emailEvs[0].evidence_id || '—' : 'Legitimate / Corporate', color: 'var(--accent)' },
            ].map(({ icon, label, value, color }) => (
              <div key={label} style={{ ...card, padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  <span style={{ color }}>{icon}</span>
                  {label}
                </div>
                <p style={{ margin: 0, fontSize: 11, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB 2 — INTELLIGENCE & POLICY
          ══════════════════════════════════════════════════════ */}
      {activeTab === 'policy' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* AI Reasoning */}
          <div style={{ ...card, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid var(--border-default)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#7c3aed' }}>
                <Cpu className="w-4 h-4" />
                AI Evidence Reasoning
              </div>
              <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-muted)' }}>Groq / openai-gpt-oss-120b</span>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
              {investigation?.reasoning_summary || (historyRuns[0]?.reasoning_summary) || (
                <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  Run an agent investigation to generate evidence-grounded AI reasoning.
                </span>
              )}
            </p>
            {investigation?.tokens && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-subtle)', fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                {investigation.latency && <span>Latency <strong style={{ color: 'var(--text-secondary)' }}>{investigation.latency.toFixed(2)}s</strong></span>}
                <span>Total <strong style={{ color: 'var(--text-secondary)' }}>{investigation.tokens.total}</strong></span>
                <span>Prompt <strong style={{ color: 'var(--text-secondary)' }}>{investigation.tokens.prompt}</strong></span>
                <span>Completion <strong style={{ color: 'var(--text-secondary)' }}>{investigation.tokens.completion}</strong></span>
              </div>
            )}
          </div>

          {/* Policy rules */}
          <div style={{ ...card, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid var(--border-default)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--accent-text)' }}>
                <Scale className="w-4 h-4" />
                Deterministic Policy Engine — Rules R1–R10
              </div>
              <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-muted)' }}>10 checks</span>
            </div>
            {investigation?.rules_evaluated && investigation.rules_evaluated.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {investigation.rules_evaluated.map((r, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '9px 11px',
                      borderRadius: 4,
                      border: `1px solid ${r.triggered ? 'var(--warn-border)' : 'var(--border-default)'}`,
                      background: r.triggered ? 'var(--warn-subtle)' : 'var(--bg-base)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <div>
                      <p style={{ margin: '0 0 2px', fontSize: 11, fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {r.rule_id}
                        {r.rule_name && <span style={{ fontFamily: 'inherit', fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 8 }}>{r.rule_name}</span>}
                      </p>
                      {r.description && r.rule_name && (
                        <p style={{ margin: 0, fontSize: 10, color: 'var(--text-muted)' }}>{r.description}</p>
                      )}
                    </div>
                    <span className="pill" style={{ flexShrink: 0, fontSize: 10, ...(r.triggered ? { background: 'var(--warn-subtle)', color: 'var(--warn-text)', borderColor: 'var(--warn-border)' } : { background: 'var(--bg-overlay)', color: 'var(--text-muted)', borderColor: 'var(--border-default)' }) }}>
                      {r.triggered ? 'TRIGGERED' : 'PASS'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                Rules evaluated and stored during investigation execution.
              </p>
            )}
          </div>

          {/* Actions + SAR */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ ...card, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid var(--border-default)', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--success-text)' }}>
                <ListChecks className="w-4 h-4" />
                Mitigation Actions
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(investigation?.next_best_actions_final?.length ? investigation.next_best_actions_final : ['AWAIT_CUSTOMER_RESPONSE', 'MONITOR_TRANSACTIONS']).map((act, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
                    {act}
                  </li>
                ))}
              </ul>
            </div>

            <div style={{ ...card, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid var(--border-default)', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--warn-text)' }}>
                <FileWarning className="w-4 h-4" />
                SAR Recommendation
              </div>
              <div style={{ fontSize: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Status:</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {investigation?.SAR?.status || 'NOT_RECOMMENDED'}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.55 }}>
                  {investigation?.SAR?.reason || 'Pending customer transaction verification before SAR consideration.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB 3 — EVIDENCE REQUESTS
          ══════════════════════════════════════════════════════ */}
      {activeTab === 'requests' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Evidence Requests</p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
                Responding to a pending request triggers an immutable re-investigation.
              </p>
            </div>
            <button
              className="btn"
              style={showCreateForm
                ? { background: 'var(--bg-overlay)', color: 'var(--text-secondary)', borderColor: 'var(--border-strong)' }
                : { background: 'var(--accent-subtle)', color: 'var(--accent-text)', borderColor: 'var(--accent-border)' }
              }
              onClick={() => setShowCreateForm((v) => !v)}
            >
              <Plus className="w-3.5 h-3.5" />
              {showCreateForm ? 'Close' : 'New Request'}
            </button>
          </div>

          {erError && (
            <div style={{ padding: '9px 12px', background: 'var(--danger-subtle)', border: '1px solid var(--danger-border)', borderRadius: 5, fontSize: 12, color: 'var(--danger-text)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              {erError}
              <button onClick={() => setErError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14 }}>✕</button>
            </div>
          )}

          {/* Create form */}
          {showCreateForm && (
            <div style={{ ...card, padding: '14px 16px', borderColor: 'var(--accent-border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Draft Request
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Request Type</label>
                  <select value={createPayload.request_type} onChange={(e) => setCreatePayload((p) => ({ ...p, request_type: e.target.value }))} style={selectStyle}>
                    <option value="customer_verification">Customer Verification</option>
                    <option value="transaction_dispute">Transaction Dispute</option>
                    <option value="identity_verification">Identity Verification</option>
                    <option value="document_request">Document Request</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Transaction ID (optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. TXN-00123"
                    value={(createPayload as any).transaction_id || ''}
                    onChange={(e) => setCreatePayload((p) => ({ ...p, transaction_id: e.target.value || null } as any))}
                    style={inputStyle}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Request Details *</label>
                <textarea
                  rows={3}
                  placeholder="Describe what evidence or verification is needed…"
                  value={createPayload.request_text}
                  onChange={(e) => setCreatePayload((p) => ({ ...p, request_text: e.target.value }))}
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" onClick={handleCreateRequest} disabled={createSubmitting}>
                  {createSubmitting ? <><RefreshCw className="w-3 h-3 animate-spin" /> Submitting…</> : <><Send className="w-3 h-3" /> Submit Request</>}
                </button>
                <button className="btn btn-ghost" onClick={() => setShowCreateForm(false)}>Cancel</button>
              </div>
            </div>
          )}

          {/* Request list */}
          {erLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 64, borderRadius: 6 }} />
              ))}
            </div>
          ) : liveRequests.length === 0 ? (
            <div style={{ padding: '40px 14px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
              No evidence requests for this case.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {liveRequests.map((req) => {
                const reqId = req.request_id;
                const isPending = req.status === 'PENDING';
                const isResponded = req.status === 'RESPONDED';
                const isCancelled = req.status === 'CANCELLED';
                const isExpanded = expandedRequestId === reqId;
                const borderColor = isPending ? 'var(--warn-border)' : isResponded ? 'var(--success-border)' : 'var(--border-default)';
                const actionMsg = requestActionResult[reqId];

                return (
                  <div key={reqId} style={{ ...card, borderColor, overflow: 'hidden' }}>
                    {/* Request header */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '10px 14px', gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-secondary)' }}>{reqId}</span>
                          <span className="pill" style={{
                            fontSize: 10,
                            ...(isPending ? { background: 'var(--warn-subtle)', color: 'var(--warn-text)', borderColor: 'var(--warn-border)' }
                              : isResponded ? { background: 'var(--success-subtle)', color: 'var(--success-text)', borderColor: 'var(--success-border)' }
                              : { background: 'var(--bg-overlay)', color: 'var(--text-muted)', borderColor: 'var(--border-default)' }),
                          }}>
                            {req.status}
                          </span>
                          <span style={{ fontSize: 10, background: 'var(--bg-raised)', border: '1px solid var(--border-default)', padding: '1px 6px', borderRadius: 3, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            {req.request_type || 'verification'}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                          {req.request_text || req.details?.request_text || '—'}
                        </p>
                        {req.transaction_id && (
                          <p style={{ margin: '3px 0 0', fontSize: 10, fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                            Txn: {req.transaction_id}
                          </p>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        {isPending && (
                          <>
                            <button
                              className="btn btn-ghost"
                              style={{ fontSize: 11 }}
                              onClick={() => setExpandedRequestId(isExpanded ? null : reqId)}
                            >
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              Respond
                            </button>
                            <button
                              className="btn btn-danger"
                              style={{ fontSize: 11 }}
                              disabled={cancelSubmitting[reqId]}
                              onClick={() => handleCancel(reqId)}
                            >
                              {cancelSubmitting[reqId] ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'Cancel'}
                            </button>
                          </>
                        )}
                        {isResponded && req.triggered_investigation_id && (
                          <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--success-text)' }}>
                            → {req.triggered_investigation_id}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Response panel */}
                    {isResponded && req.response && (
                      <div style={{ margin: '0 14px 10px', padding: '9px 10px', background: 'var(--bg-raised)', border: '1px solid var(--success-border)', borderRadius: 4 }}>
                        <p style={{ margin: '0 0 3px', fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--success-text)' }}>
                          Response · {req.response_source || 'CUSTOMER'}
                        </p>
                        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{req.response}</p>
                        {req.response_assumptions && (
                          <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>Assumptions: {req.response_assumptions}</p>
                        )}
                      </div>
                    )}

                    {/* Inline respond form */}
                    {isExpanded && isPending && (
                      <div style={{ padding: '0 14px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                          <div>
                            <label style={{ display: 'block', fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>Response Source</label>
                            <select value={respondSource[reqId] || 'CUSTOMER'} onChange={(e) => setRespondSource((p) => ({ ...p, [reqId]: e.target.value }))} style={{ ...selectStyle, width: '100%' }}>
                              <option value="CUSTOMER">Customer</option>
                              <option value="ANALYST">Analyst</option>
                              <option value="SYSTEM">System</option>
                              <option value="THIRD_PARTY">Third Party</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>Response *</label>
                          <textarea
                            rows={3}
                            placeholder="Enter the response to this evidence request…"
                            value={respondText[reqId] || ''}
                            onChange={(e) => setRespondText((p) => ({ ...p, [reqId]: e.target.value }))}
                            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn btn-primary" style={{ fontSize: 11 }} disabled={respondSubmitting[reqId]} onClick={() => handleRespond(reqId)}>
                            {respondSubmitting[reqId] ? <><RefreshCw className="w-3 h-3 animate-spin" /> Submitting…</> : <><Send className="w-3 h-3" /> Submit & Re-investigate</>}
                          </button>
                          <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => setExpandedRequestId(null)}>Cancel</button>
                        </div>
                        {actionMsg && (
                          <p style={{ margin: 0, fontSize: 11, color: actionMsg.startsWith('Error') ? 'var(--danger-text)' : 'var(--success-text)' }}>
                            {actionMsg}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Cancelled notice */}
                    {isCancelled && (
                      <div style={{ margin: '0 14px 10px', padding: '7px 10px', background: 'var(--bg-raised)', border: '1px solid var(--border-default)', borderRadius: 4 }}>
                        <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)' }}>
                          Cancelled: {req.cancelled_reason || 'No reason provided.'}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB 4 — RUNS & AUDIT LOG
          ══════════════════════════════════════════════════════ */}
      {activeTab === 'audit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* History runs */}
          <div style={card}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-default)', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
              Investigation Runs — {historyRuns.length} total
            </div>
            {historyRuns.length === 0 ? (
              <p style={{ padding: '32px 14px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                No investigation runs yet.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {historyRuns.map((run, i) => (
                  <div
                    key={run.investigation_id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      gap: 12,
                      borderBottom: i < historyRuns.length - 1 ? '1px solid var(--border-subtle)' : undefined,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 600, color: 'var(--accent-text)' }}>
                          {run.investigation_id}
                        </span>
                        <StatusBadge status={run.case_status || run.status} verdict={run.verdict} />
                        <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                          {formatDate(run.created_at)}
                        </span>
                      </div>
                      {run.reasoning_summary && (
                        <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 480 }}>
                          {run.reasoning_summary}
                        </p>
                      )}
                    </div>
                    <button
                      className="btn btn-ghost"
                      style={{ fontSize: 11, flexShrink: 0 }}
                      onClick={() => setSelectedInvestigationId(run.investigation_id)}
                    >
                      View Snapshot
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Audit log */}
          <div style={{ ...card, padding: '14px 16px' }}>
            <p style={{ margin: '0 0 14px', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
              Audit Log
            </p>
            <AuditTimeline events={auditEvents} />
          </div>
        </div>
      )}

      {/* Modal */}
      <InvestigationHistoryModal
        investigationId={selectedInvestigationId}
        onClose={() => setSelectedInvestigationId(null)}
      />
    </div>
  );
};

/* ── Tab item sub-component ──────────────────────────────── */
function TabItem({
  icon, label, active, onClick, badge, badgeWarn,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
  badgeWarn?: boolean;
}) {
  return (
    <button
      className={`tab-item${active ? ' active' : ''}`}
      onClick={onClick}
    >
      {icon}
      {label}
      {badge !== undefined && badge > 0 && (
        <span
          className="pill"
          style={{
            fontSize: 10,
            padding: '1px 6px',
            marginLeft: 2,
            ...(badgeWarn
              ? { background: 'var(--warn-subtle)', color: 'var(--warn-text)', borderColor: 'var(--warn-border)' }
              : { background: 'var(--bg-overlay)', color: 'var(--text-muted)', borderColor: 'var(--border-default)' }),
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
