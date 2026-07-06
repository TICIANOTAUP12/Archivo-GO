import { useState } from 'react';
import { DocumentsLibrary } from './components/documents/DocumentsLibrary';
import { IngestionPanel } from './components/ingest/IngestionPanel';
import { RecentDocuments } from './components/ingest/RecentDocuments';
import { Header } from './components/layout/Header';
import { MainContainer } from './components/layout/MainContainer';
import { SidebarNavigation, type AppSection } from './components/layout/SidebarNavigation';
import { SmartSearchArea } from './components/search/SmartSearchArea';
import { SettingsPanel } from './components/settings/SettingsPanel';
import { useRecentDocuments } from './hooks/useRecentDocuments';
import { useBackendBootstrap } from './hooks/useBackendBootstrap';
import { useAppUpdate } from './hooks/useAppUpdate';
import { UpdateBanner } from './components/settings/UpdateBanner';
import './App.css';

function App() {
  const { backendStatus, backendMessage, isBackendReady, retryBackend } = useBackendBootstrap();
  const {
    currentVersion,
    updateInfo,
    isCheckingUpdate,
    isInstallingUpdate,
    updateError,
    refreshUpdateCheck,
    installUpdate,
  } = useAppUpdate();
  const [activeSection, setActiveSection] = useState<AppSection>('search');
  const { recentDocuments, isRefreshing, refreshError, refreshRecentDocuments } =
    useRecentDocuments(isBackendReady);

  return (
    <div className="appFrame">
      <SidebarNavigation activeSection={activeSection} onSectionChange={setActiveSection} />
      <MainContainer>
        <UpdateBanner
          currentVersion={currentVersion}
          updateInfo={updateInfo}
          isCheckingUpdate={isCheckingUpdate}
          isInstallingUpdate={isInstallingUpdate}
          updateError={updateError}
          onRefresh={refreshUpdateCheck}
          onInstall={installUpdate}
        />
        {backendStatus !== 'ready' ? (
          <section className="backendBanner" data-status={backendStatus}>
            <p>{backendMessage}</p>
            {backendStatus === 'offline' ? (
              <button type="button" className="secondary compactButton" onClick={() => void retryBackend()}>
                Reintentar conexión
              </button>
            ) : null}
          </section>
        ) : null}

        {activeSection === 'search' ? (
          <>
            <Header />
            <SmartSearchArea isBackendReady={isBackendReady} />
          </>
        ) : null}

        {activeSection === 'ingest' ? (
          <section className="panelStack">
            <div className="sectionHero">
              <p className="eyebrow">Carga documental</p>
              <h1>Procesar archivo con IA</h1>
              <p className="heroText">
                Elegí la carpeta, tocá Procesar con IA y el sistema analiza, extrae datos y organiza el archivo digital.
              </p>
            </div>
            <section className="grid">
              <IngestionPanel
                isBackendReady={isBackendReady}
                onIngestComplete={refreshRecentDocuments}
                onRetryBackend={retryBackend}
              />
              <RecentDocuments
                documents={recentDocuments}
                isRefreshing={isRefreshing}
                refreshError={refreshError}
                onRefresh={refreshRecentDocuments}
              />
            </section>
          </section>
        ) : null}

        {activeSection === 'documents' ? <DocumentsLibrary isBackendReady={isBackendReady} /> : null}
        {activeSection === 'settings' ? <SettingsPanel /> : null}
      </MainContainer>
    </div>
  );
}

export default App;
