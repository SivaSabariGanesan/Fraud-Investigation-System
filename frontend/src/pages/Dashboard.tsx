import React from 'react';
import { Case } from '../types/investigation';
import { StatusBadge } from '../components/StatusBadge';
import { formatCurrency, formatDate } from '../lib/utils';
import { ShieldAlert, AlertTriangle, Clock, ArrowRight, RefreshCw, XCircle, UserCheck } from 'lucide-react';

interface DashboardProps {
  cases: Case[];
  loading: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onSelectCase: (caseId: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ cases, loading, error, onRefresh, onSelectCase }) => {
  // Stats calculated solely from returned backend cases
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Fraud Analytics Dashboard</h2>
          <p className="text-sm text-slate-400">Autonomous fraud investigation overview and real backend case analytics.</p>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Data
          </button>
        )}
      </div>

      {/* Error state with retry */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>Unable to connect to investigation service. ({error})</span>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="px-3.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Cases */}
        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Cases</p>
              {loading ? (
                <div className="h-8 w-16 bg-slate-800 rounded animate-pulse mt-2" />
              ) : (
                <h3 className="text-3xl font-extrabold text-white mt-1">{totalCases}</h3>
              )}
            </div>
            <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Under Investigation */}
        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Under Investigation</p>
              {loading ? (
                <div className="h-8 w-16 bg-slate-800 rounded animate-pulse mt-2" />
              ) : (
                <h3 className="text-3xl font-extrabold text-indigo-400 mt-1">{underInvestigationCases}</h3>
              )}
            </div>
            <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <RefreshCw className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Pending Verification */}
        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pending Verification</p>
              {loading ? (
                <div className="h-8 w-16 bg-slate-800 rounded animate-pulse mt-2" />
              ) : (
                <h3 className="text-3xl font-extrabold text-amber-400 mt-1">{pendingVerificationCases}</h3>
              )}
            </div>
            <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Unresolved */}
        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Unresolved</p>
              {loading ? (
                <div className="h-8 w-16 bg-slate-800 rounded animate-pulse mt-2" />
              ) : (
                <h3 className="text-3xl font-extrabold text-slate-300 mt-1">{unresolvedCases}</h3>
              )}
            </div>
            <div className="p-2.5 rounded-lg bg-slate-800 text-slate-300">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Confirmed Fraud */}
        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Confirmed Fraud</p>
              {loading ? (
                <div className="h-8 w-16 bg-slate-800 rounded animate-pulse mt-2" />
              ) : (
                <h3 className="text-3xl font-extrabold text-rose-400 mt-1">{confirmedFraudCases}</h3>
              )}
            </div>
            <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <XCircle className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Cases Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/90 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-semibold text-slate-200">Recent Cases</h3>
          <span className="text-xs text-slate-400 font-mono">{cases.length} cases registered</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Case ID</th>
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Verdict</th>
                <th className="py-3.5 px-4">Opened</th>
                <th className="py-3.5 px-4">Exposure</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                // Skeleton rows
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-4 px-4"><div className="h-4 w-20 bg-slate-800 rounded" /></td>
                    <td className="py-4 px-4"><div className="h-4 w-16 bg-slate-800 rounded" /></td>
                    <td className="py-4 px-4"><div className="h-4 w-28 bg-slate-800 rounded" /></td>
                    <td className="py-4 px-4"><div className="h-4 w-24 bg-slate-800 rounded" /></td>
                    <td className="py-4 px-4"><div className="h-4 w-24 bg-slate-800 rounded" /></td>
                    <td className="py-4 px-4"><div className="h-4 w-16 bg-slate-800 rounded" /></td>
                    <td className="py-4 px-4 text-right"><div className="h-4 w-12 bg-slate-800 rounded ml-auto" /></td>
                  </tr>
                ))
              ) : cases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <UserCheck className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="font-semibold text-slate-300">No investigation cases available.</p>
                    <p className="text-xs text-slate-500 mt-1">Backend contains no case records at present.</p>
                  </td>
                </tr>
              ) : (
                cases.slice(0, 10).map((c) => (
                  <tr key={c.case_id} onClick={() => onSelectCase(c.case_id)} className="hover:bg-slate-800/50 transition-colors cursor-pointer">
                    <td className="py-3.5 px-4 font-mono font-semibold text-indigo-300">{c.case_id}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-300 text-xs">
                      {c.customer_id || 'Connected'}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="py-3.5 px-4">
                      {c.verdict ? (
                        <StatusBadge verdict={c.verdict} showVerdict={true} />
                      ) : (
                        <span className="text-slate-500 text-xs font-mono">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-mono text-slate-400">{formatDate(c.created_at)}</td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-200">{formatCurrency(c.exposure)}</td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); onSelectCase(c.case_id); }}
                        className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-md bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 transition"
                      >
                        Inspect <ArrowRight className="w-3.5 h-3.5" />
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
