import { useState, type ReactNode } from 'react';
import { openNativeFile } from '../../api/native';
import type { SearchResult } from '../../types';

type ResultCardProps = {
  result: SearchResult;
  query: string;
};

type HighlightRange = {
  start: number;
  end: number;
};

export function ResultCard({ result, query }: ResultCardProps) {
  const [isOpening, setIsOpening] = useState<boolean>(false);
  const [openError, setOpenError] = useState<string | null>(null);
  const title = buildResultTitle(result);

  async function handleOpenFile(): Promise<void> {
    setIsOpening(true);
    setOpenError(null);

    try {
      await openNativeFile(result.storage_path ?? result.source_path);
    } catch (error) {
      setOpenError(error instanceof Error ? error.message : 'No pudimos abrir el archivo.');
    } finally {
      setIsOpening(false);
    }
  }

  return (
    <article className="resultCard">
      <div className="pdfIcon" aria-hidden="true">
        PDF
      </div>
      <div className="resultContent">
        <div className="resultHeader">
          <div>
            <h3>{title}</h3>
            <p>{result.filename}</p>
          </div>
          <button className="ghostButton" type="button" disabled={isOpening} onClick={() => void handleOpenFile()}>
            {isOpening ? 'Abriendo...' : 'Abrir archivo'}
          </button>
        </div>

        <div className="badgeRow">
          <span className="badge">Mat: {result.matricula ?? 'Sin dato'}</span>
          <span className="badge">Caso: {result.numero_caso ?? 'Sin dato'}</span>
          <span className="badge subtleBadge">Página {result.page_number}</span>
        </div>

        <p className="snippet">{renderHighlightedSnippet(result.snippet, query)}</p>
        {openError ? <p className="inlineError">{openError}</p> : null}
      </div>
    </article>
  );
}

function buildResultTitle(result: SearchResult): string {
  const primary = result.matricula ? `Matrícula ${result.matricula}` : 'Documento encontrado';
  if (!result.numero_caso) return primary;
  return `${primary} · Caso ${result.numero_caso}`;
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

    fragments.push(
      <mark key={`${range.start}-${range.end}`}>{snippet.slice(range.start, range.end)}</mark>,
    );
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
