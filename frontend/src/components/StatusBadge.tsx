import React from 'react';
import { Verdict, CaseStatus } from '../types/investigation';
import { CheckCircle2, AlertTriangle, XCircle, Clock, RefreshCw } from 'lucide-react';

interface StatusBadgeProps {
  verdict?: Verdict;
  status?: CaseStatus | string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ verdict, status, className = '' }) => {
  const normalizedStatus = (status || '').toUpperCase();
  const normalizedVerdict = (verdict || '').toUpperCase();

  if (normalizedStatus === 'VERIFICATION_PENDING') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 ${className}`}>
        <AlertTriangle className="w-3.5 h-3.5" /> VERIFICATION PENDING
      </span>
    );
  }

  if (normalizedStatus === 'UNRESOLVED') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20 ${className}`}>
        <Clock className="w-3.5 h-3.5" /> UNRESOLVED
      </span>
    );
  }

  if (normalizedStatus === 'CONFIRMED_FRAUD' || normalizedVerdict === 'DECLINED') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 ${className}`}>
        <XCircle className="w-3.5 h-3.5" /> {normalizedStatus === 'CONFIRMED_FRAUD' ? 'CONFIRMED FRAUD' : 'DECLINED'}
      </span>
    );
  }

  if (normalizedStatus === 'CLEARED' || normalizedVerdict === 'APPROVED') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 ${className}`}>
        <CheckCircle2 className="w-3.5 h-3.5" /> {normalizedStatus === 'CLEARED' ? 'CLEARED' : 'APPROVED'}
      </span>
    );
  }

  if (normalizedVerdict === 'NEEDS_REVIEW' || normalizedStatus === 'NEEDS_REVIEW') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 ${className}`}>
        <AlertTriangle className="w-3.5 h-3.5" /> NEEDS REVIEW
      </span>
    );
  }

  if (normalizedStatus === 'UNDER_INVESTIGATION' || normalizedStatus === 'INVESTIGATING') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 animate-pulse ${className}`}>
        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> UNDER INVESTIGATION
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700 ${className}`}>
      <Clock className="w-3.5 h-3.5" /> {normalizedStatus || 'PENDING'}
    </span>
  );
};
