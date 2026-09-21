import React from 'react';
import { Verdict, CaseStatus } from '../types/investigation';
import { CheckCircle2, AlertTriangle, XCircle, Clock, RefreshCw } from 'lucide-react';

interface StatusBadgeProps {
  verdict?: Verdict;
  status?: CaseStatus;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ verdict, status }) => {
  if (verdict === 'APPROVED') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <CheckCircle2 className="w-3.5 h-3.5" /> APPROVED
      </span>
    );
  }

  if (verdict === 'DECLINED') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
        <XCircle className="w-3.5 h-3.5" /> DECLINED
      </span>
    );
  }

  if (verdict === 'NEEDS_REVIEW') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
        <AlertTriangle className="w-3.5 h-3.5" /> NEEDS REVIEW
      </span>
    );
  }

  if (status === 'INVESTIGATING') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 animate-pulse">
        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> INVESTIGATING
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
      <Clock className="w-3.5 h-3.5" /> PENDING
    </span>
  );
};
