type UseAppUpdateBannerProps = {
  currentVersion: string | null;
  updateInfo: {
    updateAvailable: boolean;
    latestVersion: string;
    message: string;
  } | null;
  isCheckingUpdate: boolean;
  isInstallingUpdate: boolean;
  updateError: string | null;
  onRefresh: () => Promise<void>;
  onInstall: () => Promise<void>;
};

export function UpdateBanner({
  currentVersion,
  updateInfo,
  isCheckingUpdate,
  isInstallingUpdate,
  updateError,
  onRefresh,
  onInstall,
}: UseAppUpdateBannerProps) {
  if (!updateInfo && !updateError && !isCheckingUpdate) return null;

  return (
    <section className="updateBanner" data-available={updateInfo?.updateAvailable ? 'true' : 'false'}>
      <div>
        <strong>Actualizaciones</strong>
        <p className="muted">
          {updateError
            ? updateError
            : updateInfo?.message ?? (isCheckingUpdate ? 'Buscando actualizaciones...' : 'Sin novedades')}
          {currentVersion ? ` · Versión actual: v${currentVersion}` : null}
        </p>
      </div>
      <div className="updateActions">
        <button type="button" className="secondary compactButton" disabled={isCheckingUpdate || isInstallingUpdate} onClick={() => void onRefresh()}>
          {isCheckingUpdate ? 'Buscando...' : 'Buscar'}
        </button>
        {updateInfo?.updateAvailable ? (
          <button type="button" className="updateInstallButton compactButton" disabled={isInstallingUpdate} onClick={() => void onInstall()}>
            {isInstallingUpdate ? 'Descargando...' : `Actualizar a v${updateInfo.latestVersion}`}
          </button>
        ) : null}
      </div>
    </section>
  );
}
