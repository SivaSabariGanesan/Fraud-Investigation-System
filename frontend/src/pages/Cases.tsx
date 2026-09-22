import React, { useState } from 'react';
import { Case } from '../types/investigation';
import { StatusBadge } from '../components/StatusBadge';
import { formatCurrency } from '../lib/utils';
import { Search, Filter, ArrowRight, RefreshCw, XCircle } from 'lucide-react';

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
    const query = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !query ||
      c.case_id.toLowerCase().includes(query) ||
      (c.customer_id && c.customer_id.toLowerCase().includes(query)) ||
      (c.pattern && c.pattern.toLowerCase().includes(query));

    let matchesStatus = true;
    if (statusFilter !== 'ALL') {
      const caseStatus = (c.status || '').toUpperCase();
      matchesStatus = caseStatus === statusFilter;
    }

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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-100">Cases Directory</h2>
          <p className="text-xs text-slate-400 mt-0.5">Filter, search, and inspect fraud cases from the graph engine.</p>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 font-medium">
            <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Unable to connect to investigation service: {error}</span>
          </div>
          <button
            onClick={onRefresh}
            className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-xs text-slate-200 hover:bg-slate-800 transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 rounded-lg bg-slate-900/60 border border-slate-800/80">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by Case ID, Customer, or Pattern..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition"
          />
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3 h-3 text-slate-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950/80 border border-slate-800 text-slate-300 text-xs rounded-md px-2.5 py-1.5 focus:outline-none focus:border-indigo-500/60 transition"
            >
              <option value="ALL">All Statuses</option>
              <option value="UNDER_INVESTIGATION">Under Investigation</option>
              <option value="VERIFICATION_PENDING">Verification Pending</option>
              <option value="UNRESOLVED">Pending Initial</option>
              <option value="CONFIRMED_FRAUD">Confirmed Fraud</option>
              <option value="CLEARED">Cleared</option>
              <option value="NEEDS_REVIEW">Needs Review</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <select
              value={verdictFilter}
              onChange={(e) => setVerdictFilter(e.target.value)}
              className="bg-slate-950/80 border border-slate-800 text-slate-300 text-xs rounded-md px-2.5 py-1.5 focus:outline-none focus:border-indigo-500/60 transition"
            >
              <option value="ALL">All Verdicts</option>
              <option value="APPROVED">Approved</option>
              <option value="DECLINED">Declined</option>
              <option value="NEEDS_REVIEW">Needs Review</option>
              <option value="UNASSIGNED">Unassigned</option>
            </select>
          </div>
        </div>
      </div>

      {/* Case Table */}
      <div className="rounded-lg border border-slate-800/80 bg-slate-900/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-[11px] font-medium uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-4 font-medium">Case Ref</th>
                <th className="py-2.5 px-4 font-medium">Customer</th>
                <th className="py-2.5 px-4 font-medium">Status</th>
                <th className="py-2.5 px-4 font-medium">Verdict</th>
                <th className="py-2.5 px-4 font-medium">Pattern / Flag</th>
                <th className="py-2.5 px-4 font-medium text-right">Exposure</th>
                <th className="py-2.5 px-4 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-3 px-4"><div className="h-4 w-24 bg-slate-800 rounded"></div></td>
                    <td className="py-3 px-4"><div className="h-4 w-16 bg-slate-800 rounded"></div></td>
                    <td className="py-3 px-4"><div className="h-4 w-28 bg-slate-800 rounded"></div></td>
                    <td className="py-3 px-4"><div className="h-4 w-20 bg-slate-800 rounded"></div></td>
                    <td className="py-3 px-4"><div className="h-4 w-40 bg-slate-800 rounded"></div></td>
                    <td className="py-3 px-4"><div className="h-4 w-16 bg-slate-800 rounded ml-auto"></div></td>
                    <td className="py-3 px-4"><div className="h-4 w-12 bg-slate-800 rounded ml-auto"></div></td>
                  </tr>
                ))
              ) : filteredCases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No matching investigation cases found.
                  </td>
                </tr>
              ) : (
                filteredCases.map((c) => (
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
                    <td className="py-3 px-4 text-slate-300 max-w-xs truncate text-[11px]">
                      {c.pattern || c.notes || <span className="text-slate-600 italic">No pattern flagged</span>}
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
