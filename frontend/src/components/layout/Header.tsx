type HeaderProps = {
  backendStatus: 'checking' | 'ready' | 'offline' | 'starting';
  backendMessage: string;
  onRetryBackend: () => Promise<void>;
  onStartBackend: () => Promise<void>;
};

export function Header({ backendStatus, backendMessage, onRetryBackend, onStartBackend }: HeaderProps) {
  const statusLabel = buildStatusLabel(backendStatus);

  return (
    <header className="hero">
      <div>
        <p className="eyebrow">Agencia de gas</p>
        <h1>Archivo Digital Inteligente</h1>
        <p className="heroText">
          Encontrá matrículas, números de caso e incidentes sin navegar carpetas manualmente.
        </p>
      </div>
      <div className="backendStatusPanel">
        <span className={`statusBadge statusBadge-${backendStatus}`}>{statusLabel}</span>
        <p>{backendMessage}</p>
        <div className="statusActions">
          <button
            type="button"
            className="secondary compactButton"
            disabled={backendStatus === 'checking' || backendStatus === 'starting'}
            onClick={() => void onRetryBackend()}
          >
            Reintentar
          </button>
          <button
            type="button"
            className="compactButton"
            disabled={backendStatus === 'checking' || backendStatus === 'starting'}
            onClick={() => void onStartBackend()}
          >
            Iniciar servicios
          </button>
        </div>
      </div>
    </header>
  );
}

function buildStatusLabel(status: HeaderProps['backendStatus']): string {
  if (status === 'ready') return 'Backend conectado';
  if (status === 'starting') return 'Iniciando backend';
  if (status === 'checking') return 'Verificando backend';
  return 'Backend desconectado';
}
