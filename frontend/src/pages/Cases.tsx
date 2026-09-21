import React, { useState } from 'react';
import { Case } from '../types/investigation';
import { StatusBadge } from '../components/StatusBadge';
import { formatCurrency, formatDate } from '../lib/utils';
import { Search, Filter, ArrowRight, RefreshCw, XCircle, FileQuestion } from 'lucide-react';

interface CasesProps {
  cases: Case[];
  loading: boolean;
  error?: string | null;
  onRefresh: () => void;
  onSelectCase: (caseId: string) => void;
}

export const Cases: React.FC<CasesProps> = ({ cases, loading, error, onRefresh, onSelectCase }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [verdictFilter, setVerdictFilter] = useState<string>('ALL');

  const filteredCases = cases.filter((c) => {
    // Search match by Case ID or Customer ID
    const query = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !query ||
      c.case_id.toLowerCase().includes(query) ||
      (c.customer_id && c.customer_id.toLowerCase().includes(query));

    // Status filter match
    let matchesStatus = true;
    if (statusFilter !== 'ALL') {
      const caseStatus = (c.status || '').toUpperCase();
      matchesStatus = caseStatus === statusFilter;
    }

    // Verdict filter match
    let matchesVerdict = true;
    if (verdictFilter !== 'ALL') {
      const caseVerdict = (c.verdict || '').toUpperCase();
      if (verdictFilter === 'UNASSIGNED') {
        matchesVerdict = !caseVerdict;
      } else {
        matchesVerdict = caseVerdict === verdictFilter;
      }
    }

    return matchesSearch && matchesStatus && matchesVerdict;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Fraud Cases Directory</h2>
          <p className="text-sm text-slate-400">Complete searchable repository of investigation cases returned from backend API.</p>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Directory
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>Unable to connect to investigation service. ({error})</span>
          </div>
          <button
            onClick={onRefresh}
            className="px-3 py-1 rounded-md bg-slate-900 border border-slate-800 text-xs text-slate-200 hover:bg-slate-800 transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* Search & Filter Header */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800">
        {/* Search by Case ID / Customer ID */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by Case ID or Customer ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-xs text-slate-400 font-semibold">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 font-mono"
            >
              <option value="ALL">All Statuses</option>
              <option value="UNDER_INVESTIGATION">Under Investigation</option>
              <option value="VERIFICATION_PENDING">Verification Pending</option>
              <option value="UNRESOLVED">Unresolved</option>
              <option value="CONFIRMED_FRAUD">Confirmed Fraud</option>
              <option value="CLEARED">Cleared</option>
              <option value="NEEDS_REVIEW">Needs Review</option>
            </select>
          </div>

          {/* Verdict Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 font-semibold">Verdict:</span>
            <select
              value={verdictFilter}
              onChange={(e) => setVerdictFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 font-mono"
            >
              <option value="ALL">All Verdicts</option>
              <option value="APPROVED">APPROVED</option>
              <option value="DECLINED">DECLINED</option>
              <option value="NEEDS_REVIEW">NEEDS_REVIEW</option>
              <option value="UNASSIGNED">Unassigned</option>
            </select>
          </div>
        </div>
      </div>

      {/* Case Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Case ID</th>
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Verdict</th>
                <th className="py-3.5 px-4">Exposure</th>
                <th className="py-3.5 px-4">Opened</th>
                <th className="py-3.5 px-4">Last Updated</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                Array.from({ length: 6 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-4 px-4"><div className="h-4 w-20 bg-slate-800 rounded" /></td>
                    <td className="py-4 px-4"><div className="h-4 w-16 bg-slate-800 rounded" /></td>
                    <td className="py-4 px-4"><div className="h-4 w-28 bg-slate-800 rounded" /></td>
                    <td className="py-4 px-4"><div className="h-4 w-20 bg-slate-800 rounded" /></td>
                    <td className="py-4 px-4"><div className="h-4 w-16 bg-slate-800 rounded" /></td>
                    <td className="py-4 px-4"><div className="h-4 w-24 bg-slate-800 rounded" /></td>
                    <td className="py-4 px-4"><div className="h-4 w-24 bg-slate-800 rounded" /></td>
                    <td className="py-4 px-4 text-right"><div className="h-4 w-12 bg-slate-800 rounded ml-auto" /></td>
                  </tr>
                ))
              ) : filteredCases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <FileQuestion className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="font-semibold text-slate-300">No cases match the selected filter criteria.</p>
                    <p className="text-xs text-slate-500 mt-1">Try clearing search terms or selecting 'All Statuses'.</p>
                  </td>
                </tr>
              ) : (
                filteredCases.map((c) => (
                  <tr
                    key={c.case_id}
                    onClick={() => onSelectCase(c.case_id)}
                    className="hover:bg-slate-800/50 transition-colors cursor-pointer"
                  >
                    <td className="py-3.5 px-4 font-mono font-semibold text-indigo-300">{c.case_id}</td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-300">
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
                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-200">{formatCurrency(c.exposure)}</td>
                    <td className="py-3.5 px-4 text-xs font-mono text-slate-400">{formatDate(c.created_at)}</td>
                    <td className="py-3.5 px-4 text-xs font-mono text-slate-400">{formatDate(c.updated_at || c.created_at)}</td>
                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onSelectCase(c.case_id)}
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
