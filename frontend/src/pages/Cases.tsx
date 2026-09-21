import React, { useState } from 'react';
import { Case } from '../types/investigation';
import { StatusBadge } from '../components/StatusBadge';
import { formatCurrency, formatDate } from '../lib/utils';
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
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const filteredCases = cases.filter((c) => {
    const matchesSearch =
      c.case_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.pattern && c.pattern.toLowerCase().includes(searchTerm.toLowerCase()));

    if (filterStatus === 'UNDER_INVESTIGATION') {
      return matchesSearch && (c.status === 'UNDER_INVESTIGATION' || c.status === 'INVESTIGATING');
    }
    if (filterStatus === 'VERIFICATION_PENDING') {
      return matchesSearch && (c.status === 'VERIFICATION_PENDING' || c.verdict === 'NEEDS_REVIEW');
    }
    if (filterStatus === 'UNRESOLVED') {
      return matchesSearch && (c.status === 'UNRESOLVED' || c.status === 'PENDING');
    }
    if (filterStatus === 'CONFIRMED_FRAUD') {
      return matchesSearch && (c.status === 'CONFIRMED_FRAUD' || c.verdict === 'DECLINED');
    }
    if (filterStatus === 'CLEARED') {
      return matchesSearch && (c.status === 'CLEARED' || c.verdict === 'APPROVED');
    }

    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Fraud Cases Directory</h2>
          <p className="text-sm text-slate-400">Search and inspect active fraud investigations backed by SQLite & TigerGraph Cloud.</p>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Cases
        </button>
      </div>

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
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by Case ID or Pattern..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-500 mr-2 shrink-0" />
          {[
            { id: 'ALL', label: 'All Cases' },
            { id: 'UNDER_INVESTIGATION', label: 'Under Investigation' },
            { id: 'VERIFICATION_PENDING', label: 'Verification Pending' },
            { id: 'UNRESOLVED', label: 'Unresolved' },
            { id: 'CONFIRMED_FRAUD', label: 'Confirmed Fraud' },
            { id: 'CLEARED', label: 'Cleared' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setFilterStatus(item.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 ${
                filterStatus === item.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cases Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Case ID</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Status & Verdict</th>
                <th className="py-3 px-4">Pattern</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Evidence Status</th>
                <th className="py-3 px-4">Created At</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-400" />
                    Querying backend database...
                  </td>
                </tr>
              ) : filteredCases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No cases match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredCases.map((c) => (
                  <tr key={c.case_id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-semibold text-indigo-300">{c.case_id}</td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-300">
                      {c.case_id === 'HHG-003' ? 'C08623' : 'View Details'}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge verdict={c.verdict} status={c.status} />
                    </td>
                    <td className="py-3.5 px-4 text-slate-200">{c.pattern || 'Pending Analysis'}</td>
                    <td className="py-3.5 px-4 font-mono font-medium">{formatCurrency(c.exposure)}</td>
                    <td className="py-3.5 px-4 text-xs font-mono">
                      {c.status === 'VERIFICATION_PENDING' || c.verdict === 'NEEDS_REVIEW' ? (
                        <span className="text-amber-400 font-semibold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          Verification Pending
                        </span>
                      ) : (
                        <span className="text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                          Graph Ready
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-400 font-mono">{formatDate(c.created_at)}</td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => onSelectCase(c.case_id)}
                        className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 transition"
                      >
                        Inspect Case <ArrowRight className="w-3.5 h-3.5" />
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
