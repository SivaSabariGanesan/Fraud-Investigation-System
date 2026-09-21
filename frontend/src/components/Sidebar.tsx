import React from 'react';
import { LayoutDashboard, ShieldCheck, Database, Cpu } from 'lucide-react';

interface SidebarProps {
  activeTab: 'dashboard' | 'cases' | 'details';
  setActiveTab: (tab: 'dashboard' | 'cases' | 'details') => void;
  selectedCaseId: string | null;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, selectedCaseId }) => {
  return (
    <aside className="w-64 border-r border-slate-800 bg-slate-950 p-4 flex flex-col justify-between shrink-0">
      <div className="space-y-6">
        <div>
          <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Core Navigation</p>
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" /> Dashboard
            </button>

            <button
              onClick={() => setActiveTab('cases')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'cases' || activeTab === 'details'
                  ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <ShieldCheck className="w-4 h-4" /> Fraud Cases
            </button>
          </nav>
        </div>

        {selectedCaseId && (
          <div>
            <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Active Focus</p>
            <div className="mx-1 p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5">
              <span className="text-[11px] font-mono text-slate-400 block">SELECTED CASE:</span>
              <span className="text-sm font-bold font-mono text-indigo-300 block truncate">{selectedCaseId}</span>
              <button
                onClick={() => setActiveTab('details')}
                className="w-full text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-1.5 px-2 rounded transition"
              >
                Inspect Case Graph
              </button>
            </div>
          </div>
        )}

        <div>
          <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Graph Layer</p>
          <div className="space-y-2 px-3 text-xs text-slate-400">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5"><Database className="w-3.5 h-3.5 text-indigo-400" /> Graph Engine</span>
              <span className="font-mono text-slate-300">TigerGraph</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5 text-purple-400" /> Agent Subsystem</span>
              <span className="font-mono text-emerald-400">Ready</span>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-900 text-xs text-slate-500 font-mono text-center">
        v1.0.0 Foundation
      </div>
    </aside>
  );
};
