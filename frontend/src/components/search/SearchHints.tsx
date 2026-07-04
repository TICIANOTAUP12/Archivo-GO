type SearchHintsProps = {
  onSelect: (term: string) => void;
};

const SAMPLE_SEARCHES = [
  { label: 'XLF030', hint: 'Patente muestra' },
  { label: 'BNI831', hint: 'Patente ENARGAS' },
  { label: '45710274', hint: 'Trámite' },
  { label: '73919692', hint: 'Trámite bulk' },
  { label: '135087762', hint: 'Trámite IF' },
  { label: 'ENARGAS', hint: 'Texto libre' },
] as const;

export function SearchHints({ onSelect }: SearchHintsProps) {
  return (
    <div className="searchHints">
      <p className="searchHintsLabel">Ejemplos para probar</p>
      <div className="searchHintsRow">
        {SAMPLE_SEARCHES.map((sample) => (
          <button
            key={sample.label}
            type="button"
            className="searchHintChip"
            title={sample.hint}
            onClick={() => onSelect(sample.label)}
          >
            {sample.label}
          </button>
        ))}
      </div>
    </div>
  );
}
