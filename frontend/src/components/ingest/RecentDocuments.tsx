import type { RecentDocument } from '../../types';

type RecentDocumentsProps = {
  documents: RecentDocument[];
  isRefreshing: boolean;
  refreshError: string | null;
  onRefresh: () => Promise<void>;
};

const statusLabels: Record<RecentDocument['status'], string> = {
  pending: 'Pendiente',
  processing: 'Procesando',
  indexed: 'Indexado',
  needs_review: 'Requiere revisión',
  failed: 'Falló',
};

export function RecentDocuments({ documents, isRefreshing, refreshError, onRefresh }: RecentDocumentsProps) {
  return (
    <section className="card">
      <div className="sectionHeader">
        <div>
          <p className="eyebrow">Últimos movimientos</p>
          <h2>Documentos recientes</h2>
        </div>
        <button type="button" className="secondary compactButton" disabled={isRefreshing} onClick={() => void onRefresh()}>
          {isRefreshing ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>

      {refreshError ? <p className="inlineError">{refreshError}</p> : null}

      <div className="list">
        {documents.map((document) => (
          <article key={document.id} className="listItem">
            <strong>{document.filename}</strong>
            <span>
              {statusLabels[document.status]} · {document.page_count} págs.
            </span>
          </article>
        ))}
        {documents.length === 0 ? <p className="muted">Todavía no hay documentos indexados.</p> : null}
      </div>
    </section>
  );
}
