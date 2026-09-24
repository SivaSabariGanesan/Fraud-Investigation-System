import React from 'react';
import { Case } from '../types/investigation';
import { StatusBadge } from '../components/StatusBadge';
import { formatCurrency, formatDate } from '../lib/utils';
import { RefreshCw, ArrowRight, AlertCircle, Plus } from 'lucide-react';

interface DashboardProps {
  cases: Case[];
  loading: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onSelectCase: (caseId: string) => void;
  onNewInvestigation?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  cases,
  loading,
  error,
  onRefresh,
  onSelectCase,
  onNewInvestigation,
}) => {
  const totalCases = cases.length;
  const underInvestigation = cases.filter(
    (c) => c.status === 'UNDER_INVESTIGATION' || c.status === 'INVESTIGATING',
  ).length;
  const pendingVerification = cases.filter(
    (c) => c.status === 'VERIFICATION_PENDING' || c.verdict === 'NEEDS_REVIEW',
  ).length;
  const unresolved = cases.filter(
    (c) => c.status === 'UNRESOLVED' || c.status === 'PENDING',
  ).length;
  const confirmedFraud = cases.filter(
    (c) => c.status === 'CONFIRMED_FRAUD' || c.verdict === 'DECLINED',
  ).length;
  const totalExposure = cases.reduce((sum, c) => sum + (c.exposure || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Operations Overview Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            Operations Overview
          </h1>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
            Real-time fraud cases and agent investigation status
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {onRefresh && (
            <button className="btn btn-ghost" onClick={onRefresh} disabled={loading}>
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          )}
          {onNewInvestigation && (
            <button className="btn btn-primary" onClick={onNewInvestigation}>
              <Plus className="w-3.5 h-3.5" />
              New Investigation
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '10px 14px',
            background: 'var(--danger-subtle)',
            border: '1px solid var(--danger-border)',
            borderRadius: 6,
            fontSize: 12,
            color: 'var(--danger-text)',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500 }}>
            <AlertCircle className="w-4 h-4" style={{ flexShrink: 0 }} />
            {error}
          </span>
          {onRefresh && (
            <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={onRefresh}>
              Retry
            </button>
          )}
        </div>
      )}

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
        <StatCard
          label="Total Cases"
          value={loading ? '—' : totalCases}
          accentClass="stat-accent-gray"
        />
        <StatCard
          label="Under Review"
          value={loading ? '—' : underInvestigation}
          accentClass="stat-accent-blue"
          valueColor="var(--accent-text)"
        />
        <StatCard
          label="Pending Verification"
          value={loading ? '—' : pendingVerification}
          accentClass="stat-accent-amber"
          valueColor="var(--warn-text)"
        />
        <StatCard
          label="Unresolved"
          value={loading ? '—' : unresolved}
          accentClass="stat-accent-gray"
        />
        <StatCard
          label="Confirmed Fraud"
          value={loading ? '—' : confirmedFraud}
          accentClass="stat-accent-red"
          valueColor="var(--danger-text)"
          sub={loading ? undefined : formatCurrency(totalExposure) + ' exposure'}
        />
      </div>

      {/* Investigations table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-default)',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            Active Investigations
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            {cases.length} records
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--bg-raised)' }}>
                {['Case Ref', 'Customer', 'Status', 'Verdict', 'Created', 'Exposure', ''].map((h, i) => (
                  <th
                    key={i}
                    style={{
                      padding: '8px 14px',
                      textAlign: i >= 5 ? 'right' : 'left',
                      fontWeight: 500,
                      fontSize: 10,
                      letterSpacing: '0.07em',
                      textTransform: 'uppercase',
                      color: 'var(--text-muted)',
                      borderBottom: '1px solid var(--border-default)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} style={{ padding: '10px 14px' }}>
                        <div className="skeleton" style={{ height: 12, width: j === 0 ? 90 : j === 4 ? 80 : 60, borderRadius: 3 }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : cases.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      padding: '40px 14px',
                      textAlign: 'center',
                      color: 'var(--text-muted)',
                      fontSize: 12,
                    }}
                  >
                    No investigation cases recorded.
                  </td>
                </tr>
              ) : (
                cases.map((c) => (
                  <tr
                    key={c.case_id}
                    onClick={() => onSelectCase(c.case_id)}
                    className="row-hover"
                    style={{
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--border-subtle)',
                      transition: 'background 0.1s',
                    }}
                  >
                    <td className="id-chip" style={{ padding: '9px 14px' }}>
                      {c.case_id}
                    </td>
                    <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontSize: 11, color: 'var(--text-secondary)' }}>
                      {c.customer_id || `CUST-${c.case_id}`}
                    </td>
                    <td style={{ padding: '9px 14px' }}>
                      <StatusBadge status={c.status} verdict={c.verdict} />
                    </td>
                    <td style={{ padding: '9px 14px' }}>
                      {c.verdict ? (
                        <StatusBadge verdict={c.verdict} showVerdict />
                      ) : (
                        <span style={{ color: 'var(--text-disabled)', fontFamily: 'monospace', fontSize: 11 }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {c.created_at ? formatDate(c.created_at) : '—'}
                    </td>
                    <td style={{ padding: '9px 14px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>
                      {formatCurrency(c.exposure)}
                    </td>
                    <td style={{ padding: '9px 14px', textAlign: 'right' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); onSelectCase(c.case_id); }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 11,
                          fontWeight: 500,
                          color: 'var(--accent-text)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        Open
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/* ── Stat Card ───────────────────────────────────────────── */

function StatCard({
  label,
  value,
  accentClass,
  valueColor,
  sub,
}: {
  label: string;
  value: string | number;
  accentClass: string;
  valueColor?: string;
  sub?: string;
}) {
  return (
    <div
      className={`card ${accentClass}`}
      style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}
    >
      <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
        {label}
      </span>
      <span
        style={{
          fontSize: 22,
          fontWeight: 700,
          fontFamily: 'JetBrains Mono, monospace',
          color: valueColor || 'var(--text-primary)',
          letterSpacing: '-0.02em',
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      {sub && (
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
          {sub}
        </span>
      )}
    </div>
  );
}
