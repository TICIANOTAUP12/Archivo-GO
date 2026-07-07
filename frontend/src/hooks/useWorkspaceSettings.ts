import { useEffect, useState } from 'react';
import { setBackendBaseUrl } from '../api/backendConfig';
import {
  getNativeServiceStatus,
  getWorkspaceSettings,
  saveWorkspaceSettings,
  selectNativeDirectory,
  startNativeServices,
  type DeploymentMode,
  type WorkspaceSettings,
} from '../api/native';

type UseWorkspaceSettingsResult = {
  settings: WorkspaceSettings;
  isSavingSettings: boolean;
  settingsMessage: string | null;
  settingsError: string | null;
  setInputPath: (path: string) => void;
  setStoragePath: (path: string) => void;
  setDeploymentMode: (mode: DeploymentMode) => void;
  setGatewayUrl: (url: string) => void;
  setGatewayToken: (token: string) => void;
  setDefaultProvider: (provider: WorkspaceSettings['defaultProvider']) => void;
  setGoogleApiKey: (apiKey: string) => void;
  setGoogleModel: (model: string) => void;
  setGoogleEmbeddingModel: (model: string) => void;
  setAnthropicApiKey: (apiKey: string) => void;
  setAnthropicModel: (model: string) => void;
  setOpenAIApiKey: (apiKey: string) => void;
  setOpenAIModel: (model: string) => void;
  setOpenAIEmbeddingModel: (model: string) => void;
  setEmbeddingProvider: (provider: WorkspaceSettings['embeddingProvider']) => void;
  setEnableAnthropicFallback: (isEnabled: boolean) => void;
  setMinExtractionConfidence: (confidence: number) => void;
  setMaxRunBudgetUsd: (budget: number) => void;
  setBackendUrl: (url: string) => void;
  selectInputPath: () => Promise<void>;
  selectStoragePath: () => Promise<void>;
  persistSettings: () => Promise<void>;
  reloadSettings: () => Promise<void>;
};

const emptySettings: WorkspaceSettings = {
  backendUrl: 'http://localhost:8080',
  gatewayUrl: '',
  gatewayToken: '',
  deploymentMode: 'docker',
  localEngineListenAddress: '127.0.0.1:8090',
  inputPath: '',
  storagePath: '',
  defaultProvider: 'google',
  googleApiKey: '',
  googleModel: 'gemini-2.5-flash',
  googleEmbeddingModel: 'gemini-embedding-001',
  anthropicApiKey: '',
  anthropicModel: 'claude-haiku-4-5',
  openaiApiKey: '',
  openaiModel: 'gpt-4o-mini',
  openaiEmbeddingModel: 'text-embedding-3-small',
  embeddingProvider: 'local',
  enableAnthropicFallback: true,
  minExtractionConfidence: 0.82,
  maxRunBudgetUsd: 300,
};

export function useWorkspaceSettings(): UseWorkspaceSettingsResult {
  const [settings, setSettings] = useState<WorkspaceSettings>(emptySettings);
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  useEffect(() => {
    void loadSettings();
  }, []);

  function setInputPath(path: string): void {
    setSettings((currentSettings) => ({ ...currentSettings, inputPath: path }));
  }

  function setStoragePath(path: string): void {
    setSettings((currentSettings) => ({ ...currentSettings, storagePath: path }));
  }

  function setDeploymentMode(mode: DeploymentMode): void {
    setSettings((currentSettings) => ({
      ...currentSettings,
      deploymentMode: mode,
      backendUrl: mode === 'local' ? `http://${currentSettings.localEngineListenAddress || '127.0.0.1:8090'}` : currentSettings.backendUrl,
    }));
  }

  function setGatewayUrl(url: string): void {
    setSettings((currentSettings) => ({
      ...currentSettings,
      gatewayUrl: url.replace(/\\/g, '/'),
    }));
  }

  function setGatewayToken(token: string): void {
    setSettings((currentSettings) => ({ ...currentSettings, gatewayToken: token }));
  }

  function setDefaultProvider(provider: WorkspaceSettings['defaultProvider']): void {
    setSettings((currentSettings) => ({ ...currentSettings, defaultProvider: provider }));
  }

  function setGoogleApiKey(apiKey: string): void {
    setSettings((currentSettings) => ({ ...currentSettings, googleApiKey: apiKey }));
  }

  function setGoogleModel(model: string): void {
    setSettings((currentSettings) => ({ ...currentSettings, googleModel: model }));
  }

  function setGoogleEmbeddingModel(model: string): void {
    setSettings((currentSettings) => ({ ...currentSettings, googleEmbeddingModel: model }));
  }

  function setAnthropicApiKey(apiKey: string): void {
    setSettings((currentSettings) => ({ ...currentSettings, anthropicApiKey: apiKey }));
  }

  function setAnthropicModel(model: string): void {
    setSettings((currentSettings) => ({ ...currentSettings, anthropicModel: model }));
  }

  function setOpenAIApiKey(apiKey: string): void {
    setSettings((currentSettings) => ({ ...currentSettings, openaiApiKey: apiKey }));
  }

  function setOpenAIModel(model: string): void {
    setSettings((currentSettings) => ({ ...currentSettings, openaiModel: model }));
  }

  function setOpenAIEmbeddingModel(model: string): void {
    setSettings((currentSettings) => ({ ...currentSettings, openaiEmbeddingModel: model }));
  }

  function setEmbeddingProvider(provider: WorkspaceSettings['embeddingProvider']): void {
    setSettings((currentSettings) => ({ ...currentSettings, embeddingProvider: provider }));
  }

  function setEnableAnthropicFallback(isEnabled: boolean): void {
    setSettings((currentSettings) => ({ ...currentSettings, enableAnthropicFallback: isEnabled }));
  }

  function setMinExtractionConfidence(confidence: number): void {
    setSettings((currentSettings) => ({ ...currentSettings, minExtractionConfidence: confidence }));
  }

  function setBackendUrl(url: string): void {
    setSettings((currentSettings) => ({ ...currentSettings, backendUrl: url }));
  }

  function setMaxRunBudgetUsd(budget: number): void {
    setSettings((currentSettings) => ({ ...currentSettings, maxRunBudgetUsd: budget }));
  }

  async function selectInputPath(): Promise<void> {
    setSettingsError(null);
    try {
      const selectedPath = await selectNativeDirectory('Seleccionar carpeta de origen');
      if (selectedPath) setInputPath(selectedPath);
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : 'No pudimos seleccionar la carpeta de origen.');
    }
  }

  async function selectStoragePath(): Promise<void> {
    setSettingsError(null);
    try {
      const selectedPath = await selectNativeDirectory('Seleccionar carpeta donde guardar casos');
      if (selectedPath) setStoragePath(selectedPath);
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : 'No pudimos seleccionar la carpeta de destino.');
    }
  }

  async function persistSettings(): Promise<void> {
    setIsSavingSettings(true);
    setSettingsError(null);
    setSettingsMessage(null);
    try {
      const latestOnDisk = await getWorkspaceSettings().catch(() => null);
      const mergedSettings: WorkspaceSettings = {
        ...emptySettings,
        ...(latestOnDisk ?? {}),
        ...settings,
      };
      await saveWorkspaceSettings(mergedSettings);
      setSettings(mergedSettings);
      setBackendBaseUrl(mergedSettings.backendUrl);
      if (mergedSettings.deploymentMode === 'local') {
        await startNativeServices().catch(() => undefined);
      }
      const serviceStatus = await getNativeServiceStatus();
      if (mergedSettings.deploymentMode === 'local') {
        setSettingsMessage('Configuración guardada. Motor local SQLite activo.');
        return;
      }
      if (serviceStatus && serviceStatus.dockerAvailable === false) {
        setSettingsMessage('Carpetas guardadas correctamente.');
        return;
      }
      setSettingsMessage('Carpetas y configuración guardadas. Los servicios fueron reiniciados cuando Docker está disponible.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No pudimos guardar la configuración.';
      setSettingsError(message);
      throw error instanceof Error ? error : new Error(message);
    } finally {
      setIsSavingSettings(false);
    }
  }

  async function reloadSettings(): Promise<void> {
    await loadSettings();
  }

  async function loadSettings(): Promise<void> {
    try {
      const loadedSettings = await getWorkspaceSettings();
      if (loadedSettings) {
        setSettings({ ...emptySettings, ...loadedSettings });
        setBackendBaseUrl(loadedSettings.backendUrl);
      }
    } catch {
      setSettings(emptySettings);
    }
  }

  return {
    settings,
    isSavingSettings,
    settingsMessage,
    settingsError,
    setInputPath,
    setStoragePath,
    setDeploymentMode,
    setGatewayUrl,
    setGatewayToken,
    setDefaultProvider,
    setGoogleApiKey,
    setGoogleModel,
    setGoogleEmbeddingModel,
    setAnthropicApiKey,
    setAnthropicModel,
    setOpenAIApiKey,
    setOpenAIModel,
    setOpenAIEmbeddingModel,
    setEmbeddingProvider,
    setEnableAnthropicFallback,
    setMinExtractionConfidence,
    setMaxRunBudgetUsd,
    setBackendUrl,
    selectInputPath,
    selectStoragePath,
    persistSettings,
    reloadSettings,
  };
}
