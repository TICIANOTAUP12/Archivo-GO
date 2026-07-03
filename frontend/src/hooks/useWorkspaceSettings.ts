import { useEffect, useState } from 'react';
import {
  getWorkspaceSettings,
  saveWorkspaceSettings,
  selectNativeDirectory,
  type WorkspaceSettings,
} from '../api/native';

type UseWorkspaceSettingsResult = {
  settings: WorkspaceSettings;
  isSavingSettings: boolean;
  settingsMessage: string | null;
  settingsError: string | null;
  setInputPath: (path: string) => void;
  setStoragePath: (path: string) => void;
  setDefaultProvider: (provider: WorkspaceSettings['defaultProvider']) => void;
  setGoogleApiKey: (apiKey: string) => void;
  setGoogleModel: (model: string) => void;
  setGoogleEmbeddingModel: (model: string) => void;
  setAnthropicApiKey: (apiKey: string) => void;
  setAnthropicModel: (model: string) => void;
  setEmbeddingProvider: (provider: WorkspaceSettings['embeddingProvider']) => void;
  setEnableAnthropicFallback: (isEnabled: boolean) => void;
  setMinExtractionConfidence: (confidence: number) => void;
  setMaxRunBudgetUsd: (budget: number) => void;
  selectInputPath: () => Promise<void>;
  selectStoragePath: () => Promise<void>;
  persistSettings: () => Promise<void>;
};

const emptySettings: WorkspaceSettings = {
  inputPath: '',
  storagePath: '',
  defaultProvider: 'google',
  googleApiKey: '',
  googleModel: 'gemini-2.5-flash',
  googleEmbeddingModel: 'gemini-embedding-001',
  anthropicApiKey: '',
  anthropicModel: 'claude-haiku-4-5',
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

  function setEmbeddingProvider(provider: WorkspaceSettings['embeddingProvider']): void {
    setSettings((currentSettings) => ({ ...currentSettings, embeddingProvider: provider }));
  }

  function setEnableAnthropicFallback(isEnabled: boolean): void {
    setSettings((currentSettings) => ({ ...currentSettings, enableAnthropicFallback: isEnabled }));
  }

  function setMinExtractionConfidence(confidence: number): void {
    setSettings((currentSettings) => ({ ...currentSettings, minExtractionConfidence: confidence }));
  }

  function setMaxRunBudgetUsd(budget: number): void {
    setSettings((currentSettings) => ({ ...currentSettings, maxRunBudgetUsd: budget }));
  }

  async function selectInputPath(): Promise<void> {
    const selectedPath = await selectNativeDirectory('Seleccionar carpeta de origen');
    if (selectedPath) setInputPath(selectedPath);
  }

  async function selectStoragePath(): Promise<void> {
    const selectedPath = await selectNativeDirectory('Seleccionar carpeta donde guardar casos');
    if (selectedPath) setStoragePath(selectedPath);
  }

  async function persistSettings(): Promise<void> {
    setIsSavingSettings(true);
    setSettingsError(null);
    setSettingsMessage(null);
    try {
      await saveWorkspaceSettings(settings);
      setSettingsMessage('Configuración guardada. Los servicios fueron reiniciados con los valores actuales.');
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : 'No pudimos guardar la configuración.');
    } finally {
      setIsSavingSettings(false);
    }
  }

  async function loadSettings(): Promise<void> {
    try {
      const loadedSettings = await getWorkspaceSettings();
      if (loadedSettings) setSettings(loadedSettings);
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
    setDefaultProvider,
    setGoogleApiKey,
    setGoogleModel,
    setGoogleEmbeddingModel,
    setAnthropicApiKey,
    setAnthropicModel,
    setEmbeddingProvider,
    setEnableAnthropicFallback,
    setMinExtractionConfidence,
    setMaxRunBudgetUsd,
    selectInputPath,
    selectStoragePath,
    persistSettings,
  };
}
