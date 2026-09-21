import React from 'react';
import { Case } from '../types/investigation';
import { StatusBadge } from '../components/StatusBadge';
import { formatCurrency } from '../lib/utils';
import { ShieldAlert, AlertTriangle, Clock, ArrowRight, Activity, GitBranch, RefreshCw, XCircle } from 'lucide-react';

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

  const totalExposure = cases.reduce((acc, c) => acc + (c.exposure || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Fraud Analytics Dashboard</h2>
          <p className="text-sm text-slate-400">Connected TigerGraph Cloud fraud analytics and real investigation cases.</p>
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

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>Unable to connect to investigation service. ({error})</span>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="px-3 py-1 rounded-md bg-slate-900 border border-slate-800 text-xs text-slate-200 hover:bg-slate-800 transition"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Cases</p>
              <h3 className="text-3xl font-extrabold text-white mt-1">{loading ? '...' : totalCases}</h3>
            </div>
            <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-400">
            <Activity className="w-3.5 h-3.5 text-indigo-400" /> Real backend data
          </div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Under Investigation</p>
              <h3 className="text-3xl font-extrabold text-indigo-400 mt-1">{loading ? '...' : underInvestigationCases}</h3>
            </div>
            <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <RefreshCw className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs text-indigo-400">
            Active agent workflows
          </div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pending Verification</p>
              <h3 className="text-3xl font-extrabold text-amber-400 mt-1">{loading ? '...' : pendingVerificationCases}</h3>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs text-amber-400">
            Awaiting evidence response
          </div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Unresolved Cases</p>
              <h3 className="text-3xl font-extrabold text-slate-300 mt-1">{loading ? '...' : unresolvedCases}</h3>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-800 text-slate-300">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-400">
            Incomplete investigation
          </div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Confirmed Fraud</p>
              <h3 className="text-3xl font-extrabold text-rose-400 mt-1">{loading ? '...' : confirmedFraudCases}</h3>
            </div>
            <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <XCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs text-rose-400">
            Confirmed fraud verdicts
          </div>
        </div>
      </div>

      {/* Graph Layer Connection Banner */}
      <div className="p-5 rounded-xl bg-gradient-to-r from-indigo-950/60 via-purple-950/40 to-slate-900 border border-indigo-500/20">
        <div className="flex items-center gap-3 mb-3">
          <GitBranch className="w-5 h-5 text-indigo-400" />
          <h3 className="font-semibold text-slate-100">Real TigerGraph Cloud FraudGraph Active</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
            <span className="text-slate-400 block">Vertices:</span>
            <span className="font-semibold text-indigo-300">Customer, Card, Transaction, Device, Region, Email</span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
            <span className="text-slate-400 block">Edges:</span>
            <span className="font-semibold text-indigo-300">OWNS, MADE, FROM_DEVICE, BILLED_IN, NEXT</span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
            <span className="text-slate-400 block">Cases & Evidence:</span>
            <span className="font-semibold text-indigo-300">ClosedCase, EvidenceRequest</span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
            <span className="text-slate-400 block">Total Exposure:</span>
            <span className="font-mono text-amber-400 font-semibold">{formatCurrency(totalExposure)}</span>
          </div>
        </div>
      </div>

      {/* Cases Queue */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/90 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-semibold text-slate-200">Recent Investigation Queue</h3>
          <span className="text-xs text-slate-400 font-mono">Real Cases from API</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Case ID</th>
                <th className="py-3 px-4">Status & Verdict</th>
                <th className="py-3 px-4">Pattern</th>
                <th className="py-3 px-4">Fraud Probability</th>
                <th className="py-3 px-4">Financial Exposure</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-400" />
                    Loading cases from backend...
                  </td>
                </tr>
              ) : cases.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No active cases found in backend.
                  </td>
                </tr>
              ) : (
                cases.slice(0, 10).map((c) => (
                  <tr key={c.case_id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-indigo-300">{c.case_id}</td>
                    <td className="py-3 px-4">
                      <StatusBadge verdict={c.verdict} status={c.status} />
                    </td>
                    <td className="py-3 px-4 text-slate-300">{c.pattern || 'Unclassified'}</td>
                    <td className="py-3 px-4">
                      {c.fraud_probability !== null && c.fraud_probability !== undefined ? (
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${
                                c.fraud_probability > 0.7
                                  ? 'bg-rose-500'
                                  : c.fraud_probability > 0.3
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${c.fraud_probability * 100}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs text-slate-300">
                            {(c.fraud_probability * 100).toFixed(0)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500 text-xs">Not determined</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono">{formatCurrency(c.exposure)}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => onSelectCase(c.case_id)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition"
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
