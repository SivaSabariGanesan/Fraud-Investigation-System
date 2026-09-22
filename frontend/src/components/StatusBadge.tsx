import React from 'react';
import { RefreshCw } from 'lucide-react';
import { Verdict, CaseStatus } from '../types/investigation';

interface StatusBadgeProps {
  verdict?: Verdict | string | null;
  status?: CaseStatus | string | null;
  className?: string;
  showVerdict?: boolean;
}

type PillVariant = 'blue' | 'red' | 'amber' | 'green' | 'gray';

const VARIANT_STYLES: Record<PillVariant, React.CSSProperties> = {
  blue: {
    background: 'var(--accent-subtle)',
    color: 'var(--accent-text)',
    borderColor: 'var(--accent-border)',
  },
  red: {
    background: 'var(--danger-subtle)',
    color: 'var(--danger-text)',
    borderColor: 'var(--danger-border)',
  },
  amber: {
    background: 'var(--warn-subtle)',
    color: 'var(--warn-text)',
    borderColor: 'var(--warn-border)',
  },
  green: {
    background: 'var(--success-subtle)',
    color: 'var(--success-text)',
    borderColor: 'var(--success-border)',
  },
  gray: {
    background: 'var(--bg-raised)',
    color: 'var(--text-secondary)',
    borderColor: 'var(--border-default)',
  },
};

function Pill({
  variant,
  dot,
  spin,
  children,
  className,
}: {
  variant: PillVariant;
  dot?: boolean;
  spin?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const styles = VARIANT_STYLES[variant];
  return (
    <span className={`pill ${className ?? ''}`} style={styles}>
      {spin ? (
        <RefreshCw className="w-2.5 h-2.5 animate-spin" />
      ) : dot ? (
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: styles.color as string, flexShrink: 0 }}
        />
      ) : null}
      {children}
    </span>
  );
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  verdict,
  status,
  className = '',
  showVerdict = false,
}) => {
  const normStatus = (status || '').toUpperCase();
  const normVerdict = (verdict || '').toUpperCase();

  // Explicit verdict display
  if (showVerdict && normVerdict) {
    if (normVerdict === 'APPROVED')
      return <Pill variant="green" dot className={className}>Approved</Pill>;
    if (normVerdict === 'DECLINED')
      return <Pill variant="red" dot className={className}>Declined</Pill>;
    if (normVerdict === 'NEEDS_REVIEW')
      return <Pill variant="amber" dot className={className}>Needs Review</Pill>;
  }

  // Status-based
  if (normStatus === 'INVESTIGATING')
    return <Pill variant="blue" spin className={className}>Investigating</Pill>;

  if (normStatus === 'UNDER_INVESTIGATION')
    return <Pill variant="blue" dot className={className}>Under Investigation</Pill>;

  if (normStatus === 'VERIFICATION_PENDING')
    return <Pill variant="amber" dot className={className}>Verification Pending</Pill>;

  if (normStatus === 'CONFIRMED_FRAUD' || normVerdict === 'DECLINED')
    return <Pill variant="red" dot className={className}>Confirmed Fraud</Pill>;

  if (normStatus === 'CLEARED' || normVerdict === 'APPROVED')
    return <Pill variant="green" dot className={className}>Cleared</Pill>;

  if (normStatus === 'NEEDS_REVIEW' || normVerdict === 'NEEDS_REVIEW')
    return <Pill variant="amber" dot className={className}>Needs Review</Pill>;

  if (normStatus === 'UNRESOLVED' || normStatus === 'PENDING')
    return <Pill variant="gray" dot className={className}>Pending Review</Pill>;

  return (
    <Pill variant="gray" dot className={className}>
      {normStatus || 'Pending'}
    </Pill>
  );
};
