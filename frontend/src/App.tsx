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
    loadCases();
  }, []);

  const handleSelectCase = (caseId: string) => {
    setSelectedCaseId(caseId);
    setActiveTab('details');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          selectedCaseId={selectedCaseId}
        />

        <main className="flex-1 overflow-y-auto p-6 lg:p-8 bg-slate-950">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'dashboard' && (
              <Dashboard
                cases={cases}
                loading={loading}
                error={error}
                onRefresh={loadCases}
                onSelectCase={handleSelectCase}
              />
            )}

            {activeTab === 'cases' && (
              <Cases
                cases={cases}
                loading={loading}
                error={error}
                onRefresh={loadCases}
                onSelectCase={handleSelectCase}
              />
            )}

            {activeTab === 'details' && selectedCaseId && (
              <CaseDetails
                caseId={selectedCaseId}
                onBack={() => setActiveTab('cases')}
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
