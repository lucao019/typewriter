import { app, BrowserWindow, dialog, ipcMain, shell, type OpenDialogOptions } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { transcribeAudio } from '../modules/transcription';

const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 1000,
    minWidth: 1100,
    minHeight: 760,
    backgroundColor: '#0b0b11',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const indexPath = isDev
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, '../renderer/index.html')}`;

  void win.loadURL(indexPath);

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('app:get-version', () => app.getVersion());
ipcMain.handle('audio:select-files', async (event) => {
  const options: OpenDialogOptions = {
    title: 'Selecionar arquivos de áudio',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Arquivos de áudio', extensions: ['wav', 'mp3', 'm4a', 'aac', 'flac', 'ogg', 'opus', 'webm'] },
      { name: 'Todos os arquivos', extensions: ['*'] },
    ],
  };
  const window = BrowserWindow.fromWebContents(event.sender);
  const selection = window
    ? await dialog.showOpenDialog(window, options)
    : await dialog.showOpenDialog(options);

  if (selection.canceled) return [];

  return Promise.all(selection.filePaths.map(async (filePath) => {
    const fileInfo = await fs.stat(filePath);
    return {
      path: filePath,
      name: path.basename(filePath),
      size: fileInfo.size,
      type: path.extname(filePath).toLowerCase(),
    };
  }));
});
ipcMain.handle('app:open-path', async (_event, filePath: string) => {
  const normalized = path.normalize(filePath);
  if (!normalized || normalized.includes('..')) {
    throw new Error('Caminho inválido');
  }
  await shell.openPath(normalized);
});

ipcMain.handle('transcriptions:list', async () => []);
ipcMain.handle('transcriptions:create', async (_event, filePath: string, options?: Partial<Record<string, unknown>>) => {
  if (!filePath) {
    throw new Error('Arquivo de origem não informado.');
  }

  return transcribeAudio(filePath, options as Partial<Record<string, unknown>> & { outputDir?: string });
});
ipcMain.handle('transcriptions:transcribe', async (_event, filePath: string, options?: Partial<Record<string, unknown>>) => {
  if (!filePath) {
    throw new Error('Arquivo de origem não informado.');
  }

  return transcribeAudio(filePath, options as Partial<Record<string, unknown>> & { outputDir?: string });
});

ipcMain.handle('app:open-external', async (_event, url: string) => {
  await shell.openExternal(url);
});
