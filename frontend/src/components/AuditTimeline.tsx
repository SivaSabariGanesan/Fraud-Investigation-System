import React from 'react';
import { AuditEventItem } from '../types/investigation';
import { formatDate } from '../lib/utils';
import {
  PlayCircle, Database, BrainCircuit, Scale, CheckCircle2, AlertCircle,
  FileQuestion, MessageSquare, XCircle, User, Bot, Cpu, Send,
} from 'lucide-react';

interface AuditTimelineProps {
  events: AuditEventItem[];
}

const EVENT_CONFIG: Record<string, { icon: React.ReactNode; color: string }> = {
  INVESTIGATION_STARTED:                       { icon: <PlayCircle className="w-3.5 h-3.5" />,   color: 'var(--accent)' },
  INVESTIGATION_STARTED_FROM_EVIDENCE_RESPONSE:{ icon: <PlayCircle className="w-3.5 h-3.5" />,   color: 'var(--accent)' },
  EVIDENCE_COLLECTED:                          { icon: <Database className="w-3.5 h-3.5" />,      color: 'var(--success)' },
  EVIDENCE_REQUEST_CREATED:                    { icon: <FileQuestion className="w-3.5 h-3.5" />,  color: 'var(--warn)' },
  EVIDENCE_REQUEST_RESPONDED:                  { icon: <MessageSquare className="w-3.5 h-3.5" />, color: 'var(--success)' },
  EVIDENCE_REQUEST_CANCELLED:                  { icon: <XCircle className="w-3.5 h-3.5" />,       color: 'var(--text-muted)' },
  LLM_REASONING_COMPLETED:                     { icon: <BrainCircuit className="w-3.5 h-3.5" />,  color: '#7c3aed' },
  POLICY_EVALUATED:                            { icon: <Scale className="w-3.5 h-3.5" />,         color: 'var(--accent)' },
  DECISION_GENERATED:                          { icon: <CheckCircle2 className="w-3.5 h-3.5" />,  color: 'var(--accent)' },
  INVESTIGATION_COMPLETED:                     { icon: <CheckCircle2 className="w-3.5 h-3.5" />,  color: 'var(--success)' },
  INVESTIGATION_FAILED:                        { icon: <AlertCircle className="w-3.5 h-3.5" />,   color: 'var(--danger)' },
  CASE_OPENED:                                 { icon: <PlayCircle className="w-3.5 h-3.5" />,    color: 'var(--accent)' },
};

const DEFAULT_EVENT = { icon: <Send className="w-3.5 h-3.5" />, color: 'var(--text-muted)' };

function ActorBadge({ actor }: { actor: string }) {
  const norm = (actor || '').toUpperCase();
  if (norm === 'AGENT')
    return (
      <span className="pill" style={{ background: 'var(--accent-subtle)', color: 'var(--accent-text)', borderColor: 'var(--accent-border)', fontSize: 10 }}>
        <Bot className="w-2.5 h-2.5" /> AGENT
      </span>
    );
  if (norm === 'SYSTEM')
    return (
      <span className="pill" style={{ background: 'var(--bg-overlay)', color: 'var(--text-secondary)', borderColor: 'var(--border-default)', fontSize: 10 }}>
        <Cpu className="w-2.5 h-2.5" /> SYSTEM
      </span>
    );
  return (
    <span className="pill" style={{ background: 'rgba(124,58,237,0.07)', color: '#7c3aed', borderColor: 'rgba(124,58,237,0.2)', fontSize: 10 }}>
      <User className="w-2.5 h-2.5" /> ANALYST
    </span>
  );
}

export const AuditTimeline: React.FC<AuditTimelineProps> = ({ events }) => {
  if (!events || events.length === 0) {
    return (
      <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '16px 0', textAlign: 'center' }}>
        No audit events recorded.
      </p>
    );
  }

  return (
    <div style={{ position: 'relative', paddingLeft: 28 }}>
      {/* Vertical line */}
      <div
        style={{
          position: 'absolute',
          left: 11,
          top: 10,
          bottom: 10,
          width: 1,
          background: 'var(--border-default)',
        }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {events.map((event) => {
          const cfg = EVENT_CONFIG[event.event_type] ?? DEFAULT_EVENT;
          return (
            <div key={event.id} style={{ position: 'relative' }}>
              {/* Icon node */}
              <div
                style={{
                  position: 'absolute',
                  left: -28,
                  top: 0,
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: cfg.color,
                  flexShrink: 0,
                }}
              >
                {cfg.icon}
              </div>

              {/* Event label row */}
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                  {event.event_type.replace(/_/g, ' ')}
                </span>
                <ActorBadge actor={event.actor} />
                <span style={{ marginLeft: 'auto', fontSize: 10, fontFamily: 'monospace', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {formatDate(event.created_at)}
                </span>
              </div>

              {/* Description */}
              {event.description && (
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                    padding: '8px 10px',
                    background: 'var(--bg-raised)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 4,
                  }}
                >
                  {event.description}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
