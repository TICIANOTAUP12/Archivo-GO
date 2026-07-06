type FolderPathPickerProps = {
  label: string;
  hint?: string;
  value: string;
  placeholder: string;
  browseLabel?: string;
  disabled?: boolean;
  onChange: (path: string) => void;
  onBrowse: () => void;
};

export function FolderPathPicker({
  label,
  hint,
  value,
  placeholder,
  browseLabel = 'Examinar...',
  disabled = false,
  onChange,
  onBrowse,
}: FolderPathPickerProps) {
  return (
    <label>
      {label}
      {hint ? <span className="fieldHint">{hint}</span> : null}
      <div className="pathPicker">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          disabled={disabled}
        />
        <button type="button" className="secondary compactButton" disabled={disabled} onClick={onBrowse}>
          {browseLabel}
        </button>
      </div>
    </label>
  );
}
