import { useState, type ReactNode } from 'react';
import { openDocumentFile } from '../../api/native';
import type { SearchResult } from '../../types';
import { cleanSnippet, shortFilename } from '../../utils/groupSearchResults';

type ResultCardProps = {
  result: SearchResult;
  query: string;
  matchedPages: number[];
};

type HighlightRange = {
  start: number;
  end: number;
};

export function ResultCard({ result, query, matchedPages }: ResultCardProps) {
  const [isOpening, setIsOpening] = useState<boolean>(false);
  const [openError, setOpenError] = useState<string | null>(null);
  const headline = buildHeadline(result);
  const metaItems = buildMetaItems(result);
  const pageLabel = buildPageLabel(result.page_number, matchedPages);
  const preview = cleanSnippet(result.snippet);
  const matchLabel = buildMatchLabel(result.match_kind);

  async function handleOpenFile(): Promise<void> {
    setIsOpening(true);
    setOpenError(null);

    try {
      await openDocumentFile(result.storage_path, result.source_path);
    } catch (error) {
      setOpenError(error instanceof Error ? error.message : 'No pudimos abrir el archivo.');
    } finally {
      setIsOpening(false);
    }
  }

  return (
    <article className="resultCard">
      <div className="resultMain">
        <div className="resultTopRow">
          <div className="resultIdentity">
            <div className="resultTitleRow">
              <h3>{headline}</h3>
              {matchLabel ? <span className="matchKindBadge">{matchLabel}</span> : null}
            </div>
            <p className="resultFilename" title={result.filename}>
              {shortFilename(result.filename)}
            </p>
          </div>
          <button className="ghostButton compactOpenButton" type="button" disabled={isOpening} onClick={() => void handleOpenFile()}>
            {isOpening ? '…' : 'Abrir'}
          </button>
        </div>

        {metaItems.length > 0 ? (
          <dl className="resultMeta">
            {metaItems.map((item) => (
              <div key={item.label} className="resultMetaItem">
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
            <div className="resultMetaItem">
              <dt>Páginas</dt>
              <dd>{pageLabel}</dd>
            </div>
          </dl>
        ) : null}

        {preview ? <p className="snippetPreview">{renderHighlightedSnippet(preview, query)}</p> : null}
        {openError ? <p className="inlineError">{openError}</p> : null}
      </div>
    </article>
  );
}

function buildMatchLabel(matchKind: string | null): string | null {
  if (!matchKind) return null;
  if (matchKind === 'patente') return 'Patente';
  if (matchKind === 'tramite') return 'Trámite';
  if (matchKind === 'persona') return 'Persona';
  if (matchKind === 'matricula') return 'Matrícula';
  return 'Texto';
}

function buildHeadline(result: SearchResult): string {
  if (result.patente) return result.patente;
  if (result.numero_caso) return `Trámite ${result.numero_caso}`;
  if (result.matricula) return `Matrícula ${result.matricula}`;
  return 'Documento';
}

function buildMetaItems(result: SearchResult): Array<{ label: string; value: string }> {
  const items: Array<{ label: string; value: string }> = [];

  if (result.patente && result.numero_caso) {
    items.push({ label: 'Trámite', value: result.numero_caso });
  } else if (result.numero_caso && !result.patente) {
    items.push({ label: 'Expediente', value: result.numero_caso });
  }

  if (result.matricula) {
    items.push({ label: 'Matrícula', value: result.matricula });
  }

  return items;
}

function buildPageLabel(primaryPage: number, matchedPages: number[]): string {
  if (matchedPages.length <= 1) return String(primaryPage);
  if (matchedPages.length <= 4) return matchedPages.join(', ');
  return `${primaryPage} (+${matchedPages.length - 1} más)`;
}

function renderHighlightedSnippet(snippet: string, query: string): ReactNode[] {
  const ranges = getHighlightRanges(snippet, query);
  if (ranges.length === 0) return [snippet];

  const fragments: ReactNode[] = [];
  let cursor = 0;

  ranges.forEach((range) => {
    if (range.start > cursor) {
      fragments.push(snippet.slice(cursor, range.start));
    }

    fragments.push(<mark key={`${range.start}-${range.end}`}>{snippet.slice(range.start, range.end)}</mark>);
    cursor = range.end;
  });

  if (cursor < snippet.length) {
    fragments.push(snippet.slice(cursor));
  }

  return fragments;
}

function getHighlightRanges(snippet: string, query: string): HighlightRange[] {
  const normalizedSnippet = normalizeForSearch(snippet);
  const terms = buildHighlightTerms(query);
  const ranges: HighlightRange[] = [];

  terms.forEach((term) => {
    let index = normalizedSnippet.indexOf(term);
    while (index >= 0) {
      ranges.push({ start: index, end: index + term.length });
      index = normalizedSnippet.indexOf(term, index + term.length);
    }
  });

  return mergeRanges(ranges);
}

function buildHighlightTerms(query: string): string[] {
  const normalizedQuery = normalizeForSearch(query.trim());
  if (!normalizedQuery) return [];

  const words = normalizedQuery.split(/\s+/).filter((word) => word.length > 2);
  return Array.from(new Set([normalizedQuery, ...words])).sort((first, second) => second.length - first.length);
}

function mergeRanges(ranges: HighlightRange[]): HighlightRange[] {
  const sortedRanges = [...ranges].sort((first, second) => first.start - second.start || second.end - first.end);
  const mergedRanges: HighlightRange[] = [];

  sortedRanges.forEach((range) => {
    const lastRange = mergedRanges[mergedRanges.length - 1];
    if (!lastRange || range.start > lastRange.end) {
      mergedRanges.push(range);
      return;
    }

    lastRange.end = Math.max(lastRange.end, range.end);
  });

  return mergedRanges;
}

function normalizeForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es');
}
