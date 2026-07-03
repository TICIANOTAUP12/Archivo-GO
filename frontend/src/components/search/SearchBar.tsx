import type { FormEvent } from 'react';

type SearchBarProps = {
  query: string;
  isDisabled: boolean;
  isSearching: boolean;
  onQueryChange: (query: string) => void;
  onSubmit: () => void;
};

export function SearchBar({ query, isDisabled, isSearching, onQueryChange, onSubmit }: SearchBarProps) {
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
          disabled={isDisabled}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={isDisabled ? 'Iniciá el backend para buscar...' : 'Buscar por matrícula, nro de caso, o describir el problema...'}
        />
        {isSearching ? <span className="spinner" aria-label="Buscando" /> : null}
      </div>
    </form>
  );
}
