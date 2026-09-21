import React from 'react';
import { LayoutDashboard, ShieldCheck, Database, Cpu, Search } from 'lucide-react';

interface SidebarProps {
  activeTab: 'dashboard' | 'cases' | 'details';
  onNavigateDashboard: () => void;
  onNavigateCases: () => void;
  onNavigateDetails: (caseId?: string) => void;
  selectedCaseId: string | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onNavigateDashboard,
  onNavigateCases,
  onNavigateDetails,
  selectedCaseId,
}) => {
  return (
    <aside className="w-64 border-r border-slate-800 bg-slate-950 p-4 flex flex-col justify-between shrink-0 hidden md:flex">
      <div className="space-y-6">
        <div>
          <p className="px-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Navigation</p>
          <nav className="space-y-1">
            <button
              onClick={onNavigateDashboard}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" /> Dashboard
            </button>

            <button
              onClick={onNavigateCases}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'cases'
                  ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <ShieldCheck className="w-4 h-4" /> Cases Directory
            </button>
          </nav>
        </div>

        {selectedCaseId && (
          <div>
            <p className="px-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Active Investigation</p>
            <div className="mx-1 p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <span className="text-[10px] font-mono text-slate-500 block uppercase">Selected Case:</span>
              <span className="text-sm font-bold font-mono text-indigo-300 block truncate">{selectedCaseId}</span>
              <button
                onClick={() => onNavigateDetails(selectedCaseId)}
                className={`w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-1.5 px-2 rounded-lg transition ${
                  activeTab === 'details'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-600/20'
                }`}
              >
                <Search className="w-3.5 h-3.5" /> Inspect Details
              </button>
            </div>
          </div>
        )}

        <div>
          <p className="px-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">System Stack</p>
          <div className="space-y-2 px-3 text-xs text-slate-400">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5"><Database className="w-3.5 h-3.5 text-indigo-400" /> Graph Engine</span>
              <span className="font-mono text-slate-300">TigerGraph</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5 text-purple-400" /> LLM Reasoning</span>
              <span className="font-mono text-indigo-300">Groq 120B</span>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-900 text-[11px] text-slate-500 font-mono text-center">
        Fraud Investigation v1.0
      </div>
    </aside>
  );
};
