import { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { Cases } from './pages/Cases';
import { CaseDetails } from './pages/CaseDetails';
import { Case } from './types/investigation';
import { apiService } from './services/api';

export function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'cases' | 'details'>('dashboard');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Sync state with URL path
  const syncRouteWithState = () => {
    const path = window.location.pathname;
    if (path.startsWith('/cases/')) {
      const caseId = decodeURIComponent(path.replace('/cases/', ''));
      if (caseId) {
        setSelectedCaseId(caseId);
        setActiveTab('details');
        return;
      }
    }
    if (path.startsWith('/cases')) {
      setActiveTab('cases');
      return;
    }
    setActiveTab('dashboard');
  };

  const loadCases = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getCases();
      setCases(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to connect to investigation service.';
      setError(msg);
      setCases([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    syncRouteWithState();
    loadCases();

    const handlePopState = () => {
      syncRouteWithState();
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateToDashboard = () => {
    setActiveTab('dashboard');
    window.history.pushState({}, '', '/dashboard');
  };

  const navigateToCases = () => {
    setActiveTab('cases');
    window.history.pushState({}, '', '/cases');
  };

  const navigateToCaseDetails = (caseId: string) => {
    setSelectedCaseId(caseId);
    setActiveTab('details');
    window.history.pushState({}, '', `/cases/${caseId}`);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column' }}>
      <Navbar onSearchCase={navigateToCaseDetails} />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar
          activeTab={activeTab}
          onNavigateDashboard={navigateToDashboard}
          onNavigateCases={navigateToCases}
          onNavigateDetails={(id) => navigateToCaseDetails(id || selectedCaseId || '')}
          selectedCaseId={selectedCaseId}
        />

        <main style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', background: 'var(--bg-base)' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto' }}>
            {activeTab === 'dashboard' && (
              <Dashboard
                cases={cases}
                loading={loading}
                error={error}
                onRefresh={loadCases}
                onSelectCase={navigateToCaseDetails}
              />
            )}

            {activeTab === 'cases' && (
              <Cases
                cases={cases}
                loading={loading}
                error={error}
                onRefresh={loadCases}
                onSelectCase={navigateToCaseDetails}
              />
            )}

            {activeTab === 'details' && selectedCaseId && (
              <CaseDetails
                caseId={selectedCaseId}
                onBack={navigateToCases}
                onCaseUpdated={loadCases}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
