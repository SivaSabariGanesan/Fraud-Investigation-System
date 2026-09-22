import React from 'react';
import { Verdict, CaseStatus } from '../types/investigation';
import { RefreshCw } from 'lucide-react';

interface StatusBadgeProps {
  verdict?: Verdict | string | null;
  status?: CaseStatus | string | null;
  className?: string;
  showVerdict?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ verdict, status, className = '', showVerdict = false }) => {
  const normStatus = (status || '').toUpperCase();
  const normVerdict = (verdict || '').toUpperCase();

  // If explicit verdict is requested
  if (showVerdict && normVerdict) {
    if (normVerdict === 'APPROVED') {
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          Approved
        </span>
      );
    }
    if (normVerdict === 'DECLINED') {
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-300 border border-rose-500/20 ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
          Declined
        </span>
      );
    }
    if (normVerdict === 'NEEDS_REVIEW') {
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20 ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
          Needs Review
        </span>
      );
    }
  }

  // Active investigation execution
  if (normStatus === 'INVESTIGATING') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 ${className}`}>
        <RefreshCw className="w-3 h-3 animate-spin text-indigo-400" />
        Investigating...
      </span>
    );
  }

  if (normStatus === 'UNDER_INVESTIGATION') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
        Under Investigation
      </span>
    );
  }

  if (normStatus === 'VERIFICATION_PENDING') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20 ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
        Verification Pending
      </span>
    );
  }

  if (normStatus === 'CONFIRMED_FRAUD' || normVerdict === 'DECLINED') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-300 border border-rose-500/20 ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
        Confirmed Fraud
      </span>
    );
  }

  if (normStatus === 'CLEARED' || normVerdict === 'APPROVED') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
        Cleared
      </span>
    );
  }

  if (normStatus === 'NEEDS_REVIEW' || normVerdict === 'NEEDS_REVIEW') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20 ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
        Needs Review
      </span>
    );
  }

  if (normStatus === 'UNRESOLVED' || normStatus === 'PENDING') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700/60 ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
        Pending Review
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800/80 text-slate-300 border border-slate-700/60 ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
      {normStatus || 'Pending'}
    </span>
  );
};
