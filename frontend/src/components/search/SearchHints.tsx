type SearchHintsProps = {
  onSelect: (term: string) => void;
};

const SAMPLE_SEARCHES = [
  { label: 'XLF030', hint: 'Patente' },
  { label: '73919692', hint: 'Trámite' },
  { label: '18032', hint: 'Matrícula METROGAS' },
  { label: 'Luis Rensin', hint: 'Persona' },
  { label: 'SCIVOLI', hint: 'Empresa' },
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
            <span>{sample.label}</span>
            <small>{sample.hint}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
