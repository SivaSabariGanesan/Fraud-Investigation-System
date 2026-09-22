import React, { useEffect, useState } from 'react';
import { apiService } from '../services/api';
import { InvestigationDetailResponse } from '../types/investigation';
import { StatusBadge } from './StatusBadge';
import { AuditTimeline } from './AuditTimeline';
import { formatDate } from '../lib/utils';
import { X, Clock, Cpu, Scale, BrainCircuit, Database, ShieldAlert, ListChecks } from 'lucide-react';

interface InvestigationHistoryModalProps {
  investigationId: string | null;
  onClose: () => void;
}

const S = {
  card: {
    background: 'var(--bg-raised)',
    border: '1px solid var(--border-default)',
    borderRadius: 6,
    padding: '12px 14px',
  } as React.CSSProperties,
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.07em',
    textTransform: 'uppercase' as const,
    marginBottom: 10,
  },
  label: { fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase' as const, color: 'var(--text-muted)', marginBottom: 4 },
  value: { fontSize: 13, fontFamily: 'monospace', fontWeight: 500, color: 'var(--text-primary)' },
};

export const InvestigationHistoryModal: React.FC<InvestigationHistoryModalProps> = ({
  investigationId,
  onClose,
}) => {
  const [detail, setDetail] = useState<InvestigationDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!investigationId) return;
    setLoading(true);
    setError(null);
    apiService
      .getInvestigation(investigationId)
      .then((data) => { setDetail(data); setLoading(false); })
      .catch((err) => { setError(err.message || 'Failed to load snapshot'); setLoading(false); });
  }, [investigationId]);

  if (!investigationId) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 860,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-strong)',
          borderRadius: 8,
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: '1px solid var(--border-default)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                {investigationId}
              </span>
              {detail && <StatusBadge verdict={detail.verdict} status={detail.status || detail.case_status} showVerdict />}
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Investigation Snapshot — Immutable Record</span>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost"
            style={{ padding: '5px 8px' }}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '60px 0', color: 'var(--text-muted)' }}>
              <Clock className="w-6 h-6 animate-spin" style={{ color: 'var(--accent-text)' }} />
              <span style={{ fontSize: 12 }}>Loading snapshot…</span>
            </div>
          )}
          {error && (
            <div style={{ padding: '10px 14px', background: 'var(--danger-subtle)', border: '1px solid var(--danger-border)', borderRadius: 6, fontSize: 12, color: 'var(--danger-text)' }}>
              {error}
            </div>
          )}
          {detail && !loading && (
            <>
              {/* Metadata grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                {[
                  { label: 'Customer', value: detail.customer_id || '—' },
                  { label: 'Stop Reason', value: detail.stop_reason || 'COMPLETE', color: 'var(--warn-text)' },
                  { label: 'Exposure', value: `$${(detail.exposure ?? 0).toFixed(2)}` },
                  { label: 'Run Date', value: formatDate(detail.created_at) },
                ].map(({ label, value, color }) => (
                  <div key={label} style={S.card}>
                    <p style={S.label}>{label}</p>
                    <p style={{ ...S.value, color: color || 'var(--text-primary)', fontSize: 12 }}>{value}</p>
                  </div>
                ))}
              </div>

              {/* LLM metrics */}
              <div style={{ ...S.card, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ ...S.sectionHeader, color: '#c4b5fd' }}>
                  <Cpu className="w-3.5 h-3.5" /> Model Performance
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
                  {[
                    ['Provider', detail.llm_provider || 'groq'],
                    ['Model', detail.llm_model || 'openai/gpt-oss-120b'],
                    ['Prompt Tokens', String(detail.prompt_tokens ?? 0)],
                    ['Total Tokens', String(detail.total_tokens ?? 0)],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <p style={S.label}>{k}</p>
                      <p style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{v}</p>
                    </div>
                  ))}
                </div>
                {detail.llm_latency != null && (
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    Latency: <strong style={{ color: 'var(--text-secondary)' }}>{detail.llm_latency.toFixed(2)}s</strong>
                  </p>
                )}
              </div>

              {/* Reasoning */}
              {detail.reasoning_summary && (
                <div style={{ ...S.card }}>
                  <div style={{ ...S.sectionHeader, color: '#7dd3fc' }}>
                    <BrainCircuit className="w-3.5 h-3.5" /> AI Reasoning Summary
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                    {detail.reasoning_summary}
                  </p>
                </div>
              )}

              {/* Rules */}
              <div style={S.card}>
                <div style={{ ...S.sectionHeader, color: 'var(--accent-text)' }}>
                  <Scale className="w-3.5 h-3.5" /> Policy Rule Evaluation (R1–R10)
                </div>
                {detail.rules && detail.rules.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {detail.rules.map((r) => (
                      <div
                        key={r.rule_id}
                        style={{
                          padding: '8px 10px',
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
                          <p style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 2px' }}>
                            {r.rule_id}
                          </p>
                          {r.reason && (
                            <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: 0 }}>{r.reason}</p>
                          )}
                        </div>
                        <span
                          className="pill"
                          style={r.triggered
                            ? { background: 'var(--warn-subtle)', color: 'var(--warn-text)', borderColor: 'var(--warn-border)', fontSize: 10 }
                            : { background: 'var(--bg-overlay)', color: 'var(--text-muted)', borderColor: 'var(--border-default)', fontSize: 10 }
                          }
                        >
                          {r.triggered ? 'TRIGGERED' : 'PASS'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>No rule records.</p>
                )}
              </div>

              {/* Actions */}
              {detail.actions_final && detail.actions_final.length > 0 && (
                <div style={S.card}>
                  <div style={{ ...S.sectionHeader, color: 'var(--success-text)' }}>
                    <ListChecks className="w-3.5 h-3.5" /> Recommended Actions
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {detail.actions_final.map((a, i) => (
                      <span key={i} className="pill" style={{ background: 'var(--success-subtle)', color: 'var(--success-text)', borderColor: 'var(--success-border)', fontFamily: 'monospace', fontSize: 10 }}>
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* SAR */}
              <div style={S.card}>
                <div style={{ ...S.sectionHeader, color: 'var(--danger-text)' }}>
                  <ShieldAlert className="w-3.5 h-3.5" /> SAR State
                </div>
                <p style={{ fontSize: 12, margin: '0 0 4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Status: </span>
                  <span style={{ fontFamily: 'monospace', color: 'var(--warn-text)' }}>{detail.sar_status || 'NOT_RECOMMENDED'}</span>
                </p>
                {detail.sar_reason && (
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>{detail.sar_reason}</p>
                )}
              </div>

              {/* Evidence snapshot */}
              <div style={S.card}>
                <div style={{ ...S.sectionHeader, color: '#7dd3fc' }}>
                  <Database className="w-3.5 h-3.5" /> Evidence Snapshot ({detail.evidence?.length ?? 0})
                </div>
                <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {detail.evidence && detail.evidence.length > 0 ? (
                    detail.evidence.map((ev, i) => (
                      <div key={i} style={{ padding: '7px 10px', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 4 }}>
                        <p style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 2px' }}>
                          [{ev.evidence_type || 'Evidence'}] {ev.evidence_id}
                        </p>
                        {ev.description && <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>{ev.description}</p>}
                      </div>
                    ))
                  ) : (
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>No evidence items.</p>
                  )}
                </div>
              </div>

              {/* Audit log */}
              {detail.audit_events && detail.audit_events.length > 0 && (
                <div style={S.card}>
                  <div style={{ ...S.sectionHeader, color: 'var(--text-secondary)' }}>
                    <Clock className="w-3.5 h-3.5" style={{ color: 'var(--accent-text)' }} /> Run Audit Log
                  </div>
                  <AuditTimeline events={detail.audit_events} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
