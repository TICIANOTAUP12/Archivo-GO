import { useCallback, useEffect, useState } from 'react';
import { checkForUpdates, getAppInfo, installLatestUpdate, type UpdateCheckResult } from '../api/native';

type UseAppUpdateResult = {
  currentVersion: string | null;
  releaseChannel: string | null;
  updateInfo: UpdateCheckResult | null;
  isCheckingUpdate: boolean;
  isInstallingUpdate: boolean;
  updateError: string | null;
  refreshUpdateCheck: () => Promise<void>;
  installUpdate: () => Promise<void>;
};

export function useAppUpdate(): UseAppUpdateResult {
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [releaseChannel, setReleaseChannel] = useState<string | null>(null);
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState<boolean>(false);
  const [isInstallingUpdate, setIsInstallingUpdate] = useState<boolean>(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const refreshUpdateCheck = useCallback(async (): Promise<void> => {
    setIsCheckingUpdate(true);
    setUpdateError(null);
    try {
      const appInfo = await getAppInfo();
      if (appInfo) {
        setCurrentVersion(appInfo.version);
        setReleaseChannel(appInfo.releaseChannel);
      }
      const result = await checkForUpdates();
      setUpdateInfo(result);
    } catch (error) {
      setUpdateInfo(null);
      setUpdateError(error instanceof Error ? error.message : 'No pudimos buscar actualizaciones.');
    } finally {
      setIsCheckingUpdate(false);
    }
  }, []);

  async function installUpdate(): Promise<void> {
    setIsInstallingUpdate(true);
    setUpdateError(null);
    try {
      await installLatestUpdate();
    } catch (error) {
      setUpdateError(error instanceof Error ? error.message : 'No pudimos instalar la actualización.');
      setIsInstallingUpdate(false);
    }
  }

  useEffect(() => {
    void refreshUpdateCheck();
  }, [refreshUpdateCheck]);

  return {
    currentVersion,
    releaseChannel,
    updateInfo,
    isCheckingUpdate,
    isInstallingUpdate,
    updateError,
    refreshUpdateCheck,
    installUpdate,
  };
}
