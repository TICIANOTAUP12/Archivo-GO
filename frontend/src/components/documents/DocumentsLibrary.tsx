import { useMemo, useState } from 'react';
import { openDocumentFile } from '../../api/native';
import { useDocumentsLibrary, type DocumentFilter } from '../../hooks/useDocumentsLibrary';
import type { DocumentStatus, RecentDocument } from '../../types';

const statusLabels: Record<DocumentStatus, string> = {
  pending: 'Pendientes',
  processing: 'Procesando',
  indexed: 'Procesados',
  needs_review: 'Para revisar',
  failed: 'Fallidos',
};

const filterOptions: Array<{ value: DocumentFilter; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'indexed', label: 'Procesados' },
  { value: 'needs_review', label: 'Para revisar' },
  { value: 'processing', label: 'Procesando' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'failed', label: 'Fallidos' },
];

type DocumentsLibraryProps = {
  isBackendReady: boolean;
};

export function DocumentsLibrary({ isBackendReady }: DocumentsLibraryProps) {
  const {
    documents,
    activeFilter,
    isLoadingDocuments,
    documentsError,
    totalsByStatus,
    setActiveFilter,
    refreshDocuments,
  } = useDocumentsLibrary(isBackendReady);
  const [documentQuery, setDocumentQuery] = useState<string>('');
  const normalizedQuery = documentQuery.trim().toLocaleLowerCase('es');

  const filteredDocuments = useMemo(() => {
    if (!normalizedQuery) return documents;
    return documents.filter((document) => {
      const searchableText = `${document.filename} ${document.source_path} ${document.status}`.toLocaleLowerCase('es');
      return searchableText.includes(normalizedQuery);
    });
  }, [documents, normalizedQuery]);

  const totalDocuments = Object.values(totalsByStatus).reduce((total, current) => total + current, 0);

  function getFilterCount(filter: DocumentFilter): number {
    if (filter === 'all') return totalDocuments;
    return totalsByStatus[filter];
  }

  return (
    <section className="panelStack">
      <div className="sectionHero">
        <p className="eyebrow">Biblioteca</p>
        <h1>Documentos procesados</h1>
        <p className="heroText">
          Revisá todo lo que entró al sistema, filtrá por estado y abrí el archivo original cuando haga falta.
        </p>
      </div>

      <section className="card">
        <div className="sectionHeader">
          <div>
            <h2>Categorías</h2>
            <p className="muted">{totalDocuments} documentos registrados</p>
          </div>
          <button type="button" className="secondary compactButton" disabled={isLoadingDocuments} onClick={() => void refreshDocuments()}>
            {isLoadingDocuments ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>

        {documentsError ? <p className="inlineError">{documentsError}</p> : null}

        <div className="filterPills">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={activeFilter === option.value ? 'filterPill active' : 'filterPill'}
              onClick={() => setActiveFilter(option.value)}
            >
              <span>{option.label}</span>
              <strong>{getFilterCount(option.value)}</strong>
            </button>
          ))}
        </div>

        <input
          className="librarySearch"
          value={documentQuery}
          onChange={(event) => setDocumentQuery(event.target.value)}
          placeholder="Filtrar por nombre, ruta o estado..."
        />
      </section>

      <div className="documentList">
        {filteredDocuments.map((document) => (
          <DocumentLibraryCard key={document.id} document={document} />
        ))}
      </div>

      {!isLoadingDocuments && filteredDocuments.length === 0 ? (
        <section className="emptyState">
          <div className="emptyIllustration" aria-hidden="true">
            <span />
            <span />
          </div>
          <h2>No hay documentos para esta vista.</h2>
          <p>Probá con otra categoría o actualizá la biblioteca después de una ingesta.</p>
        </section>
      ) : null}
    </section>
  );
}

function DocumentLibraryCard({ document }: { document: RecentDocument }) {
  const [openError, setOpenError] = useState<string | null>(null);
  const [isOpening, setIsOpening] = useState<boolean>(false);

  async function handleOpen(): Promise<void> {
    setOpenError(null);
    setIsOpening(true);

    try {
      await openDocumentFile(document.storage_path, document.source_path);
    } catch (error) {
      setOpenError(error instanceof Error ? error.message : 'No pudimos abrir el archivo.');
    } finally {
      setIsOpening(false);
    }
  }

  return (
    <article className="documentCard">
      <div>
        <span className="badge">{statusLabels[document.status]}</span>
        <h3>{document.filename}</h3>
        <p>{document.source_path}</p>
      </div>
      <div className="documentMeta">
        <span>{document.page_count} págs.</span>
        <span>{document.has_native_text ? 'Texto nativo' : 'OCR requerido'}</span>
        <button type="button" className="ghostButton" disabled={isOpening} onClick={() => void handleOpen()}>
          {isOpening ? 'Abriendo...' : 'Abrir'}
        </button>
      </div>
      {openError ? <p className="inlineError">{openError}</p> : null}
    </article>
  );
}
