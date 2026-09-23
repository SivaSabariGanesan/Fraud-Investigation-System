import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ShieldAlert,
  Send,
  FileCheck,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Info,
  Lock,
} from 'lucide-react';
import { apiService } from '../services/api';
import { SarRecord, SarStatus } from '../types/investigation';
import { formatCurrency, formatDate } from '../lib/utils';

interface SarWorkflowPanelProps {
  caseId: string;
  investigationId?: string;
  onSarUpdated?: () => void;
}

const SAR_STATUS_CONFIG: Record<
  SarStatus,
  { label: string; bg: string; text: string; border: string; icon: React.FC<{ className?: string }> }
> = {
  NOT_RECOMMENDED: {
    label: 'NOT RECOMMENDED',
    bg: 'bg-slate-100 dark:bg-slate-800/80',
    text: 'text-slate-700 dark:text-slate-300',
    border: 'border-slate-300 dark:border-slate-700',
    icon: Info,
  },
  CANDIDATE: {
    label: 'SAR CANDIDATE',
    bg: 'bg-amber-50 dark:bg-amber-950/60',
    text: 'text-amber-800 dark:text-amber-200',
    border: 'border-amber-300 dark:border-amber-700',
    icon: AlertTriangle,
  },
  UNDER_REVIEW: {
    label: 'UNDER REVIEW',
    bg: 'bg-blue-50 dark:bg-blue-950/60',
    text: 'text-blue-800 dark:text-blue-200',
    border: 'border-blue-300 dark:border-blue-700',
    icon: Clock,
  },
  APPROVED: {
    label: 'APPROVED FOR FILING',
    bg: 'bg-emerald-50 dark:bg-emerald-950/60',
    text: 'text-emerald-800 dark:text-emerald-200',
    border: 'border-emerald-300 dark:border-emerald-700',
    icon: CheckCircle2,
  },
  NOT_FILED: {
    label: 'DECISION: DO NOT FILE',
    bg: 'bg-rose-50 dark:bg-rose-950/60',
    text: 'text-rose-800 dark:text-rose-200',
    border: 'border-rose-300 dark:border-rose-700',
    icon: XCircle,
  },
  PREPARED: {
    label: 'REPORT PREPARED',
    bg: 'bg-purple-50 dark:bg-purple-950/60',
    text: 'text-purple-800 dark:text-purple-200',
    border: 'border-purple-300 dark:border-purple-700',
    icon: FileCheck,
  },
  SUBMISSION_PENDING: {
    label: 'SUBMISSION PENDING',
    bg: 'bg-indigo-50 dark:bg-indigo-950/60',
    text: 'text-indigo-800 dark:text-indigo-200',
    border: 'border-indigo-300 dark:border-indigo-700',
    icon: Send,
  },
  FILED: {
    label: 'FILED',
    bg: 'bg-emerald-100 dark:bg-emerald-900',
    text: 'text-emerald-900 dark:text-emerald-100',
    border: 'border-emerald-400',
    icon: CheckCircle2,
  },
};

export const SarWorkflowPanel: React.FC<SarWorkflowPanelProps> = ({ caseId, onSarUpdated }) => {
  const [sarRecord, setSarRecord] = useState<SarRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [analystNotes, setAnalystNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showEvidenceDetails, setShowEvidenceDetails] = useState(false);

  const fetchSar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getCaseSar(caseId);
      setSarRecord(data);
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setSarRecord(null);
      } else {
        setError(err?.response?.data?.detail || err?.message || 'Failed to load SAR workflow data.');
      }
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchSar();
  }, [fetchSar]);

  // Review action
  const handleReview = async (decision: 'approve' | 'do_not_file') => {
    setSubmitting(true);
    setActionError(null);
    try {
      const updated = await apiService.reviewCaseSar(caseId, {
        decision,
        analyst_notes: analystNotes || undefined,
        reviewer_id: 'ANALYST',
      });
      setSarRecord(updated);
      setAnalystNotes('');
      if (onSarUpdated) onSarUpdated();
    } catch (err: any) {
      setActionError(err?.response?.data?.detail || err?.message || 'Failed to record SAR review.');
    } finally {
      setSubmitting(false);
    }
  };

  // Prepare report action
  const handlePrepare = async () => {
    setSubmitting(true);
    setActionError(null);
    try {
      const updated = await apiService.prepareCaseSar(caseId, {
        notes: analystNotes || undefined,
        actor: 'ANALYST',
      });
      setSarRecord(updated);
      if (onSarUpdated) onSarUpdated();
    } catch (err: any) {
      setActionError(err?.response?.data?.detail || err?.message || 'Failed to prepare SAR report.');
    } finally {
      setSubmitting(false);
    }
  };

  // Submission tracking update
  const handleSubmissionTracking = async () => {
    setSubmitting(true);
    setActionError(null);
    try {
      const updated = await apiService.updateCaseSarSubmission(caseId, {
        status: 'SUBMISSION_PENDING',
        actor: 'ANALYST',
      });
      setSarRecord(updated);
      if (onSarUpdated) onSarUpdated();
    } catch (err: any) {
      setActionError(err?.response?.data?.detail || err?.message || 'Failed to update submission status.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="card p-6 flex flex-col items-center justify-center gap-2 text-slate-500 font-mono text-xs">
        <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
        <span>Loading SAR Workflow Record…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-4 border-red-200 bg-red-50/50 dark:bg-red-950/20 text-xs">
        <div className="flex items-center gap-2 text-red-800 dark:text-red-300 font-semibold mb-1">
          <ShieldAlert className="w-4 h-4 text-red-600" />
          <span>SAR Workflow Error</span>
        </div>
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (!sarRecord) {
    return (
      <div className="card p-6 text-center text-xs text-slate-500 font-mono">
        No SAR evaluation available for case <span className="font-semibold text-slate-700">{caseId}</span>. Run an investigation to trigger deterministic policy evaluation.
      </div>
    );
  }

  const statusCfg = SAR_STATUS_CONFIG[sarRecord.status] || SAR_STATUS_CONFIG.NOT_RECOMMENDED;
  const StatusIcon = statusCfg.icon;

  return (
    <div className="card p-4 space-y-4 text-xs font-sans">
      {/* Top Header & Status Badge */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-600" />
          <div>
            <h3 className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm tracking-tight">
              SUSPICIOUS ACTIVITY REPORT (SAR) WORKFLOW
            </h3>
            <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500 mt-0.5">
              <span>SAR ID: <strong className="text-slate-800 dark:text-slate-200">{sarRecord.sar_id}</strong></span>
              <span>·</span>
              <span>Inv ID: <strong className="text-slate-800 dark:text-slate-200">{sarRecord.investigation_id}</strong></span>
            </div>
          </div>
        </div>

        <div className={`px-2.5 py-1 rounded border flex items-center gap-1.5 font-mono text-xs font-bold ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}>
          <StatusIcon className="w-3.5 h-3.5" />
          <span>{statusCfg.label}</span>
        </div>
      </div>

      {/* Action Error Alert */}
      {actionError && (
        <div className="p-2.5 rounded bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
      )}

      {/* Eligibility & Summary Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-3 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
          <span className="text-[10px] font-mono font-semibold uppercase text-slate-400">Deterministic Eligibility</span>
          <div className="flex items-center gap-1.5 font-mono font-bold text-xs">
            <span className={sarRecord.eligibility === 'ELIGIBLE' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'}>
              {sarRecord.eligibility}
            </span>
          </div>
        </div>

        <div className="p-3 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
          <span className="text-[10px] font-mono font-semibold uppercase text-slate-400">Financial Exposure</span>
          <p className="font-mono font-bold text-xs text-slate-900 dark:text-slate-100">
            {formatCurrency(sarRecord.exposure_usd || 0)}
          </p>
        </div>

        <div className="p-3 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
          <span className="text-[10px] font-mono font-semibold uppercase text-slate-400">Timestamps</span>
          <p className="font-mono text-[11px] text-slate-600 dark:text-slate-400">
            Created: {formatDate(sarRecord.created_at)}
          </p>
        </div>
      </div>

      {/* Reason Box */}
      <div className="p-3 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
        <span className="text-[10px] font-mono font-semibold uppercase text-slate-400">Policy Eligibility Rationale</span>
        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
          {sarRecord.eligibility_reason || 'No detailed policy rationale recorded.'}
        </p>
      </div>

      {/* Grounded Evidence Breakdown Toggle */}
      <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
        <button
          onClick={() => setShowEvidenceDetails(!showEvidenceDetails)}
          className="flex items-center justify-between w-full text-xs font-mono font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 transition"
        >
          <span>GROUNDED EVIDENCE & ENTITIES ({sarRecord.supporting_evidence?.length || 0} items)</span>
          {showEvidenceDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showEvidenceDetails && (
          <div className="mt-3 space-y-3">
            {/* Involved Entities */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
              <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800">
                <span className="text-[9px] text-slate-400 block">TRANSACTIONS</span>
                <span className="text-slate-800 dark:text-slate-200">{sarRecord.related_transaction_ids?.join(', ') || 'None'}</span>
              </div>
              <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800">
                <span className="text-[9px] text-slate-400 block">CARDS</span>
                <span className="text-slate-800 dark:text-slate-200">{sarRecord.related_card_ids?.join(', ') || 'None'}</span>
              </div>
              <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800">
                <span className="text-[9px] text-slate-400 block">DEVICES</span>
                <span className="text-slate-800 dark:text-slate-200">{sarRecord.related_device_ids?.join(', ') || 'None'}</span>
              </div>
              <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800">
                <span className="text-[9px] text-slate-400 block">REGIONS</span>
                <span className="text-slate-800 dark:text-slate-200">{sarRecord.related_regions?.join(', ') || 'None'}</span>
              </div>
            </div>

            {/* Policy Rules */}
            {sarRecord.policy_rules && sarRecord.policy_rules.length > 0 && (
              <div className="space-y-1">
                <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase">Evaluated Policy Rules</span>
                <div className="flex flex-wrap gap-1.5">
                  {sarRecord.policy_rules.map((r, i) => (
                    <span
                      key={i}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                        r.triggered
                          ? 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-200'
                          : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {r.rule_id}: {r.triggered ? 'TRIGGERED' : 'PASSED'}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* WORKFLOW ACTION SECTION BASED ON STATUS */}

      {/* 1. CANDIDATE / UNDER_REVIEW Action Box */}
      {(sarRecord.status === 'CANDIDATE' || sarRecord.status === 'UNDER_REVIEW') && (
        <div className="p-4 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 space-y-3">
          <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-mono font-bold text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>ANALYST SAR REVIEW ACTION REQUIRED</span>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300">
            This investigation is flagged as an eligible SAR candidate. Review the evidence and record your decision below.
          </p>

          <div className="space-y-2">
            <label className="text-[10px] font-mono font-semibold text-slate-500 uppercase block">
              Analyst Review Notes (Required for Do Not File)
            </label>
            <textarea
              rows={2}
              placeholder="Enter compliance review justification..."
              value={analystNotes}
              onChange={(e) => setAnalystNotes(e.target.value)}
              className="input-base w-full p-2"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => handleReview('approve')}
              disabled={submitting}
              className="btn btn-primary bg-emerald-600 hover:bg-emerald-700 border-emerald-700 text-white"
            >
              {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Approve for SAR Filing
            </button>

            <button
              onClick={() => handleReview('do_not_file')}
              disabled={submitting}
              className="btn btn-ghost text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700"
            >
              {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
              Decision: Do Not File
            </button>
          </div>
        </div>
      )}

      {/* 2. APPROVED Action Box */}
      {sarRecord.status === 'APPROVED' && (
        <div className="p-4 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 space-y-3">
          <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200 font-mono font-bold text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>SAR APPROVED BY ANALYST</span>
          </div>

          {sarRecord.analyst_notes && (
            <p className="text-xs text-slate-700 dark:text-slate-300 italic bg-white dark:bg-slate-900 p-2.5 rounded border border-emerald-200 dark:border-emerald-900/40">
              Analyst Notes: "{sarRecord.analyst_notes}"
            </p>
          )}

          <button
            onClick={handlePrepare}
            disabled={submitting}
            className="btn btn-primary bg-blue-600 hover:bg-blue-700"
          >
            {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileCheck className="w-3.5 h-3.5" />}
            Prepare Internal SAR Report Draft
          </button>
        </div>
      )}

      {/* 3. PREPARED / SUBMISSION_PENDING Action & Notice Box */}
      {(sarRecord.status === 'PREPARED' || sarRecord.status === 'SUBMISSION_PENDING') && (
        <div className="p-4 rounded-lg bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/50 space-y-3">
          <div className="flex items-center gap-2 text-purple-900 dark:text-purple-200 font-mono font-bold text-xs">
            <FileCheck className="w-4 h-4 text-purple-600" />
            <span>INTERNAL SAR REPORT DRAFT PREPARED</span>
            {sarRecord.report_reference && (
              <span className="ml-auto font-mono text-[10px] px-2 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 font-semibold">
                Ref: {sarRecord.report_reference}
              </span>
            )}
          </div>

          {/* External Filing Unconfigured Notice Banner */}
          <div className="p-3 rounded bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 border border-amber-200 dark:border-amber-800 text-xs flex items-start gap-2">
            <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block mb-0.5">External Filing Integration Not Configured</span>
              <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
                This environment tracks internal SAR preparation only. No fake regulator submissions are performed.
              </p>
            </div>
          </div>

          {/* Structured Report Draft JSON Preview */}
          {sarRecord.report_draft_json && (
            <div className="space-y-1">
              <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase">Prepared Report Summary</span>
              <pre className="p-3 rounded bg-slate-900 text-slate-100 text-[10px] font-mono overflow-x-auto max-h-44">
                {JSON.stringify(sarRecord.report_draft_json, null, 2)}
              </pre>
            </div>
          )}

          {sarRecord.status === 'PREPARED' && (
            <button
              onClick={handleSubmissionTracking}
              disabled={submitting}
              className="btn btn-ghost border-purple-300 text-purple-900 dark:text-purple-200"
            >
              {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Track Internal Submission Pending
            </button>
          )}
        </div>
      )}

      {/* 4. NOT_FILED Box */}
      {sarRecord.status === 'NOT_FILED' && (
        <div className="p-3.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-mono font-bold text-xs">
            <XCircle className="w-4 h-4 text-slate-500" />
            <span>ANALYST DECISION: DO NOT FILE</span>
          </div>

          {sarRecord.analyst_notes && (
            <p className="text-xs text-slate-600 dark:text-slate-400 italic">
              Review Notes: "{sarRecord.analyst_notes}"
            </p>
          )}
          <span className="text-[10px] text-slate-400 font-mono block">
            Reviewed At: {sarRecord.reviewed_at ? formatDate(sarRecord.reviewed_at) : 'Recorded'}
          </span>
        </div>
      )}
    </div>
  );
};
