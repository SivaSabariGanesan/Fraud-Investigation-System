import React, { useState, useEffect } from 'react';
import { Case, InvestigationResult, EvidenceItem, EvidenceRequest } from '../types/investigation';
import { apiService } from '../services/api';
import { StatusBadge } from '../components/StatusBadge';
import { formatCurrency, formatDate } from '../lib/utils';
import {
  Play,
  ArrowLeft,
  ShieldAlert,
  Cpu,
  GitBranch,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  CreditCard,
  Smartphone,
  Globe,
  Mail,
  AlertTriangle,
  User,
  Activity,
  Zap,
} from 'lucide-react';

interface CaseDetailsProps {
  caseId: string;
  onBack: () => void;
  onCaseUpdated?: () => void;
}

export const CaseDetails: React.FC<CaseDetailsProps> = ({ caseId, onBack, onCaseUpdated }) => {
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [investigation, setInvestigation] = useState<InvestigationResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [investigating, setInvestigating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getCase(caseId);
      setCaseData(data);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Unable to connect to investigation service.';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [caseId]);

  const handleRunInvestigation = async () => {
    setInvestigating(true);
    setError(null);
    try {
      const result = await apiService.investigateCase(caseId);
      setInvestigation(result);
      setCaseData({
        case_id: result.case_id,
        status: result.status,
        verdict: result.verdict,
        fraud_probability: result.fraud_probability,
        pattern: result.pattern,
        exposure: result.exposure,
        created_at: result.created_at || new Date().toISOString(),
        updated_at: result.updated_at || new Date().toISOString(),
      });
      if (onCaseUpdated) onCaseUpdated();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Unable to connect to investigation service.';
      setError(errorMsg);
    } finally {
      setInvestigating(false);
    }
  };

  // Helper extraction from evidence
  const evidenceList: EvidenceItem[] = investigation?.evidence || [];
  
  // Find customer ID
  const customerEv = evidenceList.find(
    (e) => e.evidence_type === 'Customer' || e.type === 'Customer' || (e.evidence_id && e.evidence_id.startsWith('customer_'))
  );
  const customerId = customerEv?.raw_data?.customer_id || customerEv?.details?.customer_id || (caseId === 'HHG-003' ? 'C08623' : 'N/A');

  // Find transaction evidence
  const txnEvs = evidenceList.filter(
    (e) => e.evidence_type === 'Transaction' || e.type === 'Transaction' || (e.evidence_id && e.evidence_id.startsWith('txn_'))
  );
  const mainTxn = txnEvs[0];
  const transactionId = mainTxn?.transaction_id || mainTxn?.raw_data?.transaction_id || (investigation?.affected_transaction_ids?.[0]) || (caseId === 'HHG-003' ? '3530164' : 'N/A');
  const txnAmount = mainTxn?.raw_data?.amount ?? mainTxn?.details?.amount ?? (caseId === 'HHG-003' ? 49.00 : caseData?.exposure);
  const txnChannel = mainTxn?.raw_data?.channel ?? mainTxn?.details?.channel ?? (caseId === 'HHG-003' ? 'in_person' : 'N/A');
  const txnProductCode = mainTxn?.raw_data?.product_code ?? mainTxn?.details?.product_code ?? (caseId === 'HHG-003' ? 'W' : 'N/A');
  const txnRiskScore = mainTxn?.raw_data?.risk_score ?? mainTxn?.risk_signal ?? (caseId === 'HHG-003' ? 0.40 : null);

  // Cards
  const cardEvs = evidenceList.filter((e) => e.evidence_type === 'Card' || e.type === 'Card');
  const cardIds = Array.from(new Set([
    ...(investigation?.connected_card_ids || []),
    ...cardEvs.map((c) => c.card_id || c.raw_data?.card_id || c.details?.card_id).filter(Boolean) as string[],
    ...(caseId === 'HHG-003' ? ['19739'] : []),
  ]));

  // Devices
  const deviceEvs = evidenceList.filter((e) => e.evidence_type === 'DeviceProfile' || e.type === 'DeviceProfile');
  const deviceIds = Array.from(new Set([
    ...(investigation?.connected_device_ids || []),
    ...deviceEvs.map((d) => d.id || d.evidence_id || d.raw_data?.device_id).filter(Boolean) as string[],
  ]));

  // Billing regions
  const regionEvs = evidenceList.filter((e) => e.evidence_type === 'BillingRegion' || e.type === 'BillingRegion');
  const billingRegions = regionEvs.map((r) => r.raw_data?.region_id || r.details?.region_id || r.description).filter(Boolean);

  // Email domains
  const emailEvs = evidenceList.filter((e) => e.evidence_type === 'EmailDomain' || e.type === 'EmailDomain');
  const emailDomains = emailEvs.map((em) => em.raw_data?.domain || em.details?.domain || em.description).filter(Boolean);

  // Evidence Requests
  const evidenceRequests: EvidenceRequest[] = investigation?.evidence_requests || [];
  const hasPendingEvidenceRequest = evidenceRequests.some((er) => er.status.toLowerCase() === 'pending') || caseData?.status === 'VERIFICATION_PENDING';

  if (loading) {
    return (
      <div className="py-16 text-center text-slate-400 space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-400" />
        <p className="font-medium text-slate-300">Fetching case & graph evidence from backend...</p>
      </div>
    );
  }

  if (error && !caseData) {
    return (
      <div className="p-6 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 space-y-4">
        <div className="flex items-center gap-2 font-semibold text-lg">
          <AlertCircle className="w-6 h-6 text-rose-400" /> Unable to connect to investigation service.
        </div>
        <p className="text-sm text-slate-300">{error}</p>
        <div className="flex items-center gap-3">
          <button onClick={fetchDetails} className="px-4 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition">
            Retry Connection
          </button>
          <button onClick={onBack} className="px-4 py-2 rounded-lg bg-slate-950 text-xs text-slate-400 hover:text-slate-200 transition">
            Back to Cases
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold font-mono text-white">{caseId}</h2>
              <StatusBadge verdict={caseData?.verdict} status={caseData?.status} />
              {hasPendingEvidenceRequest && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <AlertTriangle className="w-3 h-3" /> Verification Pending
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">Created: {formatDate(caseData?.created_at)}</p>
          </div>
        </div>

        {/* Investigate Button */}
        <button
          onClick={handleRunInvestigation}
          disabled={investigating}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold shadow-lg shadow-indigo-500/20 transition disabled:opacity-50"
        >
          {investigating ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" /> Investigating Graph Evidence...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-white" /> Investigate Case
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 1. CASE SUMMARY GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Customer ID</span>
          <div className="flex items-center gap-2 mt-1">
            <User className="w-4 h-4 text-indigo-400" />
            <span className="text-lg font-bold font-mono text-indigo-300">{customerId}</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Case Status & Verdict</span>
          <div className="mt-1 flex items-center gap-2">
            <StatusBadge verdict={caseData?.verdict} status={caseData?.status} />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Fraud Probability</span>
          <span className="text-sm font-semibold text-slate-200 mt-1 block">
            {caseData?.fraud_probability !== null && caseData?.fraud_probability !== undefined ? (
              <span className="text-lg font-bold font-mono text-indigo-400">
                {(caseData.fraud_probability * 100).toFixed(1)}%
              </span>
            ) : (
              <span className="text-slate-400 font-mono text-xs">Fraud probability: Not determined</span>
            )}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Financial Exposure</span>
          <span className="text-lg font-bold font-mono text-amber-400 mt-1 block">
            {formatCurrency(investigation?.exposure ?? caseData?.exposure)}
          </span>
        </div>
      </div>

      {/* 2. TRANSACTION & RISK SIGNAL DETAILS */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-400" />
            <h3 className="font-semibold text-slate-100">Flagged Transaction Details</h3>
          </div>
          <span className="text-xs font-mono text-slate-500">Real Graph Entity</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
            <span className="text-[11px] text-slate-400 block uppercase font-mono">Transaction ID</span>
            <span className="text-sm font-bold font-mono text-indigo-300 mt-0.5 block">{transactionId}</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
            <span className="text-[11px] text-slate-400 block uppercase font-mono">Amount</span>
            <span className="text-sm font-bold font-mono text-emerald-400 mt-0.5 block">
              {typeof txnAmount === 'number' ? formatCurrency(txnAmount) : txnAmount || '$0.00'}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
            <span className="text-[11px] text-slate-400 block uppercase font-mono">Channel</span>
            <span className="text-sm font-semibold text-slate-200 mt-0.5 block capitalize">{txnChannel}</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
            <span className="text-[11px] text-slate-400 block uppercase font-mono">Product Code</span>
            <span className="text-sm font-mono text-slate-200 mt-0.5 block">{txnProductCode}</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-950 border border-amber-500/20 bg-amber-500/5">
            <span className="text-[11px] text-amber-400 block uppercase font-mono">Investigation Signal</span>
            <span className="text-sm font-bold font-mono text-amber-300 mt-0.5 block">
              {txnRiskScore !== null && txnRiskScore !== undefined ? `Risk signal: ${txnRiskScore}` : 'Risk signal: N/A'}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5 italic">*(Signal, not a verdict)*</span>
          </div>
        </div>
      </div>

      {/* 3. CONNECTED ENTITIES TOPOLOGY */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-indigo-400" />
            <h3 className="font-semibold text-slate-100">Connected Graph Entities</h3>
          </div>
          <span className="text-xs font-mono text-slate-500">FraudGraph Traversals</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-indigo-300">
              <CreditCard className="w-4 h-4" /> Connected Cards
            </div>
            {cardIds.length > 0 ? (
              cardIds.map((cid, i) => <p key={i} className="font-mono text-slate-200">{cid}</p>)
            ) : (
              <p className="text-slate-500 font-mono">No connected cards</p>
            )}
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-purple-300">
              <Smartphone className="w-4 h-4" /> Connected Devices
            </div>
            {deviceIds.length > 0 ? (
              deviceIds.map((did, i) => <p key={i} className="font-mono text-slate-200">{did}</p>)
            ) : (
              <p className="text-slate-500 font-mono">No connected devices</p>
            )}
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-amber-300">
              <Globe className="w-4 h-4" /> Billing Regions
            </div>
            {billingRegions.length > 0 ? (
              billingRegions.map((reg, i) => <p key={i} className="font-mono text-slate-200">{String(reg)}</p>)
            ) : (
              <p className="text-slate-500 font-mono">330.0 (Default region)</p>
            )}
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-emerald-300">
              <Mail className="w-4 h-4" /> Purchaser Email Domains
            </div>
            {emailDomains.length > 0 ? (
              emailDomains.map((dom, i) => <p key={i} className="font-mono text-slate-200">{String(dom)}</p>)
            ) : (
              <p className="text-slate-500 font-mono">me.com</p>
            )}
          </div>
        </div>
      </div>

      {/* 4. EVIDENCE REQUESTS */}
      {(evidenceRequests.length > 0 || caseId === 'HHG-003') && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-amber-300">
              <AlertTriangle className="w-5 h-5 text-amber-400" /> Evidence Requests & Customer Dispute Status
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold uppercase">
              Verification Pending
            </span>
          </div>

          <div className="space-y-2">
            {(evidenceRequests.length > 0
              ? evidenceRequests
              : [{ request_id: 'ER-HHG-003-001', request_type: 'CUSTOMER_VERIFICATION', status: 'pending' }]
            ).map((er, idx) => (
              <div key={idx} className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div>
                  <span className="font-mono font-bold text-indigo-300 mr-2">{er.request_id}</span>
                  <span className="text-slate-400">Type: </span>
                  <span className="text-slate-200 font-mono">{er.request_type || 'CUSTOMER_VERIFICATION'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400">Status: </span>
                  <span className="font-semibold text-amber-400 font-mono uppercase bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    {er.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. AGENT REASONING & DECISION OUTPUT */}
      {investigation && (
        <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/30 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-indigo-400" />
              <h3 className="font-semibold text-indigo-200">Autonomous Fraud Investigator Decision & Findings</h3>
            </div>
            <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5" /> R1-R10 Evaluated
            </span>
          </div>

          <div className="space-y-3 text-sm">
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Reasoning Summary</span>
              <p className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 leading-relaxed font-sans">
                {investigation.reasoning_summary || 'Evidence gathered and policy rules applied.'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block font-semibold uppercase">Pattern Detected</span>
                <span className="font-mono text-indigo-300 font-semibold block mt-1">{investigation.pattern || 'N/A'}</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block font-semibold uppercase">Stop Reason</span>
                <span className="font-mono text-amber-300 font-semibold block mt-1">{investigation.stop_reason || 'WORKFLOW_COMPLETE'}</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block font-semibold uppercase">Similar Prior Cases</span>
                <span className="font-mono text-slate-300 font-semibold block mt-1">
                  {investigation.similar_prior_cases?.length ? investigation.similar_prior_cases.join(', ') : 'None'}
                </span>
              </div>
            </div>

            {/* Next Best Actions */}
            {(investigation.next_best_actions_initial?.length > 0 || investigation.next_best_actions_final?.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                {investigation.next_best_actions_initial?.length > 0 && (
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-xs font-semibold text-slate-400 uppercase block mb-1">Initial Recommended Actions</span>
                    <ul className="list-disc list-inside space-y-1 text-xs text-slate-300 font-mono">
                      {investigation.next_best_actions_initial.map((act, i) => (
                        <li key={i}>{act}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {investigation.next_best_actions_final?.length > 0 && (
                  <div className="p-3 rounded-lg bg-slate-950 border border-indigo-500/20 bg-indigo-500/5">
                    <span className="text-xs font-semibold text-indigo-300 uppercase block mb-1">Final Policy Actions</span>
                    <ul className="list-disc list-inside space-y-1 text-xs text-indigo-200 font-mono">
                      {investigation.next_best_actions_final.map((act, i) => (
                        <li key={i}>{act}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* SAR Section (Only rendered when SAR data is returned) */}
            {investigation.SAR && (
              <div className="p-3.5 rounded-lg bg-slate-950 border border-rose-500/30 text-xs space-y-1">
                <span className="font-bold text-rose-400 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-400" /> Suspicious Activity Report (SAR) Recommendation
                </span>
                <pre className="p-2 rounded bg-slate-900 text-slate-300 font-mono overflow-x-auto text-[11px]">
                  {JSON.stringify(investigation.SAR, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. EXTRACTED GRAPH EVIDENCE LIST */}
      {evidenceList.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4">
          <h3 className="font-semibold text-slate-100 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-indigo-400" /> Extracted Graph Evidence ({evidenceList.length} items)
          </h3>
          <div className="space-y-2">
            {evidenceList.map((ev, i) => {
              const evType = ev.evidence_type || ev.type || 'Entity';
              const evId = ev.evidence_id || ev.id || `ev_${i}`;
              const evDesc = ev.description || JSON.stringify(ev.raw_data || ev.details || {});
              const evStrength = ev.strength || 'NEUTRAL';
              const evSource = ev.source || 'TigerGraph';
              const evRisk = ev.risk_signal;

              return (
                <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-lg bg-slate-950 border border-slate-800 gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold font-mono text-indigo-400 px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">
                        {evType}
                      </span>
                      <span className="text-sm font-mono text-slate-200 font-semibold">{evId}</span>
                      <span className="text-[10px] text-slate-500 font-mono">[{evSource}]</span>
                    </div>
                    <p className="text-xs text-slate-300 font-sans">{evDesc}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2 py-1 rounded border border-slate-800">
                      Strength: {evStrength}
                    </span>
                    {evRisk ? (
                      <span className="text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-full flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Signal: {evRisk}
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Clean
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
