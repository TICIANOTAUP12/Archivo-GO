import { useState } from 'react';
import { DocumentsLibrary } from './components/documents/DocumentsLibrary';
import { IngestionPanel } from './components/ingest/IngestionPanel';
import { RecentDocuments } from './components/ingest/RecentDocuments';
import { Header } from './components/layout/Header';
import { MainContainer } from './components/layout/MainContainer';
import { SidebarNavigation, type AppSection } from './components/layout/SidebarNavigation';
import { SmartSearchArea } from './components/search/SmartSearchArea';
import { SettingsPanel } from './components/settings/SettingsPanel';
import { useBackendStatus } from './hooks/useBackendStatus';
import { useRecentDocuments } from './hooks/useRecentDocuments';
import './App.css';

function App() {
  const [activeSection, setActiveSection] = useState<AppSection>('search');
  const { backendStatus, backendMessage, isBackendReady, checkBackend, startBackend } = useBackendStatus();
  const { recentDocuments, isRefreshing, refreshError, refreshRecentDocuments } = useRecentDocuments(isBackendReady);

  return (
    <div className="appFrame">
      <SidebarNavigation activeSection={activeSection} onSectionChange={setActiveSection} />
      <MainContainer>
        {activeSection === 'search' ? (
          <>
            <Header
              backendStatus={backendStatus}
              backendMessage={backendMessage}
              onRetryBackend={checkBackend}
              onStartBackend={startBackend}
            />
            <SmartSearchArea isBackendReady={isBackendReady} />
          </>
        ) : null}

        {activeSection === 'ingest' ? (
          <section className="panelStack">
            <div className="sectionHero">
              <p className="eyebrow">Carga documental</p>
              <h1>Auditoría e ingesta</h1>
              <p className="heroText">
                Revisá costos antes de procesar y mandá documentos al pipeline de OCR, extracción e indexación.
              </p>
            </div>
            <section className="grid">
              <IngestionPanel isBackendReady={isBackendReady} onIngestComplete={refreshRecentDocuments} />
              <RecentDocuments
                documents={recentDocuments}
                isRefreshing={isRefreshing}
                refreshError={refreshError}
                onRefresh={refreshRecentDocuments}
              />
            </section>
          </section>
        ) : null}

        {activeSection === 'documents' ? <DocumentsLibrary /> : null}
        {activeSection === 'settings' ? <SettingsPanel /> : null}
      </MainContainer>
    </div>
  );
}

export default App;
