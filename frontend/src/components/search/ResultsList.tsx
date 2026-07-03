import type { SearchResult } from '../../types';
import { ResultCard } from './ResultCard';

type ResultsListProps = {
  results: SearchResult[];
  query: string;
};

export function ResultsList({ results, query }: ResultsListProps) {
  return (
    <div className="resultsList">
      {results.map((result) => (
        <ResultCard key={result.page_id} result={result} query={query} />
      ))}
    </div>
  );
}
