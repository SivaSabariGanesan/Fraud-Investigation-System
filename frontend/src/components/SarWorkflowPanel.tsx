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
  { label: string; bg: string; text: string; border: string; icon: React.FC<{ className?: string; style?: React.CSSProperties }> }
> = {
  NOT_RECOMMENDED: {
    label: 'NOT RECOMMENDED',
    bg: 'var(--bg-overlay)',
    text: 'var(--text-secondary)',
    border: 'var(--border-default)',
    icon: Info,
  },
  CANDIDATE: {
    label: 'SAR CANDIDATE',
    bg: 'var(--warn-subtle)',
    text: 'var(--warn-text)',
    border: 'var(--warn-border)',
    icon: AlertTriangle,
  },
  UNDER_REVIEW: {
    label: 'UNDER REVIEW',
    bg: 'var(--accent-subtle)',
    text: 'var(--accent-text)',
    border: 'var(--accent-border)',
    icon: Clock,
  },
  APPROVED: {
    label: 'APPROVED FOR FILING',
    bg: 'var(--success-subtle)',
    text: 'var(--success-text)',
    border: 'var(--success-border)',
    icon: CheckCircle2,
  },
  NOT_FILED: {
    label: 'DECISION: DO NOT FILE',
    bg: 'var(--danger-subtle)',
    text: 'var(--danger-text)',
    border: 'var(--danger-border)',
    icon: XCircle,
  },
  PREPARED: {
    label: 'REPORT PREPARED',
    bg: 'rgba(124, 58, 237, 0.08)',
    text: '#7c3aed',
    border: 'rgba(124, 58, 237, 0.25)',
    icon: FileCheck,
  },
  SUBMISSION_PENDING: {
    label: 'SUBMISSION PENDING',
    bg: 'var(--warn-subtle)',
    text: 'var(--warn-text)',
    border: 'var(--warn-border)',
    icon: Send,
  },
  FILED: {
    label: 'FILED',
    bg: 'var(--success-subtle)',
    text: 'var(--success-text)',
    border: 'var(--success-border)',
    icon: CheckCircle2,
  },
};

const boxStyle: React.CSSProperties = {
  padding: '10px 12px',
  background: 'var(--bg-raised)',
  border: '1px solid var(--border-default)',
  borderRadius: 5,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const boxLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontFamily: 'monospace',
  fontWeight: 600,
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  letterSpacing: '0.07em',
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
      <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 12 }}>
        <RefreshCw className="w-4 h-4 animate-spin" style={{ color: 'var(--accent-text)' }} />
        <span>Loading SAR Workflow Record…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '12px 14px', background: 'var(--danger-subtle)', border: '1px solid var(--danger-border)', borderRadius: 6, fontSize: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger-text)', fontWeight: 600, marginBottom: 4 }}>
          <ShieldAlert className="w-4 h-4" />
          <span>SAR Workflow Error</span>
        </div>
        <p style={{ margin: 0, color: 'var(--danger-text)' }}>{error}</p>
      </div>
    );
  }

  if (!sarRecord) {
    return (
      <div className="card" style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
        No SAR evaluation available for case <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{caseId}</span>. Run an investigation to trigger deterministic policy evaluation.
      </div>
    );
  }

  const statusCfg = SAR_STATUS_CONFIG[sarRecord.status] || SAR_STATUS_CONFIG.NOT_RECOMMENDED;
  const StatusIcon = statusCfg.icon;

  return (
    <div className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Top Header & Status Badge */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingBottom: 12, borderBottom: '1px solid var(--border-default)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FileText className="w-4 h-4" style={{ color: 'var(--accent-text)' }} />
          <div>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              SUSPICIOUS ACTIVITY REPORT (SAR) WORKFLOW
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)', marginTop: 2 }}>
              <span>SAR ID: <strong style={{ color: 'var(--text-primary)' }}>{sarRecord.sar_id}</strong></span>
              <span>·</span>
              <span>Inv ID: <strong style={{ color: 'var(--text-primary)' }}>{sarRecord.investigation_id}</strong></span>
            </div>
          </div>
        </div>

        <div className="pill" style={{ background: statusCfg.bg, color: statusCfg.text, borderColor: statusCfg.border, fontWeight: 700 }}>
          <StatusIcon className="w-3.5 h-3.5" />
          <span>{statusCfg.label}</span>
        </div>
      </div>

      {/* Action Error Alert */}
      {actionError && (
        <div style={{ padding: '8px 12px', borderRadius: 5, background: 'var(--danger-subtle)', border: '1px solid var(--danger-border)', color: 'var(--danger-text)', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
        </div>
      )}

      {/* Eligibility & Summary Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        <div style={boxStyle}>
          <span style={boxLabelStyle}>Deterministic Eligibility</span>
          <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: sarRecord.eligibility === 'ELIGIBLE' ? 'var(--success-text)' : 'var(--text-primary)' }}>
            {sarRecord.eligibility}
          </span>
        </div>

        <div style={boxStyle}>
          <span style={boxLabelStyle}>Financial Exposure</span>
          <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-primary)' }}>
            {formatCurrency(sarRecord.exposure_usd || 0)}
          </span>
        </div>

        <div style={boxStyle}>
          <span style={boxLabelStyle}>Timestamps</span>
          <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
            Created: {formatDate(sarRecord.created_at)}
          </span>
        </div>
      </div>

      {/* Reason Box */}
      <div style={boxStyle}>
        <span style={boxLabelStyle}>Policy Eligibility Rationale</span>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {sarRecord.eligibility_reason || 'No detailed policy rationale recorded.'}
        </p>
      </div>

      {/* Grounded Evidence Breakdown Toggle */}
      <div style={{ paddingTop: 6, borderTop: '1px solid var(--border-default)' }}>
        <button
          onClick={() => setShowEvidenceDetails(!showEvidenceDetails)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            fontSize: 11,
            fontFamily: 'monospace',
            fontWeight: 600,
            color: 'var(--text-muted)',
          }}
        >
          <span>GROUNDED EVIDENCE & ENTITIES ({sarRecord.supporting_evidence?.length || 0} items)</span>
          {showEvidenceDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showEvidenceDetails && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
            {/* Involved Entities */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {[
                ['TRANSACTIONS', sarRecord.related_transaction_ids?.join(', ') || 'None'],
                ['CARDS', sarRecord.related_card_ids?.join(', ') || 'None'],
                ['DEVICES', sarRecord.related_device_ids?.join(', ') || 'None'],
                ['REGIONS', sarRecord.related_regions?.join(', ') || 'None'],
              ].map(([lbl, val]) => (
                <div key={lbl} style={{ padding: '7px 9px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4 }}>
                  <span style={{ fontSize: 9, fontFamily: 'monospace', color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>{lbl}</span>
                  <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-primary)' }}>{val}</span>
                </div>
              ))}
            </div>

            {/* Policy Rules */}
            {sarRecord.policy_rules && sarRecord.policy_rules.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={boxLabelStyle}>Evaluated Policy Rules</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {sarRecord.policy_rules.map((r, i) => (
                    <span
                      key={i}
                      className="pill"
                      style={r.triggered
                        ? { background: 'var(--warn-subtle)', color: 'var(--warn-text)', borderColor: 'var(--warn-border)', fontSize: 10 }
                        : { background: 'var(--bg-overlay)', color: 'var(--text-muted)', borderColor: 'var(--border-default)', fontSize: 10 }
                      }
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
        <div style={{ padding: 14, borderRadius: 6, background: 'var(--warn-subtle)', border: '1px solid var(--warn-border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--warn-text)', fontFamily: 'monospace', fontWeight: 700, fontSize: 12 }}>
            <AlertTriangle className="w-4 h-4" />
            <span>ANALYST SAR REVIEW ACTION REQUIRED</span>
          </div>

          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
            This investigation is flagged as an eligible SAR candidate. Review the evidence and record your decision below.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={boxLabelStyle}>
              Analyst Review Notes (Required for Do Not File)
            </label>
            <textarea
              rows={2}
              placeholder="Enter compliance review justification..."
              value={analystNotes}
              onChange={(e) => setAnalystNotes(e.target.value)}
              className="input-base"
              style={{ width: '100%', padding: '6px 10px', resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 4 }}>
            <button
              onClick={() => handleReview('approve')}
              disabled={submitting}
              className="btn btn-primary"
              style={{ background: 'var(--success)', borderColor: 'var(--success-text)' }}
            >
              {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Approve for SAR Filing
            </button>

            <button
              onClick={() => handleReview('do_not_file')}
              disabled={submitting}
              className="btn btn-ghost"
            >
              {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
              Decision: Do Not File
            </button>
          </div>
        </div>
      )}

      {/* 2. APPROVED Action Box */}
      {sarRecord.status === 'APPROVED' && (
        <div style={{ padding: 14, borderRadius: 6, background: 'var(--success-subtle)', border: '1px solid var(--success-border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--success-text)', fontFamily: 'monospace', fontWeight: 700, fontSize: 12 }}>
            <CheckCircle2 className="w-4 h-4" />
            <span>SAR APPROVED BY ANALYST</span>
          </div>

          {sarRecord.analyst_notes && (
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic', background: 'var(--bg-base)', padding: '8px 10px', borderRadius: 4, border: '1px solid var(--success-border)' }}>
              Analyst Notes: "{sarRecord.analyst_notes}"
            </p>
          )}

          <button
            onClick={handlePrepare}
            disabled={submitting}
            className="btn btn-primary"
          >
            {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileCheck className="w-3.5 h-3.5" />}
            Prepare Internal SAR Report Draft
          </button>
        </div>
      )}

      {/* 3. PREPARED / SUBMISSION_PENDING Action & Notice Box */}
      {(sarRecord.status === 'PREPARED' || sarRecord.status === 'SUBMISSION_PENDING') && (
        <div style={{ padding: 14, borderRadius: 6, background: 'rgba(124, 58, 237, 0.06)', border: '1px solid rgba(124, 58, 237, 0.25)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#7c3aed', fontFamily: 'monospace', fontWeight: 700, fontSize: 12 }}>
            <FileCheck className="w-4 h-4" />
            <span>INTERNAL SAR REPORT DRAFT PREPARED</span>
            {sarRecord.report_reference && (
              <span style={{ marginLeft: 'auto', fontFamily: 'monospace', fontSize: 10, padding: '2px 6px', borderRadius: 3, background: 'rgba(124, 58, 237, 0.12)', color: '#7c3aed', fontWeight: 600 }}>
                Ref: {sarRecord.report_reference}
              </span>
            )}
          </div>

          {/* External Filing Unconfigured Notice Banner */}
          <div style={{ padding: '10px 12px', borderRadius: 5, background: 'var(--warn-subtle)', border: '1px solid var(--warn-border)', color: 'var(--warn-text)', fontSize: 12, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <Lock className="w-4 h-4" style={{ flexShrink: 0, marginTop: 2, color: 'var(--warn)' }} />
            <div>
              <span style={{ fontWeight: 600, display: 'block', marginBottom: 2 }}>External Filing Integration Not Configured</span>
              <p style={{ margin: 0, fontSize: 11, lineHeight: 1.45, color: 'var(--warn-text)' }}>
                This environment tracks internal SAR preparation only. No fake regulator submissions are performed.
              </p>
            </div>
          </div>

          {/* Structured Report Draft JSON Preview */}
          {sarRecord.report_draft_json && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={boxLabelStyle}>Prepared Report Summary</span>
              <pre style={{ margin: 0, padding: 10, borderRadius: 5, background: '#111827', color: '#f9fafb', fontSize: 10, fontFamily: 'monospace', overflowX: 'auto', maxHeight: 180 }}>
                {JSON.stringify(sarRecord.report_draft_json, null, 2)}
              </pre>
            </div>
          )}

          {sarRecord.status === 'PREPARED' && (
            <button
              onClick={handleSubmissionTracking}
              disabled={submitting}
              className="btn btn-ghost"
              style={{ borderColor: 'rgba(124, 58, 237, 0.3)', color: '#7c3aed' }}
            >
              {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Track Internal Submission Pending
            </button>
          )}
        </div>
      )}

      {/* 4. NOT_FILED Box */}
      {sarRecord.status === 'NOT_FILED' && (
        <div style={{ padding: '12px 14px', borderRadius: 6, background: 'var(--bg-raised)', border: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontFamily: 'monospace', fontWeight: 700, fontSize: 12 }}>
            <XCircle className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <span>ANALYST DECISION: DO NOT FILE</span>
          </div>

          {sarRecord.analyst_notes && (
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
              Review Notes: "{sarRecord.analyst_notes}"
            </p>
          )}
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace', display: 'block' }}>
            Reviewed At: {sarRecord.reviewed_at ? formatDate(sarRecord.reviewed_at) : 'Recorded'}
          </span>
        </div>
      )}
    </div>
  );
};
