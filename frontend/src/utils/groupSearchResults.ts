import type { SearchResult } from '../types';

export type GroupedSearchResult = {
  primary: SearchResult;
  matchedPages: number[];
};

export function groupSearchResults(results: SearchResult[]): GroupedSearchResult[] {
  const grouped = new Map<string, GroupedSearchResult>();

  results.forEach((result) => {
    const existing = grouped.get(result.document_id);
    if (!existing) {
      grouped.set(result.document_id, { primary: result, matchedPages: [result.page_number] });
      return;
    }

    if (!existing.matchedPages.includes(result.page_number)) {
      existing.matchedPages.push(result.page_number);
    }

    if (result.score > existing.primary.score) {
      existing.primary = result;
    }
  });

  return Array.from(grouped.values())
    .map((entry) => ({
      ...entry,
      matchedPages: [...entry.matchedPages].sort((first, second) => first - second),
    }))
    .sort((first, second) => second.primary.score - first.primary.score);
}

export function cleanSnippet(text: string, maxLength = 220): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trimEnd()}…`;
}

export function shortFilename(filename: string): string {
  const decoded = safeDecodeFilename(filename);
  if (decoded.length <= 56) return decoded;
  return `…${decoded.slice(-53)}`;
}

function safeDecodeFilename(filename: string): string {
  if (!filename.includes('%')) return filename;

  const sanitized = filename.replace(/%(?![0-9A-Fa-f]{2})/g, '%25');

  try {
    return decodeURIComponent(sanitized);
  } catch {
    return filename;
  }
}
