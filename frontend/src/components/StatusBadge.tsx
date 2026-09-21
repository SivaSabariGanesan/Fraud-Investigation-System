import React from 'react';
import { Verdict, CaseStatus } from '../types/investigation';
import { CheckCircle2, AlertTriangle, XCircle, Clock, RefreshCw, HelpCircle, ShieldCheck } from 'lucide-react';

interface StatusBadgeProps {
  verdict?: Verdict | string | null;
  status?: CaseStatus | string | null;
  className?: string;
  showVerdict?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ verdict, status, className = '', showVerdict = false }) => {
  const normStatus = (status || '').toUpperCase();
  const normVerdict = (verdict || '').toUpperCase();

  // Explicit Verdict rendering if requested
  if (showVerdict && normVerdict) {
    if (normVerdict === 'APPROVED') {
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 ${className}`}>
          <CheckCircle2 className="w-3.5 h-3.5" /> APPROVED
        </span>
      );
    }
    if (normVerdict === 'DECLINED') {
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 ${className}`}>
          <XCircle className="w-3.5 h-3.5" /> DECLINED
        </span>
      );
    }
    if (normVerdict === 'NEEDS_REVIEW') {
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 ${className}`}>
          <AlertTriangle className="w-3.5 h-3.5" /> NEEDS REVIEW
        </span>
      );
    }
  }

  // Case Status Priority
  if (normStatus === 'UNDER_INVESTIGATION' || normStatus === 'INVESTIGATING') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 ${className}`}>
        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> UNDER INVESTIGATION
      </span>
    );
  }

  if (normStatus === 'VERIFICATION_PENDING') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 ${className}`}>
        <AlertTriangle className="w-3.5 h-3.5" /> VERIFICATION PENDING
      </span>
    );
  }

  if (normStatus === 'UNRESOLVED') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700 ${className}`}>
        <Clock className="w-3.5 h-3.5" /> UNRESOLVED
      </span>
    );
  }

  if (normStatus === 'CONFIRMED_FRAUD') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 ${className}`}>
        <XCircle className="w-3.5 h-3.5" /> CONFIRMED FRAUD
      </span>
    );
  }

  if (normStatus === 'CLEARED') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 ${className}`}>
        <ShieldCheck className="w-3.5 h-3.5" /> CLEARED
      </span>
    );
  }

  if (normStatus === 'NEEDS_REVIEW' || normVerdict === 'NEEDS_REVIEW') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 ${className}`}>
        <AlertTriangle className="w-3.5 h-3.5" /> NEEDS REVIEW
      </span>
    );
  }

  if (normVerdict === 'DECLINED') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 ${className}`}>
        <XCircle className="w-3.5 h-3.5" /> DECLINED
      </span>
    );
  }

  if (normVerdict === 'APPROVED') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 ${className}`}>
        <CheckCircle2 className="w-3.5 h-3.5" /> APPROVED
      </span>
    );
  }

  if (normStatus === 'COMPLETED' || normStatus === 'CLOSED') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700 ${className}`}>
        <CheckCircle2 className="w-3.5 h-3.5" /> {normStatus}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700 ${className}`}>
      <HelpCircle className="w-3.5 h-3.5" /> {normStatus || 'PENDING'}
    </span>
  );
};

