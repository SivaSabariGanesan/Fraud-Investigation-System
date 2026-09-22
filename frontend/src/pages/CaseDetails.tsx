import React, { useState, useEffect, useCallback } from 'react';
import {
  Case,
  InvestigationResult,
  EvidenceItem,
  EvidenceRequest,
  EvidenceRequestCreatePayload,
  InvestigationHistoryItem,
  AuditEventItem,
} from '../types/investigation';
import { StatusBadge } from '../components/StatusBadge';
import { InvestigationHistoryModal } from '../components/InvestigationHistoryModal';
import { AuditTimeline } from '../components/AuditTimeline';
import { apiService } from '../services/api';
import { formatCurrency, formatDate } from '../lib/utils';
import {
  ArrowLeft,
  RefreshCw,
  Play,
  Send,
  Plus,
  CreditCard,
  Smartphone,
  FileText,
  XCircle,
  ExternalLink,
  Layers,
  Cpu,
  Scale,
  MessageSquare,
  Activity,
  ChevronDown,
  ChevronUp,
  Clock,
  ListChecks,
  FileWarning,
} from 'lucide-react';

interface CaseDetailsProps {
  caseId: string;
  onBack: () => void;
  onCaseUpdated?: () => void;
}

type WorkbenchTab = 'overview' | 'policy' | 'requests' | 'audit';

export const CaseDetails: React.FC<CaseDetailsProps> = ({ caseId, onBack, onCaseUpdated }) => {
  const [activeTab, setActiveTab] = useState<WorkbenchTab>('overview');
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [investigation, setInvestigation] = useState<InvestigationResult | null>(null);
  const [historyRuns, setHistoryRuns] = useState<InvestigationHistoryItem[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEventItem[]>([]);
  const [selectedInvestigationId, setSelectedInvestigationId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [investigating, setInvestigating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Evidence Request state
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
      setErError('Could not load evidence requests from backend.');
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

        // Auto-load latest historical snapshot if available
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
              SAR: {
                status: detail.sar_status || undefined,
                reason: detail.sar_reason || undefined,
              },
              stop_reason: detail.stop_reason,
              tokens: detail.total_tokens ? {
                prompt: detail.prompt_tokens || 0,
                completion: detail.completion_tokens || 0,
                total: detail.total_tokens || 0,
              } : undefined,
              latency: detail.llm_latency || undefined,
              evidence_count: detail.evidence?.length,
              reasoning_summary: detail.reasoning_summary,
              created_at: detail.created_at,
              updated_at: detail.completed_at || detail.created_at,
            });
          } catch (e) {
            console.error('Failed to auto-load latest historical snapshot:', e);
          }
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
      const errorMsg = err instanceof Error ? err.message : 'Unable to connect to investigation service.';
      setError(errorMsg);
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

      try {
        const historyData = await apiService.getCaseInvestigations(caseId);
        setHistoryRuns(historyData.investigations || []);
      } catch {}

      try {
        const auditData = await apiService.getCaseAuditTimeline(caseId);
        setAuditEvents(auditData || []);
      } catch {}

      await fetchEvidenceRequests();

      if (onCaseUpdated) onCaseUpdated();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Unable to run investigation. Check backend connection.';
      setError(errorMsg);
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
      await apiService.createEvidenceRequest(caseId, {
        ...createPayload,
        request_text: createPayload.request_text.trim(),
      });
      setShowCreateForm(false);
      setCreatePayload({ request_type: 'customer_verification', request_text: '' });
      await fetchEvidenceRequests();
      try {
        const auditData = await apiService.getCaseAuditTimeline(caseId);
        setAuditEvents(auditData || []);
      } catch {}
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create evidence request.';
      setErError(msg);
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleRespond = async (requestId: string) => {
    const text = (respondText[requestId] || '').trim();
    if (!text) {
      setRequestActionResult(prev => ({ ...prev, [requestId]: 'Response text must not be empty.' }));
      return;
    }
    setRespondSubmitting(prev => ({ ...prev, [requestId]: true }));
    setRequestActionResult(prev => ({ ...prev, [requestId]: '' }));
    try {
      const result = await apiService.respondToEvidenceRequest(requestId, {
        response: text,
        response_source: respondSource[requestId] || 'CUSTOMER',
      });
      let msg = `Response recorded. Status → RESPONDED.`;
      if (result.investigation_triggered && result.new_investigation_id) {
        msg += ` New investigation triggered: ${result.new_investigation_id}.`;
      }
      setRequestActionResult(prev => ({ ...prev, [requestId]: msg }));
      setRespondText(prev => ({ ...prev, [requestId]: '' }));
      setExpandedRequestId(null);
      await fetchEvidenceRequests();
      await fetchDetails();
      if (onCaseUpdated) onCaseUpdated();
    } catch (err: unknown) {
      const errMsg = (err as any)?.response?.data?.detail || (err instanceof Error ? err.message : 'Failed to record response.');
      setRequestActionResult(prev => ({ ...prev, [requestId]: `Error: ${errMsg}` }));
    } finally {
      setRespondSubmitting(prev => ({ ...prev, [requestId]: false }));
    }
  };

  const handleCancel = async (requestId: string) => {
    if (!window.confirm(`Cancel evidence request ${requestId}?`)) return;
    setCancelSubmitting(prev => ({ ...prev, [requestId]: true }));
    setRequestActionResult(prev => ({ ...prev, [requestId]: '' }));
    try {
      await apiService.cancelEvidenceRequest(requestId, { cancelled_reason: 'Cancelled by analyst.' });
      setRequestActionResult(prev => ({ ...prev, [requestId]: 'Request cancelled.' }));
      await fetchEvidenceRequests();
      try {
        const auditData = await apiService.getCaseAuditTimeline(caseId);
        setAuditEvents(auditData || []);
      } catch {}
    } catch (err: unknown) {
      const errMsg = (err as any)?.response?.data?.detail || (err instanceof Error ? err.message : 'Failed to cancel request.');
      setRequestActionResult(prev => ({ ...prev, [requestId]: `Error: ${errMsg}` }));
    } finally {
      setCancelSubmitting(prev => ({ ...prev, [requestId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-400 space-y-3">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-400" />
        <p className="text-xs font-mono">Loading case data...</p>
      </div>
    );
  }

  // Entities & Evidence lists
  const evidenceList: EvidenceItem[] = investigation?.evidence || [];
  const txnEvs = evidenceList.filter((e) => e.type === 'Transaction' || e.type === 'TransactionNode');
  const cardEvs = evidenceList.filter((e) => e.type === 'Card');
  const devEvs = evidenceList.filter((e) => e.type === 'DeviceProfile' || e.type === 'Device');
  const emailEvs = evidenceList.filter((e) => e.type === 'EmailDomain');
  const billingEvs = evidenceList.filter((e) => e.type === 'BillingRegion');

  const pendingRequestsCount = liveRequests.filter(r => r.status === 'PENDING').length;

  return (
    <div className="space-y-4">
      {/* Top Breadcrumb & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
            title="Back to directory"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-bold tracking-tight text-slate-100 font-mono">{caseId}</h1>
              <StatusBadge status={caseData?.status} verdict={caseData?.verdict} />
              {caseData?.verdict && (
                <StatusBadge verdict={caseData.verdict} showVerdict={true} />
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Customer: <span className="font-mono text-slate-200">{caseData?.customer_id || 'C08623'}</span>
              <span className="mx-2 text-slate-600">·</span>
              Exposure: <span className="font-mono text-slate-200 font-medium">{formatCurrency(caseData?.exposure || 0)}</span>
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => { fetchDetails(); fetchEvidenceRequests(); }}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition text-xs"
            title="Refresh case state"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => {
              setActiveTab('requests');
              setShowCreateForm(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-medium transition"
          >
            <Plus className="w-3.5 h-3.5 text-indigo-400" />
            <span>Request Evidence</span>
          </button>

          <button
            onClick={handleRunInvestigation}
            disabled={investigating}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition shadow-sm disabled:opacity-50"
          >
            {investigating ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Running Agent...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run Agent Investigation</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium">
            <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-slate-400 hover:text-slate-200">✕</button>
        </div>
      )}

      {/* Quick Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80">
          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">Decision State</span>
          <span className="text-xs font-semibold text-slate-200 mt-1 block">
            {caseData?.verdict || 'NEEDS_REVIEW'}
          </span>
        </div>

        <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80">
          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">Identified Pattern</span>
          <span className="text-xs text-slate-200 mt-1 block truncate">
            {caseData?.pattern || 'Customer Verification Pending'}
          </span>
        </div>

        <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80">
          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">Total Exposure</span>
          <span className="text-xs font-mono font-semibold text-slate-200 mt-1 block">
            {formatCurrency(caseData?.exposure || 0)}
          </span>
        </div>

        <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80">
          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">Evidence Requests</span>
          <span className="text-xs font-semibold mt-1 block flex items-center gap-1.5">
            <span className={pendingRequestsCount > 0 ? 'text-amber-400' : 'text-slate-400'}>
              {pendingRequestsCount} Pending
            </span>
            <span className="text-slate-500 font-normal">({liveRequests.length} total)</span>
          </span>
        </div>

        <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80">
          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">Workflow Stop</span>
          <span className="text-xs font-mono text-amber-300 mt-1 block truncate">
            {investigation?.stop_reason || (pendingRequestsCount > 0 ? 'PENDING_EVIDENCE_RESPONSE' : 'COMPLETE')}
          </span>
        </div>
      </div>

      {/* Workbench Tab Navigation */}
      <div className="flex border-b border-slate-800/80 gap-1 text-xs">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 font-medium border-b-2 transition -mb-px flex items-center gap-1.5 ${
            activeTab === 'overview'
              ? 'border-indigo-500 text-indigo-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Transactions & Evidence</span>
          <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
            {txnEvs.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('policy')}
          className={`px-4 py-2 font-medium border-b-2 transition -mb-px flex items-center gap-1.5 ${
            activeTab === 'policy'
              ? 'border-indigo-500 text-indigo-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Scale className="w-3.5 h-3.5" />
          <span>Intelligence & Policy</span>
        </button>

        <button
          onClick={() => setActiveTab('requests')}
          className={`px-4 py-2 font-medium border-b-2 transition -mb-px flex items-center gap-1.5 ${
            activeTab === 'requests'
              ? 'border-indigo-500 text-indigo-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Send className="w-3.5 h-3.5" />
          <span>Evidence Requests</span>
          {pendingRequestsCount > 0 && (
            <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/10 text-amber-400 font-mono border border-amber-500/20">
              {pendingRequestsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2 font-medium border-b-2 transition -mb-px flex items-center gap-1.5 ${
            activeTab === 'audit'
              ? 'border-indigo-500 text-indigo-400 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Runs & Audit Log</span>
          <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
            {historyRuns.length}
          </span>
        </button>
      </div>

      {/* ==================================================
          TAB 1: OVERVIEW & EVIDENCE
          ================================================== */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Flagged Transactions Table */}
          <div className="rounded-lg border border-slate-800/80 bg-slate-900/50 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800/80 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">Observed Transactions</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Transactions normalized from TigerGraph Cloud FraudGraph schema.
                </p>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                {txnEvs.length} transactions · Total {formatCurrency(caseData?.exposure || 0)}
              </span>
            </div>

            {txnEvs.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-xs font-mono">
                No transaction records returned for this case. Click "Run Agent Investigation" to query the graph.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/80 text-[10px] font-medium uppercase text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-4">Transaction ID</th>
                      <th className="py-2.5 px-4">Timestamp</th>
                      <th className="py-2.5 px-4">Channel / Product</th>
                      <th className="py-2.5 px-4 text-right">Risk Signal</th>
                      <th className="py-2.5 px-4 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
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
                          const dateObj = typeof rawTs === 'number' ? new Date(rawTs > 1e11 ? rawTs : rawTs * 1000) : new Date(rawTs);
                          if (!isNaN(dateObj.getTime())) formattedTs = formatDate(dateObj.toISOString());
                        } catch {}
                      }

                      return (
                        <tr key={idx} className="hover:bg-slate-800/30 transition">
                          <td className="py-2.5 px-4 font-semibold text-indigo-300">
                            {txnId}
                          </td>
                          <td className="py-2.5 px-4 text-slate-400 text-[11px] font-sans">
                            {formattedTs}
                          </td>
                          <td className="py-2.5 px-4 font-sans text-slate-300">
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-mono mr-1.5">
                              {productCode}
                            </span>
                            {channel}
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            {riskSignal !== null && riskSignal !== undefined ? (
                              <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                Number(riskSignal) > 0.4
                                  ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                                  : 'bg-slate-800 text-slate-300'
                              }`}>
                                {Number(riskSignal).toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-right font-medium text-slate-100">
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

          {/* Graph Entities Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Customer & Cards */}
            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                <CreditCard className="w-3.5 h-3.5 text-indigo-400" />
                <span>Connected Cards</span>
              </div>
              <p className="text-xs font-mono text-slate-300">
                {cardEvs.length > 0 ? (
                  cardEvs.map((c, i) => <span key={i} className="block truncate">Card #{c.evidence_id || '19739'}</span>)
                ) : (
                  <span className="text-slate-500">1 Card (19739)</span>
                )}
              </p>
            </div>

            {/* Devices */}
            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                <Smartphone className="w-3.5 h-3.5 text-purple-400" />
                <span>Device Profiles</span>
              </div>
              <p className="text-xs font-mono text-slate-300">
                {devEvs.length > 0 ? `${devEvs.length} Profiles Recorded` : '2 Profiles (Windows, MacOS)'}
              </p>
            </div>

            {/* Billing Region */}
            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                <FileText className="w-3.5 h-3.5 text-emerald-400" />
                <span>Billing Region</span>
              </div>
              <p className="text-xs font-mono text-slate-300">
                {billingEvs.length > 0 ? billingEvs[0].evidence_id : 'Consistent / Match'}
              </p>
            </div>

            {/* Email Domains */}
            <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span>Email Domain</span>
              </div>
              <p className="text-xs font-mono text-slate-300">
                {emailEvs.length > 0 ? emailEvs[0].evidence_id : 'Legitimate / Corporate'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================
          TAB 2: INTELLIGENCE & POLICY
          ================================================== */}
      {activeTab === 'policy' && (
        <div className="space-y-4">
          {/* Groq AI Reasoning Brief */}
          <div className="rounded-lg border border-slate-800/80 bg-slate-900/50 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-purple-400" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                  AI Evidence Reasoning Brief
                </h3>
              </div>
              <span className="text-[11px] font-mono text-slate-400">Model: Groq (openai/gpt-oss-120b)</span>
            </div>

            <div className="text-xs text-slate-300 font-sans leading-relaxed space-y-2">
              {investigation?.reasoning_summary ? (
                <p>{investigation.reasoning_summary}</p>
              ) : historyRuns.length > 0 && historyRuns[0].reasoning_summary ? (
                <p>{historyRuns[0].reasoning_summary}</p>
              ) : (
                <p className="text-slate-500 italic">
                  Run an agent investigation to generate evidence-grounded AI reasoning.
                </p>
              )}
            </div>

            {/* Observability chips */}
            {investigation?.tokens && (
              <div className="flex flex-wrap items-center gap-3 pt-2 text-[11px] text-slate-400 font-mono border-t border-slate-800/60">
                <span>Latency: <strong className="text-slate-200">{investigation.latency ? `${investigation.latency.toFixed(2)}s` : 'N/A'}</strong></span>
                <span>Total Tokens: <strong className="text-slate-200">{investigation.tokens.total}</strong></span>
                <span>Prompt: <strong className="text-slate-200">{investigation.tokens.prompt}</strong></span>
                <span>Completion: <strong className="text-slate-200">{investigation.tokens.completion}</strong></span>
              </div>
            )}
          </div>

          {/* Deterministic Policy Rules (R1–R10) */}
          <div className="rounded-lg border border-slate-800/80 bg-slate-900/50 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-indigo-400" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                  Deterministic Policy Engine (Rules R1–R10)
                </h3>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">10 Evaluation Checks</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {investigation?.rules_evaluated && investigation.rules_evaluated.length > 0 ? (
                investigation.rules_evaluated.map((r, i) => (
                  <div
                    key={i}
                    className={`p-2.5 rounded-lg border text-xs flex items-start justify-between gap-2 ${
                      r.triggered
                        ? 'bg-amber-500/5 border-amber-500/20 text-slate-200'
                        : 'bg-slate-950/60 border-slate-800/80 text-slate-400'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-slate-200">{r.rule_id}</span>
                        <span className="text-[11px] font-medium text-slate-300">{r.rule_name || r.description}</span>
                      </div>
                      {r.description && r.rule_name && (
                        <p className="text-[11px] text-slate-500">{r.description}</p>
                      )}
                    </div>
                    <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-medium font-mono ${
                      r.triggered
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold'
                        : 'bg-slate-800 text-slate-400'
                    }`}>
                      {r.triggered ? 'TRIGGERED' : 'PASS'}
                    </span>
                  </div>
                ))
              ) : (
                <div className="col-span-2 p-4 text-center text-slate-500 text-xs font-mono">
                  Policy rules R1–R10 are evaluated and stored during investigation execution.
                </div>
              )}
            </div>
          </div>

          {/* Actions & SAR Recommendation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Next Best Actions */}
            <div className="rounded-lg border border-slate-800/80 bg-slate-900/50 p-4 space-y-2.5">
              <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2">
                <ListChecks className="w-4 h-4 text-indigo-400" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300">Mitigation Actions</h4>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-300">
                {(investigation?.next_best_actions_final || ['AWAIT_CUSTOMER_RESPONSE', 'MONITOR_TRANSACTIONS']).map((act, i) => (
                  <li key={i} className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                    <span>{act}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* SAR Status */}
            <div className="rounded-lg border border-slate-800/80 bg-slate-900/50 p-4 space-y-2.5">
              <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2">
                <FileWarning className="w-4 h-4 text-amber-400" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300">SAR Recommendation</h4>
              </div>
              <div className="text-xs space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Filing Status:</span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-mono text-[11px] font-semibold">
                    {investigation?.SAR?.status || 'NOT_RECOMMENDED'}
                  </span>
                </div>
                <p className="text-slate-400 text-[11px] pt-1 leading-relaxed">
                  {investigation?.SAR?.reason || 'Pending customer transaction verification before SAR consideration.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================
          TAB 3: EVIDENCE REQUESTS
          ================================================== */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                Customer & Analyst Evidence Requests
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Manage dispute verification requests. Responding triggers an immutable re-investigation.
              </p>
            </div>
            <button
              onClick={() => setShowCreateForm(v => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/15 hover:bg-indigo-600/25 text-indigo-300 border border-indigo-500/20 text-xs font-medium transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showCreateForm ? 'Close Form' : 'New Request'}</span>
            </button>
          </div>

          {erError && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between">
              <span>{erError}</span>
              <button onClick={() => setErError(null)} className="text-slate-400 hover:text-slate-200">✕</button>
            </div>
          )}

          {/* Create Request Drawer / Form */}
          {showCreateForm && (
            <div className="rounded-lg border border-indigo-500/30 bg-slate-900 p-4 space-y-3">
              <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">Draft Evidence Request</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">Request Type</label>
                  <select
                    value={createPayload.request_type}
                    onChange={e => setCreatePayload(prev => ({ ...prev, request_type: e.target.value }))}
                    className="w-full px-2.5 py-1.5 rounded-md bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="customer_verification">Customer Verification</option>
                    <option value="transaction_confirmation">Transaction Confirmation</option>
                    <option value="identity_verification">Identity Verification</option>
                    <option value="document_request">Document Request</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Transaction ID (optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. 3530164"
                    value={createPayload.transaction_id || ''}
                    onChange={e => setCreatePayload(prev => ({ ...prev, transaction_id: e.target.value || undefined }))}
                    className="w-full px-2.5 py-1.5 rounded-md bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Request Prompt to Customer</label>
                <textarea
                  rows={2}
                  placeholder="Specify verification question..."
                  value={createPayload.request_text}
                  onChange={e => setCreatePayload(prev => ({ ...prev, request_text: e.target.value }))}
                  className="w-full px-2.5 py-1.5 rounded-md bg-slate-950 border border-slate-800 text-slate-200 text-xs resize-none focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleCreateRequest}
                  disabled={createSubmitting || createPayload.request_text.trim().length < 5}
                  className="px-3.5 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition disabled:opacity-40"
                >
                  {createSubmitting ? 'Submitting...' : 'Send Request'}
                </button>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="px-3 py-1.5 rounded-md text-slate-400 hover:text-slate-200 text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Requests List */}
          {erLoading ? (
            <div className="p-8 text-center text-slate-400 text-xs font-mono">Loading requests...</div>
          ) : liveRequests.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs rounded-lg border border-slate-800 bg-slate-900/30 space-y-1">
              <p>No evidence requests created for this case.</p>
              <p className="text-slate-600">Requests discovered in TigerGraph or created by analysts appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {liveRequests.map(er => {
                const isPending = er.status === 'PENDING';
                const isResponded = er.status === 'RESPONDED';
                const isCancelled = er.status === 'CANCELLED';
                const isExpanded = expandedRequestId === er.request_id;
                const actionResult = requestActionResult[er.request_id];
                const isRespondSubmitting = respondSubmitting[er.request_id] || false;
                const isCancelSubmitting = cancelSubmitting[er.request_id] || false;

                return (
                  <div
                    key={er.request_id}
                    className={`rounded-lg border text-xs p-4 space-y-3 transition ${
                      isPending
                        ? 'border-amber-500/30 bg-slate-900/60'
                        : isResponded
                        ? 'border-emerald-500/30 bg-slate-900/40'
                        : 'border-slate-800 bg-slate-950/40 opacity-70'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div className="space-y-1 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-bold text-indigo-300">{er.request_id}</span>
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-mono">
                            {er.request_type || 'customer_verification'}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                            isPending
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : isResponded
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-slate-800 text-slate-400'
                          }`}>
                            {er.status}
                          </span>

                          {er.triggered_investigation_id && (
                            <span className="text-[10px] font-mono text-indigo-300 flex items-center gap-1">
                              <ExternalLink className="w-3 h-3" />
                              Re-investigation: {er.triggered_investigation_id}
                            </span>
                          )}
                        </div>

                        <p className="text-slate-200 text-xs pt-1 leading-relaxed">{er.request_text}</p>
                        <p className="text-[11px] text-slate-500 font-mono pt-0.5">
                          Created: {er.created_at ? formatDate(er.created_at) : 'N/A'}
                        </p>
                      </div>

                      {/* Action buttons (only for PENDING) */}
                      {isPending && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => setExpandedRequestId(isExpanded ? null : er.request_id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-300 border border-emerald-500/20 text-xs font-medium transition"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Record Response</span>
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                          <button
                            onClick={() => handleCancel(er.request_id)}
                            disabled={isCancelSubmitting}
                            className="p-1.5 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition disabled:opacity-40"
                            title="Cancel request"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Responded Details */}
                    {isResponded && er.response && (
                      <div className="p-3 rounded-md bg-emerald-500/5 border border-emerald-500/20 space-y-1">
                        <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider block">
                          Customer / Analyst Response ({er.response_source || 'CUSTOMER'})
                        </span>
                        <p className="text-slate-200 font-medium">{er.response}</p>
                        {er.responded_at && (
                          <span className="text-[10px] text-slate-500 font-mono block pt-0.5">
                            Recorded: {formatDate(er.responded_at)}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Cancelled Details */}
                    {isCancelled && er.cancelled_reason && (
                      <div className="text-slate-400 italic text-[11px]">
                        Cancelled: {er.cancelled_reason}
                      </div>
                    )}

                    {/* Expanded Response Form */}
                    {isPending && isExpanded && (
                      <div className="p-3.5 rounded-md bg-slate-950 border border-slate-800 space-y-3 pt-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-300">
                            Log Customer Response (Triggers Re-Investigation)
                          </span>
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="text-slate-400 text-[11px]">Source:</span>
                            <select
                              value={respondSource[er.request_id] || 'CUSTOMER'}
                              onChange={e => setRespondSource(prev => ({ ...prev, [er.request_id]: e.target.value }))}
                              className="bg-slate-900 border border-slate-800 text-slate-300 rounded px-2 py-1 text-xs"
                            >
                              <option value="CUSTOMER">Customer Verified</option>
                              <option value="ANALYST">Analyst Confirmed</option>
                              <option value="SYSTEM">System Telemetry</option>
                            </select>
                          </div>
                        </div>

                        <textarea
                          rows={2}
                          placeholder="e.g. Customer confirms transaction was authorized via mobile..."
                          value={respondText[er.request_id] || ''}
                          onChange={e => setRespondText(prev => ({ ...prev, [er.request_id]: e.target.value }))}
                          className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-emerald-500"
                        />

                        {actionResult && (
                          <p className="text-xs font-medium text-emerald-400">{actionResult}</p>
                        )}

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleRespond(er.request_id)}
                            disabled={isRespondSubmitting || !(respondText[er.request_id] || '').trim()}
                            className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition disabled:opacity-40"
                          >
                            {isRespondSubmitting ? 'Recording & Investigating...' : 'Submit & Trigger Re-investigation'}
                          </button>
                          <button
                            onClick={() => setExpandedRequestId(null)}
                            className="px-2.5 py-1.5 text-slate-400 hover:text-slate-200 text-xs"
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================================================
          TAB 4: RUNS & AUDIT LOG
          ================================================== */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          {/* Historical Runs */}
          <div className="rounded-lg border border-slate-800/80 bg-slate-900/50 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                Persistent Investigation Runs
              </h3>
              <span className="text-[11px] text-slate-400 font-mono">
                {historyRuns.length} immutable snapshots
              </span>
            </div>

            {historyRuns.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No runs recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {historyRuns.map(run => (
                  <div
                    key={run.investigation_id}
                    className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-indigo-300">{run.investigation_id}</span>
                        <StatusBadge status={run.status || run.case_status} verdict={run.verdict} showVerdict={true} />
                        <span className="text-[10px] font-mono text-slate-500">
                          {formatDate(run.created_at)}
                        </span>
                      </div>
                      {run.reasoning_summary && (
                        <p className="text-slate-400 line-clamp-1 text-[11px]">{run.reasoning_summary}</p>
                      )}
                    </div>

                    <button
                      onClick={() => setSelectedInvestigationId(run.investigation_id)}
                      className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs transition shrink-0"
                    >
                      View Snapshot
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Chronological Audit Log */}
          <div className="rounded-lg border border-slate-800/80 bg-slate-900/50 p-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200 border-b border-slate-800/80 pb-2.5">
              Chronological Audit Log
            </h3>
            <AuditTimeline events={auditEvents} />
          </div>
        </div>
      )}

      {/* Historical Investigation Snapshot Modal */}
      {selectedInvestigationId && (
        <InvestigationHistoryModal
          investigationId={selectedInvestigationId}
          onClose={() => setSelectedInvestigationId(null)}
        />
      )}
    </div>
  );
};
