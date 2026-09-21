import React, { useEffect, useState } from 'react';
import { ShieldAlert, Server, Activity, Search, UserCheck } from 'lucide-react';
import { apiService } from '../services/api';

interface NavbarProps {
  onSearchCase?: (caseId: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onSearchCase }) => {
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    const check = async () => {
      try {
        const res = await apiService.checkHealth();
        if (res.status === 'ok') {
          setBackendStatus('online');
        } else {
          setBackendStatus('offline');
        }
      } catch {
        setBackendStatus('offline');
      }
    };
    check();
    const interval = setInterval(check, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim() && onSearchCase) {
      onSearchCase(searchInput.trim());
      setSearchInput('');
    }
  };

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-950/90 backdrop-blur sticky top-0 z-50 flex items-center justify-between px-6">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20">
          <ShieldAlert className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-slate-100 text-lg leading-none tracking-tight flex items-center gap-2">
            Fraud Investigation <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 font-mono border border-indigo-500/20">Analyst Dashboard</span>
          </h1>
          <p className="text-xs text-slate-400">TigerGraph Cloud + Groq LLM + R1-R10 Policy Engine</p>
        </div>
      </div>

      {/* Global Search Bar */}
      <form onSubmit={handleSearchSubmit} className="hidden md:flex items-center relative w-72">
        <Search className="w-4 h-4 text-slate-500 absolute left-3" />
        <input
          type="text"
          placeholder="Quick search Case ID..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
        />
      </form>

      {/* Status & Analyst Profile */}
      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono">
          <Server className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-400">API:</span>
          {backendStatus === 'checking' && (
            <span className="text-amber-400 flex items-center gap-1"><Activity className="w-3 h-3 animate-spin" /> Checking...</span>
          )}
          {backendStatus === 'online' && (
            <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> ONLINE
            </span>
          )}
          {backendStatus === 'offline' && (
            <span className="text-rose-400 font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-400"></span> DISCONNECTED
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-600/10 border border-indigo-500/20 text-xs text-indigo-300 font-medium">
          <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
          <span>Analyst</span>
        </div>
      </div>
    </header>
  );
};
