import React from 'react';
import { AuditEventItem } from '../types/investigation';
import {
  PlayCircle,
  Database,
  BrainCircuit,
  Scale,
  CheckCircle2,
  AlertCircle,
  FileQuestion,
  User,
  Bot,
  Cpu,
} from 'lucide-react';

interface AuditTimelineProps {
  events: AuditEventItem[];
  className?: string;
}

export const AuditTimeline: React.FC<AuditTimelineProps> = ({ events, className = '' }) => {
  if (!events || events.length === 0) {
    return (
      <div className={`p-4 text-center text-sm text-slate-400 bg-slate-900/50 rounded-lg border border-slate-800 ${className}`}>
        No audit log events recorded for this case.
      </div>
    );
  }

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'INVESTIGATION_STARTED':
        return <PlayCircle className="w-4 h-4 text-cyan-400" />;
      case 'EVIDENCE_COLLECTED':
        return <Database className="w-4 h-4 text-emerald-400" />;
      case 'EVIDENCE_REQUEST_CREATED':
        return <FileQuestion className="w-4 h-4 text-amber-400" />;
      case 'LLM_REASONING_COMPLETED':
        return <BrainCircuit className="w-4 h-4 text-purple-400" />;
      case 'POLICY_EVALUATED':
        return <Scale className="w-4 h-4 text-indigo-400" />;
      case 'DECISION_GENERATED':
        return <CheckCircle2 className="w-4 h-4 text-blue-400" />;
      case 'INVESTIGATION_COMPLETED':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'INVESTIGATION_FAILED':
        return <AlertCircle className="w-4 h-4 text-rose-400" />;
      case 'CASE_OPENED':
        return <PlayCircle className="w-4 h-4 text-sky-400" />;
      default:
        return <PlayCircle className="w-4 h-4 text-slate-400" />;
    }
  };

  const getActorBadge = (actor: string) => {
    const norm = (actor || '').toUpperCase();
    if (norm === 'AGENT') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
          <Bot className="w-3 h-3" /> AGENT
        </span>
      );
    }
    if (norm === 'SYSTEM') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
          <Cpu className="w-3 h-3" /> SYSTEM
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
        <User className="w-3 h-3" /> ANALYST
      </span>
    );
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="relative pl-6 border-l border-slate-800 space-y-6">
        {events.map((event) => (
          <div key={event.id} className="relative group">
            {/* Timeline Dot */}
            <div className="absolute -left-[31px] top-0.5 w-6 h-6 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center shadow-sm">
              {getEventIcon(event.event_type)}
            </div>

            {/* Event Header */}
            <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs text-slate-200 tracking-wide uppercase">
                  {event.event_type.replace(/_/g, ' ')}
                </span>
                {getActorBadge(event.actor)}
              </div>
              <span className="text-[11px] text-slate-500 font-mono">
                {formatDate(event.created_at)}
              </span>
            </div>

            {/* Event Description */}
            {event.description && (
              <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-2.5 rounded-md border border-slate-800/80">
                {event.description}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
