import { useCallback, useRef, useState } from 'react';
import { searchDocuments } from '../api/endpoints';
import type { SearchResult } from '../types';

type UseSearchResult = {
  results: SearchResult[];
  hasSearched: boolean;
  isSearching: boolean;
  error: string | null;
  performSearch: (query: string) => Promise<void>;
};

export function useSearch(isBackendReady: boolean): UseSearchResult {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef<number>(0);

  const performSearch = useCallback(async (query: string): Promise<void> => {
    const trimmedQuery = query.trim();
    if (!isBackendReady) {
      requestIdRef.current += 1;
      setResults([]);
      setHasSearched(trimmedQuery.length > 0);
      setIsSearching(false);
      setError('Backend desconectado. Iniciá los servicios antes de buscar.');
      return;
    }

    if (!trimmedQuery) {
      requestIdRef.current += 1;
      setResults([]);
      setHasSearched(false);
      setIsSearching(false);
      setError(null);
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setIsSearching(true);
    setError(null);
    setHasSearched(true);

    try {
      const response = await searchDocuments(trimmedQuery);
      if (requestId !== requestIdRef.current) return;
      setResults(response);
    } catch (searchError) {
      if (requestId !== requestIdRef.current) return;
      setResults([]);
      setError(searchError instanceof Error ? searchError.message : 'No pudimos completar la búsqueda.');
    } finally {
      if (requestId === requestIdRef.current) setIsSearching(false);
    }
  }, [isBackendReady]);

  return { results, hasSearched, isSearching, error, performSearch };
}
