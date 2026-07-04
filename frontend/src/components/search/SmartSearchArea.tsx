import { useEffect, useState } from 'react';
import { useSearch } from '../../hooks/useSearch';
import { EmptySearchState } from './EmptySearchState';
import { ResultsList } from './ResultsList';
import { SearchBar } from './SearchBar';
import { SearchHints } from './SearchHints';
import { SearchSkeleton } from './SearchSkeleton';

const SEARCH_DEBOUNCE_MS = 450;
const MIN_AUTO_SEARCH_LENGTH = 2;

export function SmartSearchArea() {
  const [query, setQuery] = useState<string>('');
  const { results, hasSearched, isSearching, error, performSearch } = useSearch();
  const trimmedQuery = query.trim();
  const shouldShowEmptyState = hasSearched && !isSearching && !error && results.length === 0;
  const shouldShowResults = !isSearching && results.length > 0;

  useEffect(() => {
    if (trimmedQuery.length === 0) {
      void performSearch('');
      return;
    }

    if (trimmedQuery.length < MIN_AUTO_SEARCH_LENGTH) {
      void performSearch('');
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void performSearch(trimmedQuery);
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [performSearch, trimmedQuery]);

  function handleSubmit(): void {
    void performSearch(trimmedQuery);
  }

  function handleHintSelect(term: string): void {
    setQuery(term);
    void performSearch(term);
  }

  const showHints = trimmedQuery.length === 0 && !isSearching && !error;

  return (
    <section className="searchArea">
      <SearchBar
        query={query}
        isSearching={isSearching}
        onQueryChange={setQuery}
        onSubmit={handleSubmit}
      />

      {showHints ? <SearchHints onSelect={handleHintSelect} /> : null}

      {error ? <section className="errorPanel">{error}</section> : null}
      {isSearching ? <SearchSkeleton /> : null}
      {shouldShowResults ? <ResultsList results={results} query={trimmedQuery} /> : null}
      {shouldShowEmptyState ? <EmptySearchState query={trimmedQuery} /> : null}
    </section>
  );
}
