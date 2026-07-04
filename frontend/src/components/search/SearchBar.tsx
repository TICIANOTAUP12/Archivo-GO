import type { FormEvent } from 'react';

type SearchBarProps = {
  query: string;
  isSearching: boolean;
  onQueryChange: (query: string) => void;
  onSubmit: () => void;
};

export function SearchBar({ query, isSearching, onQueryChange, onSubmit }: SearchBarProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form className="spotlightSearch" onSubmit={handleSubmit}>
      <div className="spotlightInputShell">
        <span className="searchGlyph" aria-hidden="true">
          Buscar
        </span>
        <input
          autoFocus
          className="spotlightInput"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Buscar por patente, trámite, matrícula o texto libre..."
        />
        {isSearching ? <span className="spinner" aria-label="Buscando" /> : null}
      </div>
    </form>
  );
}
