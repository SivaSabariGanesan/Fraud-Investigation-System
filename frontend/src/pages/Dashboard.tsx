import React from 'react';
import { Case } from '../types/investigation';
import { StatusBadge } from '../components/StatusBadge';
import { formatCurrency } from '../lib/utils';
import { ShieldAlert, AlertTriangle, DollarSign, Clock, ArrowRight, Activity, GitBranch } from 'lucide-react';

interface DashboardProps {
  cases: Case[];
  loading: boolean;
  onSelectCase: (caseId: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ cases, loading, onSelectCase }) => {
  const totalCases = cases.length;
  const highRiskCases = cases.filter(c => (c.fraud_probability || 0) > 0.6).length;
  const totalExposure = cases.reduce((acc, c) => acc + (c.exposure || 0), 0);
  const pendingCases = cases.filter(c => c.status === 'PENDING').length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white">Fraud Analytics Dashboard</h2>
        <p className="text-sm text-slate-400">Overview of connected graph fraud analytics and AI investigation cases.</p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Active Cases</p>
              <h3 className="text-3xl font-extrabold text-white mt-1">{loading ? '...' : totalCases}</h3>
            </div>
            <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-400">
            <Activity className="w-3.5 h-3.5 text-indigo-400" /> Recorded in SQLite store
          </div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">High Risk Cases</p>
              <h3 className="text-3xl font-extrabold text-rose-400 mt-1">{loading ? '...' : highRiskCases}</h3>
            </div>
            <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs text-rose-400">
            Risk score &gt; 60% probability
          </div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Financial Exposure</p>
              <h3 className="text-3xl font-extrabold text-amber-400 mt-1">{loading ? '...' : formatCurrency(totalExposure)}</h3>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-400">
            Across open & flagged transactions
          </div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pending Review</p>
              <h3 className="text-3xl font-extrabold text-indigo-400 mt-1">{loading ? '...' : pendingCases}</h3>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-800 text-slate-300">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs text-indigo-400">
            Awaiting agent trigger
          </div>
        </div>
      </div>

      {/* Graph Entities Banner */}
      <div className="p-5 rounded-xl bg-gradient-to-r from-indigo-950/60 via-purple-950/40 to-slate-900 border border-indigo-500/20">
        <div className="flex items-center gap-3 mb-3">
          <GitBranch className="w-5 h-5 text-indigo-400" />
          <h3 className="font-semibold text-slate-100">TigerGraph Fraud Analytics Layer Connected</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
            <span className="text-slate-400 block">Vertices Monitored:</span>
            <span className="font-semibold text-indigo-300">Customer, Card, Device, Email, Region</span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
            <span className="text-slate-400 block">Edges Tracked:</span>
            <span className="font-semibold text-indigo-300">OWNS, MADE, FROM_DEVICE, BILLED_IN</span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
            <span className="text-slate-400 block">Past Cases Link:</span>
            <span className="font-semibold text-indigo-300">ClosedCase, EvidenceRequest</span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
            <span className="text-slate-400 block">Backend API:</span>
            <span className="font-mono text-emerald-400">FastAPI + RESTPP</span>
          </div>
        </div>
      </div>

      {/* Recent Cases Table Preview */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/90 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-semibold text-slate-200">Recent Investigation Queue</h3>
          <span className="text-xs text-slate-400 font-mono">SQLite DB synchronized</span>
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
                  <td colSpan={6} className="py-8 text-center text-slate-500">Loading case records...</td>
                </tr>
              ) : cases.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">No active cases found in backend.</td>
                </tr>
              ) : (
                cases.slice(0, 5).map((c) => (
                  <tr key={c.case_id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-indigo-300">{c.case_id}</td>
                    <td className="py-3 px-4"><StatusBadge verdict={c.verdict} status={c.status} /></td>
                    <td className="py-3 px-4 text-slate-300">{c.pattern || 'Unclassified'}</td>
                    <td className="py-3 px-4">
                      {c.fraud_probability !== null ? (
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${
                                c.fraud_probability > 0.7 ? 'bg-rose-500' : c.fraud_probability > 0.3 ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${c.fraud_probability * 100}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs text-slate-300">{(c.fraud_probability * 100).toFixed(0)}%</span>
                        </div>
                      ) : (
                        <span className="text-slate-500 text-xs">Not evaluated</span>
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
