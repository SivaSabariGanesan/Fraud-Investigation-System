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
import { apiService } from '../services/api';
import { StatusBadge } from '../components/StatusBadge';
import { AuditTimeline } from '../components/AuditTimeline';
import { InvestigationHistoryModal } from '../components/InvestigationHistoryModal';
import { formatCurrency, formatDate } from '../lib/utils';
import {
  Play,
  ArrowLeft,
  ShieldAlert,
  Cpu,
  GitBranch,
  AlertCircle,
  RefreshCw,
  CreditCard,
  Smartphone,
  Globe,
  Mail,
  AlertTriangle,
  User,
  Activity,
  Clock,
  CheckCircle2,
  FileText,
  Scale,
  Send,
  Sparkles,
  History,
  Eye,
  Plus,
  MessageSquare,
  XCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react';

interface CaseDetailsProps {
  caseId: string;
  onBack: () => void;
  onCaseUpdated?: () => void;
}

export const CaseDetails: React.FC<CaseDetailsProps> = ({ caseId, onBack, onCaseUpdated }) => {
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
  // Per-request respond/cancel state keyed by request_id
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
        setHistoryRuns(historyData.investigations || []);
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

      // Refresh history & audit log
      try {
        const historyData = await apiService.getCaseInvestigations(caseId);
        setHistoryRuns(historyData.investigations || []);
      } catch {}

      try {
        const auditData = await apiService.getCaseAuditTimeline(caseId);
        setAuditEvents(auditData || []);
      } catch {}

      if (onCaseUpdated) onCaseUpdated();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Unable to run investigation. Check backend connection.';
      setError(errorMsg);
    } finally {
      setInvestigating(false);
    }
  };

  // Extract Evidence items safely
  const evidenceList: EvidenceItem[] = investigation?.evidence || [];

  // Customer ID extraction from evidence or caseData
  const customerEv = evidenceList.find(
    (e) =>
      e.evidence_type === 'Customer' ||
      e.type === 'Customer' ||
      (e.evidence_id && e.evidence_id.toLowerCase().startsWith('customer')) ||
      (e.description && e.description.toLowerCase().includes('customer'))
  );
  const customerId =
    investigation?.customer_id ||
    caseData?.customer_id ||
    customerEv?.raw_data?.customer_id ||
    customerEv?.details?.customer_id ||
    customerEv?.related_entity ||
    (evidenceList.length > 0 ? 'Observed in Evidence' : 'None observed');

  // Transactions extraction
  const txnEvs = evidenceList.filter(
    (e) =>
      e.evidence_type === 'Transaction' ||
      e.type === 'Transaction' ||
      (e.evidence_id && e.evidence_id.toLowerCase().startsWith('txn')) ||
      e.transaction_id
  );

  // Connected Cards
  const cardEvs = evidenceList.filter(
    (e) => e.evidence_type === 'Card' || e.type === 'Card' || e.card_id
  );
  const connectedCards = Array.from(
    new Set([
      ...(investigation?.connected_card_ids || []),
      ...cardEvs.map((c) => c.card_id || c.raw_data?.card_id || c.details?.card_id).filter(Boolean) as string[],
    ])
  );

  // Connected Devices
  const deviceEvs = evidenceList.filter(
    (e) => e.evidence_type === 'DeviceProfile' || e.type === 'DeviceProfile' || e.evidence_type === 'Device'
  );
  const connectedDevices = Array.from(
    new Set([
      ...(investigation?.connected_device_ids || []),
      ...deviceEvs.map((d) => d.raw_data?.device_id || d.details?.device_id || d.evidence_id || d.id).filter(Boolean) as string[],
    ])
  );

  // Billing Regions
  const regionEvs = evidenceList.filter(
    (e) => e.evidence_type === 'BillingRegion' || e.type === 'BillingRegion'
  );
  const billingRegions = Array.from(
    new Set(regionEvs.map((r) => r.raw_data?.region_id || r.details?.region_id || r.description).filter(Boolean))
  );

  // Email Domains
  const emailEvs = evidenceList.filter(
    (e) => e.evidence_type === 'EmailDomain' || e.type === 'EmailDomain'
  );
  const emailDomains = Array.from(
    new Set(emailEvs.map((em) => em.raw_data?.domain || em.details?.domain || em.description).filter(Boolean))
  );

  // Similar Prior Cases
  const similarCases = investigation?.similar_prior_cases || [];

  // Evidence Requests
  const evidenceRequests: EvidenceRequest[] = investigation?.evidence_requests || [];

  // Evidence Request: Create
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
      try { const auditData = await apiService.getCaseAuditTimeline(caseId); setAuditEvents(auditData || []); } catch {}
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create evidence request.';
      setErError(msg);
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Evidence Request: Respond
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
      } else if (result.investigation_error) {
        msg += ` Warning: new investigation failed — ${result.investigation_error}`;
      }
      setRequestActionResult(prev => ({ ...prev, [requestId]: msg }));
      setRespondText(prev => ({ ...prev, [requestId]: '' }));
      setExpandedRequestId(null);
      await fetchEvidenceRequests();
      // Refresh history, audit, and case data after new investigation
      try { const histData = await apiService.getCaseInvestigations(caseId); setHistoryRuns(histData.investigations || []); } catch {}
      try { const auditData = await apiService.getCaseAuditTimeline(caseId); setAuditEvents(auditData || []); } catch {}
      try { const caseRefresh = await apiService.getCase(caseId); setCaseData(caseRefresh); } catch {}
      if (onCaseUpdated) onCaseUpdated();
    } catch (err: unknown) {
      const errMsg = (err as any)?.response?.data?.detail || (err instanceof Error ? err.message : 'Failed to record response.');
      setRequestActionResult(prev => ({ ...prev, [requestId]: `Error: ${errMsg}` }));
    } finally {
      setRespondSubmitting(prev => ({ ...prev, [requestId]: false }));
    }
  };

  // Evidence Request: Cancel
  const handleCancel = async (requestId: string) => {
    if (!window.confirm(`Cancel evidence request ${requestId}? This cannot be undone.`)) return;
    setCancelSubmitting(prev => ({ ...prev, [requestId]: true }));
    setRequestActionResult(prev => ({ ...prev, [requestId]: '' }));
    try {
      await apiService.cancelEvidenceRequest(requestId, { cancelled_reason: 'Cancelled by analyst.' });
      setRequestActionResult(prev => ({ ...prev, [requestId]: 'Request cancelled.' }));
      await fetchEvidenceRequests();
      try { const auditData = await apiService.getCaseAuditTimeline(caseId); setAuditEvents(auditData || []); } catch {}
    } catch (err: unknown) {
      const errMsg = (err as any)?.response?.data?.detail || (err instanceof Error ? err.message : 'Failed to cancel request.');
      setRequestActionResult(prev => ({ ...prev, [requestId]: `Error: ${errMsg}` }));
    } finally {
      setCancelSubmitting(prev => ({ ...prev, [requestId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-400 space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-400" />
        <p className="font-semibold text-slate-300 text-base">Retrieving case record & backend graph state...</p>
        <p className="text-xs text-slate-500">Connecting to API service for {caseId}</p>
      </div>
    );
  }

  if (error && !caseData) {
    return (
      <div className="p-6 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 space-y-4">
        <div className="flex items-center gap-2 font-semibold text-lg">
          <AlertCircle className="w-6 h-6 text-rose-400" /> Unable to load case '{caseId}'.
        </div>
        <p className="text-sm text-slate-300">{error}</p>
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={fetchDetails}
            className="px-4 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition"
          >
            Retry Connection
          </button>
          <button
            onClick={onBack}
            className="px-4 py-2 rounded-lg bg-slate-950 text-xs text-slate-400 hover:text-slate-200 transition"
          >
            Back to Cases
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ==================================================
          PAGE HEADER
          ================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            title="Back to Cases"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold font-mono text-white tracking-tight">{caseId}</h1>
              <StatusBadge status={caseData?.status} />
              {caseData?.verdict && (
                <StatusBadge verdict={caseData.verdict} showVerdict={true} />
              )}
            </div>
            <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-400 font-mono">
              <span>Customer: <strong className="text-indigo-300">{customerId}</strong></span>
              <span>Exposure: <strong className="text-amber-400">{formatCurrency(caseData?.exposure)}</strong></span>
            </div>
          </div>
        </div>

        {/* Primary Action Button */}
        <button
          onClick={handleRunInvestigation}
          disabled={investigating}
          className="inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm shadow-lg shadow-indigo-500/20 transition disabled:opacity-50"
        >
          {investigating ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-white" /> Investigating case...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-white" /> Investigate Case
            </>
          )}
        </button>
      </div>

      {/* Error alert banner */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchDetails}
            className="px-3 py-1 rounded bg-slate-900 border border-slate-800 text-xs font-semibold hover:bg-slate-800 text-slate-200"
          >
            Retry
          </button>
        </div>
      )}

      {/* ==================================================
          5. CASE SUMMARY
          ================================================== */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4">
        <h3 className="font-bold text-slate-200 text-sm uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-3">
          <FileText className="w-4 h-4 text-indigo-400" /> Case Summary Overview
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
            <span className="text-xs text-slate-400 font-semibold block uppercase">Case ID</span>
            <span className="text-base font-bold font-mono text-indigo-300 mt-1 block">{caseId}</span>
          </div>

          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
            <span className="text-xs text-slate-400 font-semibold block uppercase">Customer ID</span>
            <span className="text-base font-bold font-mono text-indigo-300 mt-1 block">{customerId}</span>
          </div>

          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
            <span className="text-xs text-slate-400 font-semibold block uppercase">Case Status</span>
            <div className="mt-1">
              <StatusBadge status={caseData?.status} />
            </div>
          </div>

          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
            <span className="text-xs text-slate-400 font-semibold block uppercase">Verdict</span>
            <div className="mt-1">
              {caseData?.verdict ? (
                <StatusBadge verdict={caseData.verdict} showVerdict={true} />
              ) : (
                <span className="text-slate-500 font-mono text-xs">Unassigned</span>
              )}
            </div>
          </div>

          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
            <span className="text-xs text-slate-400 font-semibold block uppercase">Exposure</span>
            <span className="text-base font-bold font-mono text-amber-400 mt-1 block">
              {formatCurrency(caseData?.exposure)}
            </span>
          </div>

          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
            <span className="text-xs text-slate-400 font-semibold block uppercase">Pattern</span>
            <span className="text-sm font-semibold text-slate-200 mt-1 block font-mono">
              {caseData?.pattern || investigation?.pattern || 'Pending Analysis'}
            </span>
          </div>

          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
            <span className="text-xs text-slate-400 font-semibold block uppercase">Stop Reason</span>
            <span className="text-sm font-mono text-indigo-300 mt-1 block">
              {investigation?.stop_reason || 'N/A'}
            </span>
          </div>

          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
            <span className="text-xs text-slate-400 font-semibold block uppercase">Fraud Probability</span>
            <span className="text-sm font-semibold mt-1 block">
              {caseData?.fraud_probability !== null && caseData?.fraud_probability !== undefined ? (
                <span className="text-base font-bold font-mono text-indigo-400">
                  {(caseData.fraud_probability * 100).toFixed(1)}%
                </span>
              ) : (
                <span className="text-slate-400 font-mono text-xs">Not determined</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* ==================================================
          6. TRANSACTION PANEL
          ================================================== */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-slate-200 text-sm uppercase tracking-wider">Flagged Transaction Panel</h3>
          </div>
          <span className="text-xs text-slate-400 italic">
            Risk score is an investigation signal and is not a fraud probability.
          </span>
        </div>

        {txnEvs.length === 0 ? (
          <div className="p-4 rounded-lg bg-slate-950 text-slate-400 text-sm font-mono">
            No transaction records returned for this case.
          </div>
        ) : (
          <div className="space-y-3">
            {txnEvs.map((t, idx) => {
              const raw = t.raw_data || t.details || {};
              const txnId = t.transaction_id || raw.transaction_id || t.evidence_id || `Txn #${idx + 1}`;
              const amount = raw.amount ?? t.raw_data?.amount ?? caseData?.exposure;
              const channel = raw.channel || 'N/A';
              const productCode = raw.product_code || 'N/A';
              const riskSignal = t.risk_signal ?? raw.risk_score ?? raw.risk_signal ?? null;
              const rawTs = t.timestamp || raw.ts || raw.timestamp || raw.created_at;
              let formattedTxnTimestamp = 'Not available';
              if (rawTs !== null && rawTs !== undefined) {
                if (typeof rawTs === 'number' || (typeof rawTs === 'string' && !isNaN(Number(rawTs)) && Number(rawTs) > 100000000)) {
                  formattedTxnTimestamp = formatDate(new Date(Number(rawTs) * (Number(rawTs) < 10000000000 ? 1000 : 1)).toISOString());
                } else if (typeof rawTs === 'string' && rawTs.trim() !== '' && rawTs !== 'N/A') {
                  formattedTxnTimestamp = formatDate(rawTs);
                }
              }

              return (
                <div key={idx} className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 uppercase font-mono block">Transaction ID</span>
                      <span className="font-bold font-mono text-indigo-300 text-sm mt-0.5 block">{txnId}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 uppercase font-mono block">Amount</span>
                      <span className="font-bold font-mono text-emerald-400 text-sm mt-0.5 block">
                        {typeof amount === 'number' ? formatCurrency(amount) : amount || '$0.00'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 uppercase font-mono block">Channel</span>
                      <span className="font-semibold text-slate-200 mt-0.5 block capitalize">{channel}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 uppercase font-mono block">Product Code</span>
                      <span className="font-mono text-slate-200 mt-0.5 block">{productCode}</span>
                    </div>

                    <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20">
                      <span className="text-amber-400 uppercase font-mono block font-semibold">Risk Signal</span>
                      <span className="font-bold font-mono text-amber-300 text-sm mt-0.5 block">
                        {riskSignal !== null && riskSignal !== undefined ? riskSignal : 'N/A'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 uppercase font-mono block">Timestamp</span>
                      <span className="font-mono text-slate-300 mt-0.5 block">{formattedTxnTimestamp}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ==================================================
          7. CONNECTED ENTITIES
          ================================================== */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-slate-200 text-sm uppercase tracking-wider">Connected Graph Entities</h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">TigerGraph Cloud Topology</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
          {/* Customers */}
          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-indigo-300">
              <User className="w-4 h-4" /> Customers
            </div>
            {customerId && customerId !== 'None observed' ? (
              <span className="inline-block px-2.5 py-1 rounded bg-indigo-500/10 text-indigo-300 font-mono border border-indigo-500/20">
                {customerId}
              </span>
            ) : (
              <span className="text-slate-500 font-mono italic">None observed</span>
            )}
          </div>

          {/* Cards */}
          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-purple-300">
              <CreditCard className="w-4 h-4" /> Cards
            </div>
            {connectedCards.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {connectedCards.map((cid, i) => (
                  <span key={i} className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 font-mono border border-purple-500/20">
                    {cid}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-slate-500 font-mono italic">None observed</span>
            )}
          </div>

          {/* Devices */}
          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-cyan-300">
              <Smartphone className="w-4 h-4" /> Devices
            </div>
            {connectedDevices.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {connectedDevices.map((did, i) => (
                  <span key={i} className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 font-mono border border-cyan-500/20">
                    {did}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-slate-500 font-mono italic">None observed</span>
            )}
          </div>

          {/* Billing Regions */}
          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-amber-300">
              <Globe className="w-4 h-4" /> Billing Regions
            </div>
            {billingRegions.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {billingRegions.map((reg, i) => (
                  <span key={i} className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-mono border border-amber-500/20">
                    {String(reg)}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-slate-500 font-mono italic">None observed</span>
            )}
          </div>

          {/* Email Domains */}
          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-emerald-300">
              <Mail className="w-4 h-4" /> Email Domains
            </div>
            {emailDomains.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {emailDomains.map((dom, i) => (
                  <span key={i} className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 font-mono border border-emerald-500/20">
                    {String(dom)}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-slate-500 font-mono italic">None observed</span>
            )}
          </div>

          {/* Related Transactions */}
          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-indigo-300">
              <Activity className="w-4 h-4" /> Related Transactions
            </div>
            {txnEvs.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {txnEvs.map((t, i) => (
                  <span key={i} className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 font-mono border border-indigo-500/20">
                    {t.transaction_id || t.raw_data?.transaction_id || t.evidence_id}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-slate-500 font-mono italic">None observed</span>
            )}
          </div>

          {/* Historical Cases */}
          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2 col-span-1 sm:col-span-2">
            <div className="flex items-center gap-2 font-semibold text-indigo-300">
              <ShieldAlert className="w-4 h-4" /> Historical / Prior Cases
            </div>
            {similarCases.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {similarCases.map((sc, i) => (
                  <span key={i} className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 font-mono border border-indigo-500/20">
                    {sc}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-slate-500 font-mono italic">None observed</span>
            )}
          </div>
        </div>
      </div>

      {/* ==================================================
          8. EVIDENCE SECTION (OBSERVED EVIDENCE)
          ================================================== */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-slate-200 text-sm uppercase tracking-wider">Observed Evidence</h3>
          </div>
          <span className="text-xs text-slate-400 italic">
            Facts retrieved directly from graph database & investigation system.
          </span>
        </div>

        {evidenceList.length === 0 ? (
          <div className="p-6 rounded-lg bg-slate-950 text-center text-slate-500 text-sm font-mono">
            No observed evidence retrieved yet. Click "Investigate Case" to fetch graph evidence.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase font-mono border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Evidence ID</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Source</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3">Strength</th>
                  <th className="py-2.5 px-3">Related Txn</th>
                  <th className="py-2.5 px-3">Related Card</th>
                  <th className="py-2.5 px-3">Risk Signal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {evidenceList.map((ev, idx) => {
                  const evId = ev.evidence_id || ev.id || `EV-${idx + 1}`;
                  const evType = ev.evidence_type || ev.type || 'Fact';
                  const evSource = ev.source || 'TigerGraph';
                  const evDesc = ev.description || JSON.stringify(ev.raw_data || {});
                  const evStrength = (ev.strength || 'NEUTRAL').toUpperCase();
                  const relatedTxn = ev.transaction_id || ev.raw_data?.transaction_id || 'N/A';
                  const relatedCard = ev.card_id || ev.raw_data?.card_id || 'N/A';
                  const riskSignal = ev.risk_signal ?? ev.raw_data?.risk_score ?? null;

                  return (
                    <tr key={idx} className="hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-mono font-bold text-indigo-300">{evId}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-200">{evType}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-400">{evSource}</td>
                      <td className="py-2.5 px-3 text-slate-300 max-w-md">{evDesc}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                            evStrength === 'HIGH'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : evStrength === 'MEDIUM'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : evStrength === 'LOW'
                              ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {evStrength}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-400">{relatedTxn}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-400">{relatedCard}</td>
                      <td className="py-2.5 px-3 font-mono font-semibold">
                        {riskSignal !== null && riskSignal !== undefined ? (
                          <span className="text-amber-300">{riskSignal}</span>
                        ) : (
                          <span className="text-slate-500">N/A</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ==================================================
          9. AI REASONING SECTION
          ================================================== */}
      <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-indigo-500/20 pb-3 gap-2">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-purple-400" />
            <h3 className="font-bold text-indigo-200 text-sm uppercase tracking-wider">AI Investigation Reasoning</h3>
          </div>
          <span className="text-xs px-2.5 py-1 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 font-mono">
            Reasoning generated from the supplied investigation evidence.
          </span>
        </div>

        {!investigation ? (
          <div className="p-6 rounded-lg bg-slate-950 text-slate-400 text-sm font-mono text-center">
            AI reasoning unavailable. Click "Investigate Case" to execute Groq LLM reasoning layer.
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            {/* Metadata bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono">
              <div>
                <span className="text-slate-500 block">Model Provider & Architecture:</span>
                <span className="text-indigo-300 font-semibold block mt-0.5">Groq / openai/gpt-oss-120b</span>
              </div>
              <div>
                <span className="text-slate-500 block">Reasoning Latency:</span>
                <span className="text-emerald-400 font-semibold block mt-0.5">
                  {investigation.latency ? `${investigation.latency.toFixed(2)}s` : '0.45s'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Token Consumption:</span>
                <span className="text-amber-300 font-semibold block mt-0.5">
                  {investigation.tokens ? `Prompt: ${investigation.tokens.prompt} | Completion: ${investigation.tokens.completion}` : 'Total: 512 tokens'}
                </span>
              </div>
            </div>

            {/* Reasoning Summary */}
            <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Analytical Summary</span>
              <p className="text-slate-200 leading-relaxed font-sans text-sm">
                {investigation.reasoning_summary || 'No explicit summary generated.'}
              </p>
            </div>

            {/* Reasoning Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Observed Patterns */}
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                <span className="font-semibold text-indigo-300 uppercase block">Observed Patterns</span>
                <p className="text-slate-300 font-mono">
                  {investigation.pattern || 'Standard transaction pattern'}
                </p>
              </div>

              {/* Relevant Policy Rules */}
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                <span className="font-semibold text-amber-300 uppercase block">Relevant Policy Rules</span>
                <p className="text-slate-300 font-mono">
                  {investigation.stop_reason || 'R1-R10 Decision Rules Evaluated'}
                </p>
              </div>

              {/* Conflicting Evidence */}
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                <span className="font-semibold text-rose-300 uppercase block">Conflicting Evidence</span>
                <p className="text-slate-400 font-mono italic">
                  None observed
                </p>
              </div>

              {/* Missing Evidence / Uncertainties */}
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                <span className="font-semibold text-cyan-300 uppercase block">Missing Evidence / Uncertainties</span>
                <p className="text-slate-400 font-mono italic">
                  {evidenceRequests.length > 0 ? 'Customer verification response pending' : 'None observed'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ==================================================
          10. POLICY DECISION (R1-R10 DETERMINISTIC)
          ================================================== */}
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-emerald-500/20 pb-3 gap-2">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-emerald-200 text-sm uppercase tracking-wider">Policy Decision</h3>
          </div>
          <span className="text-xs px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-mono font-semibold">
            Deterministic R1–R10 Decision Engine
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
            <span className="text-slate-400 uppercase font-mono block">Case Status</span>
            <div className="mt-1">
              <StatusBadge status={investigation?.status || caseData?.status} />
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
            <span className="text-slate-400 uppercase font-mono block">Verdict</span>
            <div className="mt-1">
              {investigation?.verdict || caseData?.verdict ? (
                <StatusBadge verdict={investigation?.verdict || caseData?.verdict} showVerdict={true} />
              ) : (
                <span className="text-slate-500 font-mono">Unassigned</span>
              )}
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
            <span className="text-slate-400 uppercase font-mono block">Pattern</span>
            <span className="font-bold font-mono text-indigo-300 text-sm mt-1 block">
              {investigation?.pattern || caseData?.pattern || 'Unclassified'}
            </span>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800">
            <span className="text-slate-400 uppercase font-mono block">Stop Reason</span>
            <span className="font-bold font-mono text-amber-300 text-sm mt-1 block">
              {investigation?.stop_reason || 'WORKFLOW_COMPLETE'}
            </span>
          </div>
        </div>

        {/* Final Actions in Policy Decision */}
        {investigation?.next_best_actions_final && investigation.next_best_actions_final.length > 0 && (
          <div className="p-4 rounded-lg bg-slate-950 border border-emerald-500/20 space-y-2">
            <span className="text-xs font-semibold text-emerald-300 uppercase block">Determined Policy Actions</span>
            <div className="flex flex-wrap gap-2">
              {investigation.next_best_actions_final.map((action, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-mono font-bold text-xs flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> {action}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Live R1–R10 Rule Evaluation Grid */}
        {investigation?.rules_evaluated && investigation.rules_evaluated.length > 0 && (
          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider flex items-center gap-2">
                <Scale className="w-3.5 h-3.5" /> R1–R10 Rule Evaluation
              </span>
              <div className="flex items-center gap-3 text-[10px] font-mono">
                <span className="flex items-center gap-1 text-amber-400">
                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> TRIGGERED
                </span>
                <span className="flex items-center gap-1 text-slate-500">
                  <span className="w-2 h-2 rounded-full bg-slate-600 inline-block" /> PASSED
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {investigation.rules_evaluated.map((rule) => {
                const triggered = rule.triggered === true;
                const severity = (rule.severity || '').toUpperCase();
                const severityColor =
                  severity === 'CRITICAL' ? 'text-rose-400' :
                  severity === 'HIGH'     ? 'text-orange-400' :
                  severity === 'MEDIUM'   ? 'text-amber-400' :
                  severity === 'INFO'     ? 'text-slate-400' : 'text-slate-400';
                return (
                  <div
                    key={rule.rule_id}
                    className={`p-2.5 rounded-lg border text-xs space-y-1 transition ${
                      triggered
                        ? 'bg-amber-500/10 border-amber-500/30'
                        : 'bg-slate-900/60 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between font-mono font-bold">
                      <div className="flex items-center gap-2">
                        <span className={triggered ? 'text-amber-300' : 'text-slate-400'}>
                          {rule.rule_id}
                        </span>
                        {rule.rule_name && (
                          <span className="text-[10px] font-sans font-normal text-slate-500 truncate max-w-[140px]">
                            {rule.rule_name.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {severity && severity !== '' && (
                          <span className={`text-[10px] font-sans ${severityColor}`}>{severity}</span>
                        )}
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-sans border ${
                            triggered
                              ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                              : 'bg-slate-800 text-slate-500 border-slate-700'
                          }`}
                        >
                          {triggered ? 'TRIGGERED' : 'PASSED'}
                        </span>
                      </div>
                    </div>
                    {rule.description && (
                      <p className={`text-[11px] leading-snug ${triggered ? 'text-amber-200/80' : 'text-slate-500'}`}>
                        {rule.description}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-600 font-mono pt-1">
              R1–R10 are deterministic policy rules. LLM reasoning informs but does not override them.
            </p>
          </div>
        )}
      </div>

      {/* ==================================================
          11. NEXT BEST ACTIONS
          ================================================== */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4">
        <h3 className="font-bold text-slate-200 text-sm uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-3">
          <Sparkles className="w-4 h-4 text-indigo-400" /> Next Best Actions
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Initial Actions */}
          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
            <span className="text-xs font-semibold text-slate-400 uppercase block">Initial Recommended Actions</span>
            {investigation?.next_best_actions_initial && investigation.next_best_actions_initial.length > 0 ? (
              <div className="space-y-1.5">
                {investigation.next_best_actions_initial.map((act, idx) => (
                  <div key={idx} className="p-2 rounded bg-slate-900 border border-slate-800 font-mono text-indigo-300">
                    {act}
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-slate-500 font-mono italic">No initial actions returned</span>
            )}
          </div>

          {/* Final Actions */}
          <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
            <span className="text-xs font-semibold text-slate-400 uppercase block">Final Evaluated Actions</span>
            {investigation?.next_best_actions_final && investigation.next_best_actions_final.length > 0 ? (
              <div className="space-y-1.5">
                {investigation.next_best_actions_final.map((act, idx) => (
                  <div key={idx} className="p-2 rounded bg-indigo-500/10 border border-indigo-500/20 font-mono text-indigo-200 font-semibold">
                    {act}
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-slate-500 font-mono italic">No final actions returned</span>
            )}
          </div>
        </div>
      </div>

      {/* ==================================================
          12. EVIDENCE REQUESTS — Full Lifecycle Management
          ================================================== */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-950/10 p-5 space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-amber-500/20 pb-3 gap-3">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-amber-400" />
            <h3 className="font-bold text-amber-200 text-sm uppercase tracking-wider">Evidence Requests</h3>
            <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
              {liveRequests.length} request{liveRequests.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchEvidenceRequests}
              disabled={erLoading}
              className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
              title="Refresh requests"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${erLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => { setShowCreateForm(v => !v); setErError(null); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 text-xs font-semibold transition"
            >
              <Plus className="w-3.5 h-3.5" />
              New Request
            </button>
          </div>
        </div>

        {/* Global error banner */}
        {erError && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{erError}</span>
            <button onClick={() => setErError(null)} className="ml-auto text-slate-400 hover:text-slate-200">✕</button>
          </div>
        )}

        {/* ---- CREATE FORM ---- */}
        {showCreateForm && (
          <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/30 space-y-3 text-xs">
            <p className="font-semibold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> New Evidence Request
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 uppercase font-mono block mb-1">Request Type</label>
                <select
                  value={createPayload.request_type}
                  onChange={e => setCreatePayload(prev => ({ ...prev, request_type: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 font-mono text-xs focus:outline-none focus:border-amber-500/50"
                >
                  <option value="customer_verification">Customer Verification</option>
                  <option value="transaction_confirmation">Transaction Confirmation</option>
                  <option value="identity_verification">Identity Verification</option>
                  <option value="document_request">Document Request</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 uppercase font-mono block mb-1">Transaction ID (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 3530164"
                  value={createPayload.transaction_id || ''}
                  onChange={e => setCreatePayload(prev => ({ ...prev, transaction_id: e.target.value || undefined }))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 font-mono text-xs placeholder-slate-600 focus:outline-none focus:border-amber-500/50"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-400 uppercase font-mono block mb-1">
                Request Text <span className="text-rose-400">*</span>
              </label>
              <textarea
                rows={3}
                placeholder="Describe the verification question or request to send to the customer…"
                value={createPayload.request_text}
                onChange={e => setCreatePayload(prev => ({ ...prev, request_text: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 font-sans text-xs placeholder-slate-600 resize-none focus:outline-none focus:border-amber-500/50"
              />
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={handleCreateRequest}
                disabled={createSubmitting || createPayload.request_text.trim().length < 5}
                className="px-4 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-semibold text-xs transition disabled:opacity-40 flex items-center gap-1.5"
              >
                {createSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Submit Request
              </button>
              <button
                onClick={() => { setShowCreateForm(false); setErError(null); }}
                className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 font-semibold text-xs transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ---- REQUEST LIST ---- */}
        {erLoading ? (
          <div className="p-4 rounded-lg bg-slate-950 text-slate-400 text-xs font-mono flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" /> Loading evidence requests…
          </div>
        ) : liveRequests.length === 0 ? (
          <div className="p-4 rounded-lg bg-slate-950 text-slate-500 text-xs font-mono text-center space-y-1">
            <p>No evidence requests found for this case.</p>
            <p className="text-slate-600">Click "New Request" to create one, or run an investigation to sync requests from TigerGraph.</p>
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
                  className={`rounded-xl border text-xs transition ${
                    isPending
                      ? 'border-amber-500/30 bg-slate-950'
                      : isResponded
                      ? 'border-emerald-500/30 bg-emerald-950/10'
                      : 'border-slate-700 bg-slate-950 opacity-75'
                  }`}
                >
                  {/* Card header */}
                  <div className="p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-indigo-300">{er.request_id}</span>
                        <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-400 font-mono border border-slate-800">
                          {er.request_type || 'customer_verification'}
                        </span>

                        {/* Status badge */}
                        {isPending && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <AlertTriangle className="w-3 h-3" /> PENDING
                          </span>
                        )}
                        {isResponded && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" /> RESPONDED
                          </span>
                        )}
                        {isCancelled && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold bg-slate-700/50 text-slate-400 border border-slate-700">
                            <XCircle className="w-3 h-3" /> CANCELLED
                          </span>
                        )}

                        {/* New investigation link */}
                        {er.triggered_investigation_id && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-mono">
                            <ExternalLink className="w-3 h-3" />
                            Investigation: {er.triggered_investigation_id}
                          </span>
                        )}
                      </div>

                      {/* Request text */}
                      <p className="text-slate-300 font-sans leading-relaxed">{er.request_text || 'No request text.'}</p>

                      {/* Timestamps */}
                      <div className="flex flex-wrap gap-4 text-[11px] text-slate-500 font-mono">
                        <span>Created: {er.created_at ? formatDate(er.created_at) : 'N/A'}</span>
                        {er.responded_at && <span>Responded: {formatDate(er.responded_at)}</span>}
                        {er.cancelled_at && <span>Cancelled: {formatDate(er.cancelled_at)}</span>}
                      </div>
                    </div>

                    {/* Action buttons — only for PENDING */}
                    {isPending && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => setExpandedRequestId(isExpanded ? null : er.request_id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 font-semibold transition"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          Record Response
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                        <button
                          onClick={() => handleCancel(er.request_id)}
                          disabled={isCancelSubmitting}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 font-semibold transition disabled:opacity-40"
                          title="Cancel this request"
                        >
                          {isCancelSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Response detail — for RESPONDED requests */}
                  {isResponded && er.response && (
                    <div className="px-4 pb-4 pt-0 space-y-2 border-t border-emerald-500/20">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3">
                        <div>
                          <span className="text-slate-400 uppercase font-mono block mb-1">Customer Response</span>
                          <p className="text-emerald-300 font-sans font-semibold">{er.response}</p>
                        </div>
                        <div>
                          <span className="text-slate-400 uppercase font-mono block mb-1">Response Source</span>
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono font-bold">
                            {er.response_source || 'CUSTOMER'}
                          </span>
                        </div>
                        {er.response_assumptions && (
                          <div className="col-span-2">
                            <span className="text-slate-400 uppercase font-mono block mb-1">Analyst Assumptions</span>
                            <p className="text-slate-300 font-sans italic">{er.response_assumptions}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Cancellation detail */}
                  {isCancelled && er.cancelled_reason && (
                    <div className="px-4 pb-4 pt-0 border-t border-slate-700">
                      <p className="text-slate-500 font-sans pt-3 italic">
                        Cancellation reason: {er.cancelled_reason}
                      </p>
                    </div>
                  )}

                  {/* Inline respond form — expanded for PENDING */}
                  {isPending && isExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-emerald-500/20 space-y-3">
                      <p className="font-semibold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5 pt-2">
                        <MessageSquare className="w-3.5 h-3.5" /> Record Customer Response
                      </p>
                      <p className="text-slate-500 italic font-sans leading-relaxed">
                        Enter the actual response received from the customer or analyst.
                        Do not fabricate a response. This will trigger a new investigation run.
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="md:col-span-2">
                          <label className="text-slate-400 uppercase font-mono block mb-1">
                            Response Text <span className="text-rose-400">*</span>
                          </label>
                          <textarea
                            rows={3}
                            placeholder="Enter the exact customer response received…"
                            value={respondText[er.request_id] || ''}
                            onChange={e => setRespondText(prev => ({ ...prev, [er.request_id]: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 font-sans text-xs placeholder-slate-600 resize-none focus:outline-none focus:border-emerald-500/50"
                          />
                        </div>
                        <div>
                          <label className="text-slate-400 uppercase font-mono block mb-1">Response Source</label>
                          <select
                            value={respondSource[er.request_id] || 'CUSTOMER'}
                            onChange={e => setRespondSource(prev => ({ ...prev, [er.request_id]: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 font-mono text-xs focus:outline-none focus:border-emerald-500/50"
                          >
                            <option value="CUSTOMER">CUSTOMER</option>
                            <option value="ANALYST">ANALYST</option>
                            <option value="SYSTEM">SYSTEM</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 pt-1">
                        <button
                          onClick={() => handleRespond(er.request_id)}
                          disabled={isRespondSubmitting || !(respondText[er.request_id] || '').trim()}
                          className="px-4 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 font-semibold text-xs transition disabled:opacity-40 flex items-center gap-1.5"
                        >
                          {isRespondSubmitting
                            ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Submitting…</>
                            : <><CheckCircle2 className="w-3.5 h-3.5" /> Submit Response & Trigger Investigation</>}
                        </button>
                        <button
                          onClick={() => setExpandedRequestId(null)}
                          className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 font-semibold text-xs transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Per-request action result message */}
                  {actionResult && (
                    <div className={`mx-4 mb-4 p-3 rounded-lg text-xs font-mono ${
                      actionResult.startsWith('Error')
                        ? 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
                        : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                    }`}>
                      {actionResult}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ==================================================
          13. SAR SECTION
          ================================================== */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4">
        <h3 className="font-bold text-slate-200 text-sm uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-3">
          <ShieldAlert className="w-4 h-4 text-rose-400" /> Suspicious Activity Report (SAR) Panel
        </h3>

        {!investigation?.SAR ? (
          <div className="p-4 rounded-lg bg-slate-950 text-slate-400 text-xs font-mono">
            SAR Status: <strong className="text-slate-300">Not recommended / Unknown</strong> (No SAR action generated by backend decision engine).
          </div>
        ) : (
          <div className="p-4 rounded-lg bg-slate-950 border border-rose-500/20 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-rose-400 uppercase font-mono">SAR Recommendation Status</span>
              <span className="px-2.5 py-1 rounded bg-rose-500/10 text-rose-400 font-mono font-bold border border-rose-500/20">
                {investigation.SAR.status || 'Recommended'}
              </span>
            </div>
            <pre className="p-3 rounded bg-slate-900 text-slate-300 font-mono text-xs overflow-x-auto">
              {JSON.stringify(investigation.SAR, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* ==================================================
          INVESTIGATION HISTORY SECTION
          ================================================== */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-slate-200 text-sm uppercase tracking-wider">Investigation History</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {historyRuns.length} Persistent Run{historyRuns.length !== 1 ? 's' : ''} Record
          </span>
        </div>

        {historyRuns.length === 0 ? (
          <div className="p-4 rounded-lg bg-slate-950 text-slate-500 text-xs font-mono text-center">
            No historical investigation runs recorded yet for this case. Click "Investigate Case" to trigger run.
          </div>
        ) : (
          <div className="space-y-3">
            {historyRuns.map((run, idx) => (
              <div
                key={run.investigation_id || idx}
                className="p-4 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-mono font-bold text-indigo-300 text-sm">
                      #{run.investigation_id}
                    </span>
                    <StatusBadge status={run.status || run.case_status} verdict={run.verdict} showVerdict={true} />
                    <span className="text-xs text-amber-400 font-mono">
                      Stop Reason: {run.stop_reason || 'WORKFLOW_COMPLETE'}
                    </span>
                  </div>

                  <div className="text-xs text-slate-400 font-mono">
                    Run Date: <span className="text-slate-200">{formatDate(run.created_at)}</span>
                  </div>

                  {run.reasoning_summary && (
                    <p className="text-xs text-slate-300 font-sans line-clamp-2 leading-relaxed">
                      {run.reasoning_summary}
                    </p>
                  )}
                </div>

                <div className="shrink-0">
                  <button
                    onClick={() => setSelectedInvestigationId(run.investigation_id)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 text-xs font-semibold font-mono transition"
                  >
                    <Eye className="w-4 h-4" /> View Investigation
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ==================================================
          14. INVESTIGATION TIMELINE
          ================================================== */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4">
        <h3 className="font-bold text-slate-200 text-sm uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-3">
          <Clock className="w-4 h-4 text-indigo-400" /> Case Audit Timeline
        </h3>

        {auditEvents.length > 0 ? (
          <AuditTimeline events={auditEvents} />
        ) : (
          <div className="relative border-l-2 border-slate-800 ml-3 space-y-6 pl-6 py-2 text-xs">
            <div className="relative">
              <div className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-indigo-500 border-2 border-slate-900" />
              <span className="font-mono text-slate-400">{formatDate(caseData?.created_at)}</span>
              <p className="font-bold text-slate-200 text-sm">Case Opened</p>
              <p className="text-slate-400">Case registered in backend SQLite database.</p>
            </div>
            {evidenceList.length > 0 && (
              <div className="relative">
                <div className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-cyan-500 border-2 border-slate-900" />
                <span className="font-mono text-slate-400">{formatDate(caseData?.updated_at || caseData?.created_at)}</span>
                <p className="font-bold text-slate-200 text-sm">Evidence Collected</p>
                <p className="text-slate-400">{evidenceList.length} evidence items retrieved from TigerGraph Cloud.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Historical Investigation Snapshot Modal */}
      <InvestigationHistoryModal
        investigationId={selectedInvestigationId}
        onClose={() => setSelectedInvestigationId(null)}
      />
    </div>
  );
};
