import React from 'react';
import { Case } from '../types/investigation';
import { StatusBadge } from '../components/StatusBadge';
import { formatCurrency, formatDate } from '../lib/utils';
import { ArrowRight, RefreshCw, XCircle } from 'lucide-react';

interface DashboardProps {
  cases: Case[];
  loading: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onSelectCase: (caseId: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ cases, loading, error, onRefresh, onSelectCase }) => {
  const totalCases = cases.length;
  const underInvestigationCases = cases.filter(
    (c) => c.status === 'UNDER_INVESTIGATION' || c.status === 'INVESTIGATING'
  ).length;
  const pendingVerificationCases = cases.filter(
    (c) => c.status === 'VERIFICATION_PENDING' || c.verdict === 'NEEDS_REVIEW'
  ).length;
  const unresolvedCases = cases.filter(
    (c) => c.status === 'UNRESOLVED' || c.status === 'PENDING'
  ).length;
  const confirmedFraudCases = cases.filter(
    (c) => c.status === 'CONFIRMED_FRAUD' || c.verdict === 'DECLINED'
  ).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-100">Operations Overview</h2>
          <p className="text-xs text-slate-400 mt-0.5">Real-time fraud cases, risk metrics, and agent investigation status.</p>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync Live</span>
          </button>
        )}
      </div>

      {/* Error state with retry */}
      {error && (
        <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 font-medium">
            <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Unable to connect to investigation service: {error}</span>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-xs font-medium text-slate-200 hover:bg-slate-800 transition"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Metric Cards - 5 columns */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Total Cases */}
        <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-1">
          <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Total Active</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-100 font-mono">
              {loading ? '—' : totalCases}
            </span>
            <span className="text-[10px] text-slate-500 font-mono">Cases</span>
          </div>
        </div>

        {/* Under Investigation */}
        <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-1">
          <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Under Review</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-indigo-400 font-mono">
              {loading ? '—' : underInvestigationCases}
            </span>
            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
          </div>
        </div>

        {/* Pending Verification */}
        <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-1">
          <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Verification Req.</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-amber-400 font-mono">
              {loading ? '—' : pendingVerificationCases}
            </span>
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          </div>
        </div>

        {/* Unresolved */}
        <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-1">
          <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Pending Initial</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-300 font-mono">
              {loading ? '—' : unresolvedCases}
            </span>
            <span className="w-2 h-2 rounded-full bg-slate-500"></span>
          </div>
        </div>

        {/* Confirmed Fraud */}
        <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-1">
          <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Confirmed Fraud</p>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-rose-400 font-mono">
              {loading ? '—' : confirmedFraudCases}
            </span>
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
          </div>
        </div>
      </div>

      {/* Recent Cases Table */}
      <div className="rounded-lg border border-slate-800/80 bg-slate-900/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800/80 flex items-center justify-between">
          <h3 className="font-semibold text-slate-200 text-sm">Active Investigations Queue</h3>
          <span className="text-xs text-slate-500 font-mono">{cases.length} records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-[11px] font-medium uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-4 font-medium">Case Ref</th>
                <th className="py-2.5 px-4 font-medium">Customer</th>
                <th className="py-2.5 px-4 font-medium">Status</th>
                <th className="py-2.5 px-4 font-medium">Verdict</th>
                <th className="py-2.5 px-4 font-medium">Created</th>
                <th className="py-2.5 px-4 font-medium text-right">Exposure</th>
                <th className="py-2.5 px-4 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {loading ? (
                Array.from({ length: 4 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-3 px-4"><div className="h-4 w-24 bg-slate-800 rounded"></div></td>
                    <td className="py-3 px-4"><div className="h-4 w-16 bg-slate-800 rounded"></div></td>
                    <td className="py-3 px-4"><div className="h-4 w-28 bg-slate-800 rounded"></div></td>
                    <td className="py-3 px-4"><div className="h-4 w-20 bg-slate-800 rounded"></div></td>
                    <td className="py-3 px-4"><div className="h-4 w-24 bg-slate-800 rounded"></div></td>
                    <td className="py-3 px-4"><div className="h-4 w-16 bg-slate-800 rounded ml-auto"></div></td>
                    <td className="py-3 px-4"><div className="h-4 w-12 bg-slate-800 rounded ml-auto"></div></td>
                  </tr>
                ))
              ) : cases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No investigation cases recorded.
                  </td>
                </tr>
              ) : (
                cases.map((c) => (
                  <tr
                    key={c.case_id}
                    onClick={() => onSelectCase(c.case_id)}
                    className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                  >
                    <td className="py-3 px-4 font-mono font-medium text-indigo-300">
                      {c.case_id}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">
                      {c.customer_id || <span className="text-slate-600 font-sans italic">Pending</span>}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={c.status} verdict={c.verdict} />
                    </td>
                    <td className="py-3 px-4">
                      {c.verdict ? (
                        <StatusBadge verdict={c.verdict} showVerdict={true} />
                      ) : (
                        <span className="text-slate-500 font-mono text-[11px]">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                      {c.created_at ? formatDate(c.created_at) : 'N/A'}
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-200 text-right">
                      {formatCurrency(c.exposure)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectCase(c.case_id);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-400 group-hover:text-indigo-300 transition"
                      >
                        <span>Open</span>
                        <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
