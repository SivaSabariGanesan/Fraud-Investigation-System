import React, { useEffect, useState } from 'react';
import { ShieldAlert, Server, Activity } from 'lucide-react';
import { apiService } from '../services/api';

export const Navbar: React.FC = () => {
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');

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

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-50 flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20">
          <ShieldAlert className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-slate-100 text-lg leading-none tracking-tight flex items-center gap-2">
            FRAUD SHIELD <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 font-mono border border-indigo-500/20">TigerGraph Engine</span>
          </h1>
          <p className="text-xs text-slate-400">Autonomous Fraud Analytics & Case Investigation System</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono">
          <Server className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-400">FastAPI API:</span>
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
      </div>
    </header>
  );
};
