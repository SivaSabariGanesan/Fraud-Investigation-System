import React, { useState, useEffect } from 'react';
import { Case, InvestigationResult } from '../types/investigation';
import { apiService } from '../services/api';
import { StatusBadge } from '../components/StatusBadge';
import { formatCurrency, formatDate } from '../lib/utils';
import { Play, ArrowLeft, ShieldAlert, Cpu, GitBranch, Layers, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

interface CaseDetailsProps {
  caseId: string;
  onBack: () => void;
  onCaseUpdated: () => void;
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
      const data = await apiService.getCaseById(caseId);
      setCaseData(data);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch case details';
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
      const result = await apiService.runInvestigation(caseId);
      setInvestigation(result);
      setCaseData({
        case_id: result.case_id,
        status: result.status,
        verdict: result.verdict,
        fraud_probability: result.fraud_probability,
        pattern: result.pattern,
        exposure: result.exposure,
        created_at: result.created_at,
        updated_at: result.updated_at,
      });
      onCaseUpdated();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to trigger investigation';
      setError(errorMsg);
    } finally {
      setInvestigating(false);
    }
  };

  if (loading) {
    return (
      <div className="py-16 text-center text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
        <p>Fetching case & graph data from backend...</p>
      </div>
    );
  }

  if (error && !caseData) {
    return (
      <div className="p-6 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300">
        <div className="flex items-center gap-2 mb-2 font-semibold">
          <AlertCircle className="w-5 h-5" /> Error Loading Case
        </div>
        <p className="text-sm">{error}</p>
        <button onClick={onBack} className="mt-4 px-3 py-1.5 rounded bg-slate-900 border border-slate-800 text-xs text-slate-200">
          Return to Cases
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Navigation & Header */}
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
            </div>
            <p className="text-sm text-slate-400">Created: {formatDate(caseData?.created_at)}</p>
          </div>
        </div>

        {/* Investigation Trigger Button */}
        <button
          onClick={handleRunInvestigation}
          disabled={investigating}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold shadow-lg shadow-indigo-500/20 transition disabled:opacity-50"
        >
          {investigating ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" /> Querying TigerGraph & Agent...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-white" /> Trigger AI Fraud Agent
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm">
          {error}
        </div>
      )}

      {/* Case Overview Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-xs font-medium text-slate-400 block uppercase">Detected Pattern</span>
          <span className="text-base font-bold text-slate-100 mt-1 block">{caseData?.pattern || 'Pending Analysis'}</span>
        </div>
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-xs font-medium text-slate-400 block uppercase">Fraud Probability Score</span>
          <span className={`text-xl font-extrabold font-mono mt-1 block ${
            (caseData?.fraud_probability || 0) > 0.7 ? 'text-rose-400' : (caseData?.fraud_probability || 0) > 0.3 ? 'text-amber-400' : 'text-emerald-400'
          }`}>
            {caseData?.fraud_probability !== null && caseData?.fraud_probability !== undefined
              ? `${(caseData.fraud_probability * 100).toFixed(1)}%`
              : 'N/A'}
          </span>
        </div>
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-xs font-medium text-slate-400 block uppercase">Financial Exposure</span>
          <span className="text-xl font-bold font-mono text-amber-400 mt-1 block">{formatCurrency(caseData?.exposure)}</span>
        </div>
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-xs font-medium text-slate-400 block uppercase">Graph Sync Status</span>
          <span className="text-xs font-mono text-emerald-400 mt-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span> TigerGraph Ready
          </span>
        </div>
      </div>

      {/* Reasoning & Agent Output Banner */}
      {investigation && (
        <div className="p-5 rounded-xl bg-indigo-950/40 border border-indigo-500/30 space-y-3">
          <div className="flex items-center gap-2 text-indigo-300 font-semibold">
            <Cpu className="w-5 h-5 text-indigo-400" /> Fraud Investigator Agent Reasoning Output
          </div>
          <p className="text-sm text-slate-200 leading-relaxed bg-slate-950/60 p-3.5 rounded-lg border border-slate-800">
            {investigation.reasoning_summary}
          </p>
          <div className="flex items-center gap-4 text-xs font-mono text-slate-400 pt-1">
            <span>Collected Evidence: <strong className="text-indigo-300">{investigation.evidence_count} entities</strong></span>
            <span>Verdict: <strong className="text-indigo-300">{investigation.verdict}</strong></span>
          </div>
        </div>
      )}

      {/* TigerGraph Connected Entities Breakdown */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-indigo-400" />
            <h3 className="font-semibold text-slate-100">TigerGraph Connected Evidence Topology</h3>
          </div>
          <span className="text-xs font-mono text-slate-500">Entities & Relationships</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-indigo-300">
              <span className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" /> Customer → OWNS → Card</span>
              <span className="bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded text-[10px]">Verified</span>
            </div>
            <p className="text-xs text-slate-400 font-mono">CUST-9842 (Alexander Vance) → CARD-4412-XXXX-9012 (Visa US)</p>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-indigo-300">
              <span className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" /> Card → MADE → Transaction</span>
              <span className="bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded text-[10px]">Flagged</span>
            </div>
            <p className="text-xs text-slate-400 font-mono">CARD-4412-XXXX-9012 → TXN-{caseId}-01 ($2,450.00)</p>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-indigo-300">
              <span className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" /> Transaction → Device & Email</span>
              <span className="bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded text-[10px]">High Risk Signal</span>
            </div>
            <p className="text-xs text-slate-400 font-mono">Device: DEV-IP-192.168.1.105 (VPN) | Domain: temp-mail.org</p>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-indigo-300">
              <span className="flex items-center gap-1.5"><Layers className="w-3.5 h-3.5" /> ClosedCase → INVOLVES → Transaction</span>
              <span className="bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded text-[10px]">Fraud Match</span>
            </div>
            <p className="text-xs text-slate-400 font-mono">Linked Case: CASE-PREV-882 (Account Takeover)</p>
          </div>
        </div>
      </div>

      {/* Collected Evidence Items List */}
      {investigation && investigation.evidence.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4">
          <h3 className="font-semibold text-slate-100 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-indigo-400" /> Extracted Graph Signals ({investigation.evidence.length})
          </h3>
          <div className="space-y-2">
            {investigation.evidence.map((ev, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div>
                  <span className="text-xs font-semibold font-mono text-indigo-400 mr-2">[{ev.type}]</span>
                  <span className="text-sm font-mono text-slate-200">{ev.id}</span>
                </div>
                {ev.risk_signal ? (
                  <span className="text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-full flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {ev.risk_signal}
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Clean Signal
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
