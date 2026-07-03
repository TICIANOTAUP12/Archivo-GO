import type { AuditResponse, FileAudit } from '../../types';

type AuditSummaryProps = {
  audit: AuditResponse;
};

export function AuditSummary({ audit }: AuditSummaryProps) {
  const sampledFiles = audit.sampled_files.slice(0, 8);

  return (
    <section className="auditDetails">
      <div className="summary">
        <span>{audit.total_files} archivos compatibles</span>
        <span>{audit.total_pages} páginas estimadas</span>
        <span>{audit.scanned_pages} páginas con OCR</span>
        <span>{audit.native_text_pages} páginas con texto nativo</span>
        <span>{formatBytes(audit.total_bytes)} detectados</span>
        <span>
          USD {audit.estimate.total_low_usd.toFixed(2)} - {audit.estimate.total_high_usd.toFixed(2)}
        </span>
      </div>

      <div className="estimateBreakdown">
        <span>OCR imágenes/PDF escaneados: USD {audit.estimate.google_ocr_usd.toFixed(2)}</span>
        <span>Extracción Gemini: USD {audit.estimate.gemini_extraction_usd.toFixed(2)}</span>
        <span>Embeddings Gemini: USD {audit.estimate.gemini_embedding_usd.toFixed(2)}</span>
        <span>
          Fallback Anthropic: USD {audit.estimate.anthropic_fallback_low_usd.toFixed(2)} -{' '}
          {audit.estimate.anthropic_fallback_high_usd.toFixed(2)}
        </span>
      </div>

      {sampledFiles.length > 0 ? (
        <div className="auditSampleList">
          <h3>Muestra auditada</h3>
          {sampledFiles.map((file) => (
            <SampledFile key={file.sha256} file={file} />
          ))}
        </div>
      ) : (
        <p className="muted">No se encontraron PDF o imágenes compatibles para auditar.</p>
      )}
    </section>
  );
}

function SampledFile({ file }: { file: FileAudit }) {
  return (
    <article className="sampleFile">
      <div>
        <strong>{file.filename}</strong>
        <p className="fileMeta">{file.path}</p>
      </div>
      <div className="badgeRow compactBadges">
        <span className="badge">{file.extension.toUpperCase()}</span>
        <span className="badge subtleBadge">{file.page_count} pág.</span>
        <span className="badge subtleBadge">{formatBytes(file.size_bytes)}</span>
        <span className={`badge ${file.is_probably_scanned ? '' : 'subtleBadge'}`}>
          {file.is_probably_scanned ? 'Requiere OCR' : 'Texto nativo'}
        </span>
        <span className="badge subtleBadge">SHA {file.sha256.slice(0, 10)}</span>
      </div>
    </article>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
