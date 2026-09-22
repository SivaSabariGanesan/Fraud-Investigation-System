import React from 'react';
import { LayoutDashboard, ShieldCheck, Database, Cpu } from 'lucide-react';

interface SidebarProps {
  activeTab: 'dashboard' | 'cases' | 'details';
  onNavigateDashboard: () => void;
  onNavigateCases: () => void;
  onNavigateDetails: (caseId?: string) => void;
  selectedCaseId: string | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onNavigateDashboard,
  onNavigateCases,
  onNavigateDetails,
  selectedCaseId,
}) => {
  return (
    <aside
      className="w-56 shrink-0 hidden md:flex flex-col justify-between select-none"
      style={{
        background: 'var(--bg-base)',
        borderRight: '1px solid var(--border-default)',
        padding: '16px 0',
      }}
    >
      <div className="flex flex-col gap-6">
        {/* Navigation */}
        <div>
          <p className="section-label px-4 mb-2">Navigation</p>
          <nav className="flex flex-col gap-0.5 px-2">
            <NavItem
              icon={<LayoutDashboard className="w-3.5 h-3.5" />}
              label="Overview"
              active={activeTab === 'dashboard'}
              onClick={onNavigateDashboard}
            />
            <NavItem
              icon={<ShieldCheck className="w-3.5 h-3.5" />}
              label="Cases Directory"
              active={activeTab === 'cases'}
              onClick={onNavigateCases}
            />
          </nav>
        </div>

        {/* Active Case */}
        {selectedCaseId && (
          <div>
            <p className="section-label px-4 mb-2">Active Case</p>
            <div className="mx-2 rounded" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', padding: '10px 12px' }}>
              <p className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>Case Ref</p>
              <p className="font-mono text-[11px] font-semibold mb-2.5 truncate" style={{ color: 'var(--accent-text)' }}>
                {selectedCaseId}
              </p>
              <button
                onClick={() => onNavigateDetails(selectedCaseId)}
                className="btn w-full justify-center"
                style={
                  activeTab === 'details'
                    ? { background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent-hover)' }
                    : { background: 'var(--bg-overlay)', color: 'var(--text-secondary)', borderColor: 'var(--border-strong)' }
                }
              >
                Open Workbench
              </button>
            </div>
          </div>
        )}

        {/* Services */}
        <div>
          <p className="section-label px-4 mb-2">Services</p>
          <div className="px-4 flex flex-col gap-2">
            <ServiceRow
              icon={<Database className="w-3 h-3" style={{ color: 'var(--accent-text)' }} />}
              label="Graph Engine"
              value="TigerGraph"
            />
            <ServiceRow
              icon={<Cpu className="w-3 h-3" style={{ color: '#7c3aed' }} />}
              label="Reasoning"
              value="Groq 120B"
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        className="px-4 text-[10px] font-mono"
        style={{ color: 'var(--text-disabled)', paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}
      >
        Sentinel v1.2
      </div>
    </aside>
  );
};

function NavItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 rounded text-[12px] font-medium transition-colors"
      style={{
        padding: '7px 10px',
        background: active ? 'var(--accent-subtle)' : 'transparent',
        color: active ? 'var(--accent-text)' : 'var(--text-secondary)',
        border: active ? '1px solid var(--accent-border)' : '1px solid transparent',
        textAlign: 'left',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-raised)';
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)';
        }
      }}
    >
      <span style={{ color: active ? 'var(--accent-text)' : 'var(--text-muted)' }}>{icon}</span>
      {label}
    </button>
  );
}

function ServiceRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
        {icon}
        {label}
      </span>
      <span className="font-mono text-[10px]" style={{ color: 'var(--text-secondary)' }}>
        {value}
      </span>
    </div>
  );
}
