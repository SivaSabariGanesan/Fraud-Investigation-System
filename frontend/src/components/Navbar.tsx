import React, { useEffect, useState } from 'react';
import { ShieldAlert, Search, UserCheck } from 'lucide-react';
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
    <header className="h-14 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50 flex items-center justify-between px-5">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
          <ShieldAlert className="w-4 h-4" />
        </div>
        <div className="flex items-center gap-2.5">
          <span className="font-semibold text-slate-100 text-sm tracking-tight">Sentinel</span>
          <span className="text-slate-600 text-xs">/</span>
          <span className="text-xs font-medium text-slate-400">Fraud Operations</span>
        </div>
      </div>

      {/* Global Search Bar */}
      <form onSubmit={handleSearchSubmit} className="hidden md:flex items-center relative w-80">
        <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 pointer-events-none" />
        <input
          type="text"
          placeholder="Search Case ID or Customer..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="w-full bg-slate-900/80 border border-slate-800 rounded-lg pl-8 pr-12 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition"
        />
        <kbd className="absolute right-2.5 top-2 text-[10px] font-mono text-slate-500 bg-slate-800/60 border border-slate-700/50 px-1.5 py-0.5 rounded">
          /
        </kbd>
      </form>

      {/* Status & Analyst Profile */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] text-slate-400">
          {backendStatus === 'checking' && (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
              <span>Connecting</span>
            </>
          )}
          {backendStatus === 'online' && (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span className="text-slate-300">Live Services</span>
            </>
          )}
          {backendStatus === 'offline' && (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
              <span className="text-rose-400">Disconnected</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300">
          <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
          <span className="font-medium text-slate-300">Analyst</span>
        </div>
      </div>
    </header>
  );
};
