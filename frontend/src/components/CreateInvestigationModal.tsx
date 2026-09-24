import React, { useState } from 'react';
import { apiService } from '../services/api';
import { ManualCaseCreatePayload } from '../types/investigation';
import { X, RefreshCw, PlusCircle, AlertCircle } from 'lucide-react';

interface CreateInvestigationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (caseId: string) => void;
}

export const CreateInvestigationModal: React.FC<CreateInvestigationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState<ManualCaseCreatePayload>({
    case_id: '',
    customer_id: '',
    transaction_id: '',
    amount: undefined,
    trigger_type: 'customer_report',
    trigger_text: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const caseId = formData.case_id.trim();
    const transactionId = formData.transaction_id.trim();
    const triggerType = formData.trigger_type;
    const triggerText = formData.trigger_text.trim();
    const customerId = formData.customer_id?.trim() || undefined;

    // Validation
    if (!caseId) {
      setError('Case ID is required.');
      return;
    }
    if (!transactionId) {
      setError('Transaction ID is required.');
      return;
    }
    if (!triggerType) {
      setError('Trigger Type is required.');
      return;
    }
    if (!triggerText) {
      setError('Customer Report / Analyst Notes is required.');
      return;
    }

    setLoading(true);

    try {
      const payload: ManualCaseCreatePayload = {
        case_id: caseId,
        customer_id: customerId,
        transaction_id: transactionId,
        amount: formData.amount !== undefined && formData.amount !== null && !isNaN(Number(formData.amount))
          ? Number(formData.amount)
          : undefined,
        trigger_type: triggerType,
        trigger_text: triggerText,
      };

      const result = await apiService.createManualCase(payload);
      setLoading(false);
      onClose();
      onSuccess(result.case_id);
    } catch (err: any) {
      setLoading(false);
      const serverMsg = err?.response?.data?.detail || err?.message || 'Failed to create manual investigation.';
      setError(serverMsg);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--bg-base)',
    border: '1px solid var(--border-default)',
    borderRadius: 5,
    fontSize: 12,
    color: 'var(--text-primary)',
    padding: '7px 10px',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.04em',
    color: 'var(--text-muted)',
    marginBottom: 4,
    textTransform: 'uppercase',
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 560,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-strong)',
          borderRadius: 8,
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: '1px solid var(--border-default)',
            background: 'var(--bg-raised)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <PlusCircle className="w-4 h-4" style={{ color: 'var(--accent-text)' }} />
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
              Create Investigation
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="btn btn-ghost"
            style={{ padding: '4px 8px' }}
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 12px',
                background: 'var(--danger-subtle)',
                border: '1px solid var(--danger-border)',
                borderRadius: 5,
                fontSize: 12,
                color: 'var(--danger-text)',
              }}
            >
              <AlertCircle className="w-4 h-4" style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>
                Case ID <span style={{ color: 'var(--danger-text)' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. DEMO-001"
                value={formData.case_id}
                onChange={(e) => setFormData({ ...formData, case_id: e.target.value })}
                disabled={loading}
                style={inputStyle}
                required
              />
            </div>

            <div>
              <label style={labelStyle}>Customer ID (Optional)</label>
              <input
                type="text"
                placeholder="e.g. C08623"
                value={formData.customer_id || ''}
                onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                disabled={loading}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>
                Transaction ID <span style={{ color: 'var(--danger-text)' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. 3530164"
                value={formData.transaction_id}
                onChange={(e) => setFormData({ ...formData, transaction_id: e.target.value })}
                disabled={loading}
                style={inputStyle}
                required
              />
            </div>

            <div>
              <label style={labelStyle}>Transaction Amount (Optional)</label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 49.00"
                value={formData.amount !== undefined ? formData.amount : ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    amount: e.target.value !== '' ? parseFloat(e.target.value) : undefined,
                  })
                }
                disabled={loading}
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>
              Trigger Type <span style={{ color: 'var(--danger-text)' }}>*</span>
            </label>
            <select
              value={formData.trigger_type}
              onChange={(e) => setFormData({ ...formData, trigger_type: e.target.value })}
              disabled={loading}
              style={{ ...inputStyle, cursor: 'pointer' }}
              required
            >
              <option value="customer_report">customer_report</option>
              <option value="fraud_signal">fraud_signal</option>
              <option value="analyst_review">analyst_review</option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>
              Customer Report / Analyst Notes <span style={{ color: 'var(--danger-text)' }}>*</span>
            </label>
            <textarea
              rows={4}
              placeholder="e.g. I never made this $49.00 purchase. Please investigate."
              value={formData.trigger_text}
              onChange={(e) => setFormData({ ...formData, trigger_text: e.target.value })}
              disabled={loading}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
              required
            />
          </div>

          {/* Footer Buttons */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 10,
              marginTop: 6,
              paddingTop: 14,
              borderTop: '1px solid var(--border-default)',
            }}
          >
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Starting investigation...
                </>
              ) : (
                'Start Investigation'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
