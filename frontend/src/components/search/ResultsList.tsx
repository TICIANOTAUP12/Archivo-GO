import type { SearchResult } from '../../types';
import { groupSearchResults } from '../../utils/groupSearchResults';
import { ResultCard } from './ResultCard';

type ResultsListProps = {
  results: SearchResult[];
  query: string;
};

export function ResultsList({ results, query }: ResultsListProps) {
  const groupedResults = groupSearchResults(results);
  const documentCount = groupedResults.length;
  const pageCount = results.length;

  return (
    <div className="resultsPanel">
      <p className="resultsSummary">
        {documentCount} documento{documentCount === 1 ? '' : 's'}
        {pageCount > documentCount ? ` · ${pageCount} coincidencias en páginas` : null}
      </p>
      <div className="resultsList">
        {groupedResults.map((group) => (
          <ResultCard
            key={group.primary.document_id}
            result={group.primary}
            query={query}
            matchedPages={group.matchedPages}
          />
        ))}
      </div>
    </div>
  );
}
