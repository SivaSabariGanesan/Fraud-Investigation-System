import React from 'react';
import { ShieldAlert, Network, Cpu, Zap, Plus, RefreshCw, CheckCircle2, Activity } from 'lucide-react';

interface HeroSectionProps {
  totalCases: number;
  totalExposure: number;
  underReview: number;
  confirmedFraud: number;
  loading: boolean;
  onNewInvestigation?: () => void;
  onRefresh?: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  totalCases,
  totalExposure,
  underReview,
  confirmedFraud,
  loading,
  onNewInvestigation,
  onRefresh,
}) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 12,
        padding: '28px 32px',
        background: 'linear-gradient(135deg, #02050b 0%, #0c121e 50%, #02050b 100%)',
        border: '1px solid rgba(255, 103, 0, 0.3)',
        boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.7), 0 0 30px 0 rgba(255, 103, 0, 0.12)',
        overflow: 'hidden',
        color: '#f8fafc',
      }}
    >
      {/* Background Decorative TigerGraph Radial Glows */}
      <div
        style={{
          position: 'absolute',
          top: '-30%',
          right: '-10%',
          width: '450px',
          height: '450px',
          background: 'radial-gradient(circle, rgba(255, 103, 0, 0.18) 0%, rgba(49, 142, 208, 0.08) 50%, transparent 70%)',
          pointerEvents: 'none',
          filter: 'blur(45px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-40%',
          left: '-5%',
          width: '350px',
          height: '350px',
          background: 'radial-gradient(circle, rgba(49, 142, 208, 0.15) 0%, rgba(254, 186, 18, 0.05) 50%, transparent 70%)',
          pointerEvents: 'none',
          filter: 'blur(45px)',
        }}
      />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>
        
        {/* Top Badges Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 600,
                background: 'rgba(255, 103, 0, 0.14)',
                color: '#ff6700',
                border: '1px solid rgba(255, 103, 0, 0.35)',
                letterSpacing: '0.03em',
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#ff6700',
                  boxShadow: '0 0 8px #ff6700',
                  animation: 'pulse 2s infinite',
                }}
              />
              TigerGraph RESTPP Active
            </span>

            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 600,
                background: 'rgba(49, 142, 208, 0.14)',
                color: '#8cbee0',
                border: '1px solid rgba(49, 142, 208, 0.35)',
                letterSpacing: '0.03em',
              }}
            >
              <Cpu className="w-3 h-3" />
              Groq 120B AI Reasoning
            </span>

            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 600,
                background: 'rgba(254, 186, 18, 0.14)',
                color: '#feba12',
                border: '1px solid rgba(254, 186, 18, 0.35)',
                letterSpacing: '0.03em',
              }}
            >
              <CheckCircle2 className="w-3 h-3" />
              R1–R10 Policy Rules Engine
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={loading}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 14px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 500,
                  background: 'rgba(255, 255, 255, 0.06)',
                  color: '#e2e8f0',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh Engine
              </button>
            )}

            {onNewInvestigation && (
              <button
                onClick={onNewInvestigation}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 16px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  background: 'linear-gradient(135deg, #ff6700 0%, #d85200 100%)',
                  color: '#ffffff',
                  border: 'none',
                  boxShadow: '0 4px 14px 0 rgba(255, 103, 0, 0.4)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Plus className="w-4 h-4" />
                + New Investigation
              </button>
            )}
          </div>
        </div>

        {/* Hero Title & Subtitle */}
        <div style={{ maxWidth: 840 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 26,
              fontWeight: 700,
              lineHeight: 1.25,
              letterSpacing: '-0.02em',
              background: 'linear-gradient(180deg, #ffffff 0%, #8cbee0 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Autonomous AI Fraud Intelligence & Graph Reasoning System
          </h1>
          <p
            style={{
              margin: '10px 0 0',
              fontSize: 13.5,
              lineHeight: 1.6,
              color: '#818588',
              fontWeight: 400,
            }}
          >
            Real-time graph-grounded investigation orchestrator powered by <strong style={{ color: '#ff6700', fontWeight: 600 }}>TigerGraph</strong> entity resolution, executing 12-step deep fraud analysis, automated multi-hop evidence synthesis, deterministic R1–R10 policy evaluation, and FinCEN SAR compliance.
          </p>
        </div>

        {/* Highlights Row / Quick Stats */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 14,
            marginTop: 4,
          }}
        >
          <div
            style={{
              padding: '14px 16px',
              borderRadius: 8,
              background: 'rgba(240, 242, 243, 0.04)',
              border: '1px solid rgba(255, 103, 0, 0.18)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: 'rgba(255, 103, 0, 0.15)',
                color: '#ff6700',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Network className="w-5 h-5" />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#818588', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Benchmark Suite
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#ffffff', marginTop: 1 }}>
                {totalCases} HHG Cases
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '14px 16px',
              borderRadius: 8,
              background: 'rgba(240, 242, 243, 0.04)',
              border: '1px solid rgba(254, 186, 18, 0.18)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: 'rgba(254, 186, 18, 0.15)',
                color: '#feba12',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#818588', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Total Exposure
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#ffffff', marginTop: 1 }}>
                {formatCurrency(totalExposure)}
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '14px 16px',
              borderRadius: 8,
              background: 'rgba(240, 242, 243, 0.04)',
              border: '1px solid rgba(49, 142, 208, 0.18)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: 'rgba(49, 142, 208, 0.15)',
                color: '#318ed0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#818588', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Active Audits
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#ffffff', marginTop: 1 }}>
                {underReview} Under Review
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '14px 16px',
              borderRadius: 8,
              background: 'rgba(240, 242, 243, 0.04)',
              border: '1px solid rgba(255, 103, 0, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: 'rgba(255, 103, 0, 0.18)',
                color: '#ff6700',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#818588', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Fraud Prevention
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#ffffff', marginTop: 1 }}>
                {confirmedFraud} Flagged / Declined
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
