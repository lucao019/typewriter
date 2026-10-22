import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type { AudioFile, AudioFileStatus, SelectedAudioFile } from '../modules/files';
import type { AppSettings } from '../modules/settings';
import type { AppLog } from '../modules/database/store';
import type { TranscriptionOptions, TranscriptionResult, WhisperModel } from '../modules/transcription';

export type ModelStatus = {
  value: WhisperModel;
  label: string;
  memoryMb: number;
  speed: string;
  precision: string;
  installed: boolean;
  modelPath?: string;
  selectedExecutable?: string;
  selected: boolean;
};

const api = {
  app: {
    getVersion: () => ipcRenderer.invoke('app:get-version'),
    selectAudioFiles: (): Promise<SelectedAudioFile[]> => ipcRenderer.invoke('audio:select-files'),
    getDroppedAudioFiles: (files: File[]): SelectedAudioFile[] => files.flatMap((file) => {
      const filePath = webUtils.getPathForFile(file);
      return filePath ? [{ path: filePath, name: file.name, size: file.size, type: file.type }] : [];
    }),
    selectDirectory: (): Promise<string | null> => ipcRenderer.invoke('app:select-directory'),
    openPath: (filePath: string) => ipcRenderer.invoke('app:open-path', filePath),
    openExternal: (url: string) => ipcRenderer.invoke('app:open-external', url),
  },
  files: {
    getAll: (): Promise<AudioFile[]> => ipcRenderer.invoke('files:getAll'),
    add: (file: SelectedAudioFile): Promise<AudioFile> => ipcRenderer.invoke('files:add', file),
    remove: (filePath: string): Promise<boolean> => ipcRenderer.invoke('files:remove', filePath),
    clearCompleted: (): Promise<number> => ipcRenderer.invoke('files:clear-completed'),
    clearPending: (): Promise<number> => ipcRenderer.invoke('files:clear-pending'),
    updateStatus: (
      filePath: string,
      status: AudioFileStatus,
      transcript?: string,
      error?: string,
    ): Promise<boolean> => ipcRenderer.invoke('files:updateStatus', filePath, status, transcript, error),
  },
  transcriptions: {
    list: () => ipcRenderer.invoke('transcriptions:list'),
    history: () => ipcRenderer.invoke('transcriptions:history'),
    deleteHistory: (filePath: string): Promise<boolean> => ipcRenderer.invoke('transcriptions:delete-history', filePath),
    exportText: (filePath: string, transcript: string): Promise<string | null> =>
      ipcRenderer.invoke('transcriptions:export-text', filePath, transcript),
    create: (filePath: string, options?: TranscriptionOptions): Promise<TranscriptionResult> =>
      ipcRenderer.invoke('transcriptions:create', filePath, options),
    transcribe: (filePath: string, options?: TranscriptionOptions): Promise<TranscriptionResult> =>
      ipcRenderer.invoke('transcriptions:transcribe', filePath, options),
    cancel: (filePath: string): Promise<boolean> => ipcRenderer.invoke('transcriptions:cancel', filePath),
    onProgress: (callback: (progress: { filePath: string; progressPercent: number }) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, progress: { filePath: string; progressPercent: number }) => callback(progress);
      ipcRenderer.on('transcriptions:progress', listener);
      return () => ipcRenderer.removeListener('transcriptions:progress', listener);
    },
  },
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
    save: (settings: Partial<AppSettings>): Promise<AppSettings> => ipcRenderer.invoke('settings:save', settings),
  },
  models: {
    list: (): Promise<ModelStatus[]> => ipcRenderer.invoke('models:list'),
  },
  diagnostics: {
    check: (): Promise<{
      ffmpeg: boolean;
      ffmpegPath?: string;
      whisper: boolean;
      whisperPath?: string;
      model: { installed: boolean; modelPath?: string };
      dataDirectory: string;
      storageWritable: boolean;
    }> => ipcRenderer.invoke('diagnostics:check'),
  },
  logs: {
    list: (limit?: number): Promise<AppLog[]> => ipcRenderer.invoke('logs:list', limit),
    clear: (): Promise<void> => ipcRenderer.invoke('logs:clear'),
    export: (): Promise<string | null> => ipcRenderer.invoke('logs:export'),
  },
};

contextBridge.exposeInMainWorld('lucao', api);

export type LucaoAPI = typeof api;

declare global {
  interface Window {
    lucao: LucaoAPI;
  }
}
