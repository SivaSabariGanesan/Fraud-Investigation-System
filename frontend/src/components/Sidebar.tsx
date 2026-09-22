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
    <aside className="w-60 border-r border-slate-800/80 bg-slate-950 p-3.5 flex flex-col justify-between shrink-0 hidden md:flex select-none">
      <div className="space-y-5">
        <div>
          <p className="px-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Workspace</p>
          <nav className="space-y-0.5">
            <button
              onClick={onNavigateDashboard}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition ${
                activeTab === 'dashboard'
                  ? 'bg-indigo-600/15 text-indigo-300 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 text-indigo-400" />
              <span>Overview</span>
            </button>

            <button
              onClick={onNavigateCases}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition ${
                activeTab === 'cases'
                  ? 'bg-indigo-600/15 text-indigo-300 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <span>Cases Directory</span>
            </button>
          </nav>
        </div>

        {selectedCaseId && (
          <div>
            <p className="px-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Active Case</p>
            <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-medium">Case Ref</span>
                <span className="text-xs font-mono font-semibold text-indigo-300">{selectedCaseId}</span>
              </div>
              <button
                onClick={() => onNavigateDetails(selectedCaseId)}
                className={`w-full flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 px-2 rounded-md transition ${
                  activeTab === 'details'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60'
                }`}
              >
                <Search className="w-3.5 h-3.5" />
                <span>Open Workbench</span>
              </button>
            </div>
          </div>
        )}

        <div>
          <p className="px-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Connected Services</p>
          <div className="space-y-1.5 px-2.5 text-[11px] text-slate-400">
            <div className="flex items-center justify-between py-0.5">
              <span className="flex items-center gap-1.5 text-slate-400">
                <Database className="w-3 h-3 text-indigo-400" /> Graph Engine
              </span>
              <span className="font-mono text-slate-300 text-[10px]">TigerGraph</span>
            </div>
            <div className="flex items-center justify-between py-0.5">
              <span className="flex items-center gap-1.5 text-slate-400">
                <Cpu className="w-3 h-3 text-purple-400" /> Reasoning Model
              </span>
              <span className="font-mono text-indigo-300 text-[10px]">Groq 120B</span>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-slate-900 text-[10px] text-slate-500 font-mono text-center">
        Sentinel Platform v1.2
      </div>
    </aside>
  );
};
