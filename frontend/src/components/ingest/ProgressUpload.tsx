type ProgressUploadProps = {
  label: string;
};

export function ProgressUpload({ label }: ProgressUploadProps) {
  return (
    <div className="progressBox" role="status">
      <div className="progressHeader">
        <span>{label}</span>
        <span>En curso</span>
      </div>
      <div className="progressTrack">
        <span className="progressBar" />
      </div>
    </div>
  );
}
