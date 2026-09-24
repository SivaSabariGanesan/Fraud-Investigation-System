import React, { useState } from 'react';
import { Case } from '../types/investigation';
import { StatusBadge } from '../components/StatusBadge';
import { formatCurrency } from '../lib/utils';
import { Search, RefreshCw, ArrowRight, AlertCircle, SlidersHorizontal, Plus } from 'lucide-react';

interface CasesProps {
  cases: Case[];
  loading: boolean;
  error?: string | null;
  onRefresh: () => void;
  onSelectCase: (caseId: string) => void;
  onNewInvestigation?: () => void;
}

export const Cases: React.FC<CasesProps> = ({
  cases,
  loading,
  error,
  onRefresh,
  onSelectCase,
  onNewInvestigation,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [verdictFilter, setVerdictFilter] = useState('ALL');

  const filtered = cases.filter((c) => {
    const q = searchTerm.trim().toLowerCase();
    const matchSearch =
      !q ||
      c.case_id.toLowerCase().includes(q) ||
      (c.customer_id && c.customer_id.toLowerCase().includes(q)) ||
      (c.pattern && c.pattern.toLowerCase().includes(q));

    const matchStatus =
      statusFilter === 'ALL' || (c.status || '').toUpperCase() === statusFilter;

    const caseVerdict = (c.verdict || '').toUpperCase();
    const matchVerdict =
      verdictFilter === 'ALL' ||
      (verdictFilter === 'UNASSIGNED' ? !caseVerdict : caseVerdict === verdictFilter);

    return matchSearch && matchStatus && matchVerdict;
  });

  const selectStyle: React.CSSProperties = {
    background: 'var(--bg-base)',
    border: '1px solid var(--border-default)',
    color: 'var(--text-secondary)',
    borderRadius: 5,
    fontSize: 12,
    padding: '5px 10px',
    outline: 'none',
    cursor: 'pointer',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            Cases Directory
          </h1>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
            {filtered.length} of {cases.length} cases shown
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn btn-ghost" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
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
          <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={onRefresh}>
            Retry
          </button>
        </div>
      )}

      {/* Filter bar */}
      <div
        className="card"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
        }}
      >
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 180 }}>
          <Search
            className="w-3 h-3"
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}
          />
          <input
            type="text"
            placeholder="Search by Case ID, Customer, or Pattern…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-base"
            style={{ width: '100%', paddingLeft: 30, paddingRight: 12, paddingTop: 5, paddingBottom: 5 }}
          />
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 24, background: 'var(--border-default)', flexShrink: 0 }} />

        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <SlidersHorizontal className="w-3 h-3" style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={selectStyle}>
            <option value="ALL">All Statuses</option>
            <option value="UNDER_INVESTIGATION">Under Investigation</option>
            <option value="VERIFICATION_PENDING">Verification Pending</option>
            <option value="UNRESOLVED">Pending Initial</option>
            <option value="CONFIRMED_FRAUD">Confirmed Fraud</option>
            <option value="CLEARED">Cleared</option>
            <option value="NEEDS_REVIEW">Needs Review</option>
          </select>
          <select value={verdictFilter} onChange={(e) => setVerdictFilter(e.target.value)} style={selectStyle}>
            <option value="ALL">All Verdicts</option>
            <option value="APPROVED">Approved</option>
            <option value="DECLINED">Declined</option>
            <option value="NEEDS_REVIEW">Needs Review</option>
            <option value="UNASSIGNED">Unassigned</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--bg-raised)' }}>
                {['Case Ref', 'Customer', 'Status', 'Verdict', 'Pattern / Flag', 'Exposure', ''].map((h, i) => (
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
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {[90, 70, 110, 80, 160, 60, 40].map((w, j) => (
                      <td key={j} style={{ padding: '10px 14px' }}>
                        <div className="skeleton" style={{ height: 12, width: w, borderRadius: 3, marginLeft: j >= 5 ? 'auto' : 0 }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    style={{ padding: '48px 14px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}
                  >
                    No cases match the current filters.
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
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
                    <td
                      style={{
                        padding: '9px 14px',
                        fontSize: 11,
                        color: 'var(--text-secondary)',
                        maxWidth: 260,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {c.pattern || c.notes || (
                        <span style={{ color: 'var(--text-disabled)', fontStyle: 'italic' }}>No pattern flagged</span>
                      )}
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
