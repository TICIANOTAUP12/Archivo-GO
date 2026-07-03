type NativeAppBinding = {
  GetWorkspaceSettings?: () => Promise<WorkspaceSettings>;
  OpenFile?: (sourcePath: string) => Promise<void>;
  SaveWorkspaceSettings?: (settings: WorkspaceSettings) => Promise<void>;
  SelectDirectory?: (title: string) => Promise<string>;
  ServiceStatus?: () => Promise<ServiceStatus>;
  StartServices?: () => Promise<void>;
};

export type WorkspaceSettings = {
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
};

declare global {
  interface Window {
    go?: {
      main?: {
        App?: NativeAppBinding;
      };
    };
  }
}

export async function openNativeFile(sourcePath: string): Promise<void> {
  const trimmedPath = sourcePath.trim();
  if (!trimmedPath) throw new Error('No hay una ruta de archivo disponible para abrir.');

  const openFile = window.go?.main?.App?.OpenFile;
  if (!openFile) {
    throw new Error('Abrir archivos está disponible dentro de la app de escritorio.');
  }

  await openFile(trimmedPath);
}

export async function getWorkspaceSettings(): Promise<WorkspaceSettings | null> {
  const getSettings = window.go?.main?.App?.GetWorkspaceSettings;
  if (!getSettings) return null;
  return getSettings();
}

export async function saveWorkspaceSettings(settings: WorkspaceSettings): Promise<void> {
  const saveSettings = window.go?.main?.App?.SaveWorkspaceSettings;
  if (!saveSettings) {
    throw new Error('Guardar carpetas está disponible dentro de la app de escritorio.');
  }
  await saveSettings(settings);
}

export async function selectNativeDirectory(title: string): Promise<string | null> {
  const selectDirectory = window.go?.main?.App?.SelectDirectory;
  if (!selectDirectory) return null;
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
    throw new Error('Acción disponible desde la app de escritorio.');
  }
  await startServices();
}
