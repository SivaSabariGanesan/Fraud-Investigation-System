import React, { useEffect, useState } from 'react';
import { apiService } from '../services/api';
import { InvestigationDetailResponse } from '../types/investigation';
import { StatusBadge } from './StatusBadge';
import { AuditTimeline } from './AuditTimeline';
import {
  X,
  Clock,
  Cpu,
  Scale,
  BrainCircuit,
  Database,
  FileText,
  ShieldAlert,
  ListChecks,
} from 'lucide-react';

interface InvestigationHistoryModalProps {
  investigationId: string | null;
  onClose: () => void;
}

export const InvestigationHistoryModal: React.FC<InvestigationHistoryModalProps> = ({
  investigationId,
  onClose,
}) => {
  const [detail, setDetail] = useState<InvestigationDetailResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!investigationId) return;

    setLoading(true);
    setError(null);

    apiService
      .getInvestigation(investigationId)
      .then((data) => {
        setDetail(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load historical investigation details');
        setLoading(false);
      });
  }, [investigationId]);

  if (!investigationId) return null;

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-100 font-mono">
                  {investigationId}
                </h2>
                {detail && (
                  <StatusBadge
                    verdict={detail.verdict}
                    status={detail.status || detail.case_status}
                    showVerdict={true}
                  />
                )}
              </div>
              <p className="text-xs text-slate-400">
                Historical Investigation Snapshot (SQLite Immutable Record)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 space-y-3 text-slate-400">
              <Clock className="w-8 h-8 animate-spin text-cyan-400" />
              <p className="text-sm">Loading historical snapshot...</p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
              {error}
            </div>
          )}

          {detail && !loading && (
            <>
              {/* Metadata Cards Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1">
                  <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">
                    Customer ID
                  </span>
                  <p className="text-sm font-mono font-medium text-slate-200">
                    {detail.customer_id || 'Not Specified'}
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1">
                  <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">
                    Stop Reason
                  </span>
                  <p className="text-sm font-medium text-amber-400">
                    {detail.stop_reason || 'WORKFLOW_COMPLETE'}
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1">
                  <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">
                    Exposure
                  </span>
                  <p className="text-sm font-mono font-medium text-slate-200">
                    ${detail.exposure ? detail.exposure.toFixed(2) : '0.00'}
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1">
                  <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">
                    Run Date
                  </span>
                  <p className="text-xs font-mono text-slate-300">
                    {formatDate(detail.created_at)}
                  </p>
                </div>
              </div>

              {/* LLM & Model Metrics */}
              <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-purple-400 uppercase tracking-wider">
                    <Cpu className="w-4 h-4" /> Groq Model Performance & Token Metrics
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    Latency: {detail.llm_latency ? `${detail.llm_latency.toFixed(2)}s` : 'N/A'}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1 text-xs">
                  <div className="text-slate-400">
                    Provider:{' '}
                    <span className="text-slate-200 font-mono">
                      {detail.llm_provider || 'groq'}
                    </span>
                  </div>
                  <div className="text-slate-400">
                    Model:{' '}
                    <span className="text-slate-200 font-mono">
                      {detail.llm_model || 'openai/gpt-oss-120b'}
                    </span>
                  </div>
                  <div className="text-slate-400">
                    Prompt Tokens:{' '}
                    <span className="text-slate-200 font-mono">
                      {detail.prompt_tokens || 0}
                    </span>
                  </div>
                  <div className="text-slate-400">
                    Total Tokens:{' '}
                    <span className="text-slate-200 font-mono">
                      {detail.total_tokens || 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* Reasoning Summary */}
              {detail.reasoning_summary && (
                <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                    <BrainCircuit className="w-4 h-4" /> AI Reasoning Summary
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {detail.reasoning_summary}
                  </p>
                </div>
              )}

              {/* R1-R10 Policy Rules Evaluation */}
              <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                  <Scale className="w-4 h-4" /> Deterministic Rule Evaluation (R1–R10)
                </div>

                {detail.rules && detail.rules.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {detail.rules.map((rule) => (
                      <div
                        key={rule.rule_id}
                        className={`p-2.5 rounded-md border text-xs space-y-1 ${
                          rule.triggered
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                            : 'bg-slate-900/50 border-slate-800 text-slate-400'
                        }`}
                      >
                        <div className="flex items-center justify-between font-mono font-semibold">
                          <span>{rule.rule_id}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-sans ${
                              rule.triggered
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-slate-800 text-slate-500'
                            }`}
                          >
                            {rule.triggered ? 'TRIGGERED' : 'PASSED'}
                          </span>
                        </div>
                        {rule.reason && <p className="text-[11px] leading-snug">{rule.reason}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">No rule evaluation records found.</p>
                )}
              </div>

              {/* Recommended Actions */}
              <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                  <ListChecks className="w-4 h-4" /> Recommended Final Actions
                </div>
                {detail.actions_final && detail.actions_final.length > 0 ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {detail.actions_final.map((act, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-xs font-mono"
                      >
                        {act}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">No final actions recorded.</p>
                )}
              </div>

              {/* SAR State */}
              <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-rose-400 uppercase tracking-wider">
                  <ShieldAlert className="w-4 h-4" /> Suspicious Activity Report (SAR) State
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-slate-300">Status:</span>
                  <span className="font-mono text-amber-400">
                    {detail.sar_status || 'NOT_RECOMMENDED'}
                  </span>
                </div>
                {detail.sar_reason && (
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {detail.sar_reason}
                  </p>
                )}
              </div>

              {/* Evidence Snapshot */}
              <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                  <Database className="w-4 h-4" /> Preserved Evidence Snapshot ({detail.evidence?.length || 0} items)
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {detail.evidence && detail.evidence.length > 0 ? (
                    detail.evidence.map((ev, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded bg-slate-900/80 border border-slate-800 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between font-mono text-[11px]">
                          <span className="font-bold text-slate-300">
                            [{ev.evidence_type || 'Evidence'}] {ev.evidence_id}
                          </span>
                          <span className="text-slate-500">{ev.source || 'TigerGraph'}</span>
                        </div>
                        <p className="text-slate-300">{ev.description}</p>
                        {ev.timestamp && (
                          <p className="text-[10px] font-mono text-slate-500">
                            Timestamp: {ev.timestamp}
                          </p>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500">No evidence snapshot items.</p>
                  )}
                </div>
              </div>

              {/* Audit Event Log */}
              {detail.audit_events && detail.audit_events.length > 0 && (
                <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    <Clock className="w-4 h-4 text-cyan-400" /> Run Audit Log
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
