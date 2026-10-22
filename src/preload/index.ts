import { contextBridge, ipcRenderer } from 'electron';

const api = {
  app: {
    getVersion: () => ipcRenderer.invoke('app:get-version'),
    selectAudioFiles: () => ipcRenderer.invoke('audio:select-files'),
    openPath: (filePath: string) => ipcRenderer.invoke('app:open-path', filePath),
    openExternal: (url: string) => ipcRenderer.invoke('app:open-external', url),
  },
  transcriptions: {
    list: () => ipcRenderer.invoke('transcriptions:list'),
    create: (filePath: string, options?: Record<string, unknown>) => ipcRenderer.invoke('transcriptions:create', filePath, options),
    transcribe: (filePath: string, options?: Record<string, unknown>) => ipcRenderer.invoke('transcriptions:transcribe', filePath, options),
  },
  settings: {
    get: () => Promise.resolve({}),
    save: () => Promise.resolve(true),
  },
};

contextBridge.exposeInMainWorld('lucao', api);

export type LucaoAPI = typeof api;

declare global {
  interface Window {
    lucao: LucaoAPI;
  }
}
