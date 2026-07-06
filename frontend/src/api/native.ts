export type WorkspaceSettings = {
  backendUrl: string;
  inputPath: string;
  storagePath: string;
  defaultProvider: 'google' | 'anthropic' | 'local';
  googleApiKey: string;
  googleModel: string;
  googleEmbeddingModel: string;
  anthropicApiKey: string;
  anthropicModel: string;
  embeddingProvider: 'google' | 'local';
  enableAnthropicFallback: boolean;
  minExtractionConfidence: number;
  maxRunBudgetUsd: number;
};

export type ServiceStatus = {
  backendReady: boolean;
  message: string;
  dockerAvailable: boolean;
};

export type AppInfo = {
  version: string;
  releaseChannel: string;
};

export type UpdateCheckResult = {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  releaseNotes: string;
  message: string;
};

type NativeAppBinding = {
  CheckForUpdates?: () => Promise<UpdateCheckResult>;
  GetAppInfo?: () => Promise<AppInfo>;
  GetWorkspaceSettings?: () => Promise<WorkspaceSettings>;
  InstallLatestUpdate?: () => Promise<void>;
  OpenDocument?: (storagePath: string, sourcePath: string) => Promise<void>;
  OpenFile?: (sourcePath: string) => Promise<void>;
  OpenHelpManual?: () => Promise<void>;
  SaveWorkspaceSettings?: (settings: WorkspaceSettings) => Promise<void>;
  SelectDirectory?: (title: string) => Promise<string>;
  ServiceStatus?: () => Promise<ServiceStatus>;
  StartServices?: () => Promise<void>;
};

const desktopBridgeUnavailableMessage =
  'Esta acción requiere abrir la aplicación de escritorio Wails, no sólo el navegador de desarrollo.';

declare global {
  interface Window {
    go?: {
      main?: {
        App?: NativeAppBinding;
      };
    };
  }
}

export async function openDocumentFile(storagePath: string | null | undefined, sourcePath: string): Promise<void> {
  const trimmedSourcePath = sourcePath.trim();
  const trimmedStoragePath = storagePath?.trim() ?? '';

  if (!trimmedStoragePath && !trimmedSourcePath) {
    throw new Error('No hay una ruta de archivo disponible para abrir.');
  }

  const openDocument = window.go?.main?.App?.OpenDocument;
  if (openDocument) {
    await openDocument(trimmedStoragePath, trimmedSourcePath);
    return;
  }

  await openNativeFile(trimmedStoragePath || trimmedSourcePath);
}

export async function openNativeFile(sourcePath: string): Promise<void> {
  const trimmedPath = sourcePath.trim();
  if (!trimmedPath) throw new Error('No hay una ruta de archivo disponible para abrir.');

  const openFile = window.go?.main?.App?.OpenFile;
  if (!openFile) {
    throw new Error(desktopBridgeUnavailableMessage);
  }

  await openFile(trimmedPath);
}

export async function getAppInfo(): Promise<AppInfo | null> {
  const getInfo = window.go?.main?.App?.GetAppInfo;
  if (!getInfo) return null;
  return getInfo();
}

export async function checkForUpdates(): Promise<UpdateCheckResult> {
  const checkUpdates = window.go?.main?.App?.CheckForUpdates;
  if (!checkUpdates) {
    throw new Error('Buscar actualizaciones requiere la app de escritorio Wails.');
  }
  return checkUpdates();
}

export async function installLatestUpdate(): Promise<void> {
  const installUpdate = window.go?.main?.App?.InstallLatestUpdate;
  if (!installUpdate) {
    throw new Error('Instalar actualizaciones requiere la app de escritorio Wails.');
  }
  await installUpdate();
}

export async function openHelpManual(): Promise<void> {
  const openManual = window.go?.main?.App?.OpenHelpManual;
  if (!openManual) {
    throw new Error('El manual está en manual-de-uso.html junto al ejecutable de la app.');
  }
  await openManual();
}

export async function getWorkspaceSettings(): Promise<WorkspaceSettings | null> {
  const getSettings = window.go?.main?.App?.GetWorkspaceSettings;
  if (!getSettings) return null;
  return getSettings();
}

export async function saveWorkspaceSettings(settings: WorkspaceSettings): Promise<void> {
  const saveSettings = window.go?.main?.App?.SaveWorkspaceSettings;
  if (!saveSettings) {
    throw new Error(desktopBridgeUnavailableMessage);
  }
  await saveSettings(settings);
}

export async function selectNativeDirectory(title: string): Promise<string | null> {
  const selectDirectory = window.go?.main?.App?.SelectDirectory;
  if (!selectDirectory) {
    throw new Error(desktopBridgeUnavailableMessage);
  }
  const selectedPath = await selectDirectory(title);
  return selectedPath.trim().length > 0 ? selectedPath : null;
}

export async function getNativeServiceStatus(): Promise<ServiceStatus | null> {
  const serviceStatus = window.go?.main?.App?.ServiceStatus;
  if (!serviceStatus) return null;
  return serviceStatus();
}

export async function startNativeServices(): Promise<void> {
  const startServices = window.go?.main?.App?.StartServices;
  if (!startServices) {
    throw new Error(desktopBridgeUnavailableMessage);
  }
  await startServices();
}
