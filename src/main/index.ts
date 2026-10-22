import { app, BrowserWindow, dialog, ipcMain, shell, type OpenDialogOptions } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { probeAudioDuration } from '../modules/audio/probe';
import { AUDIO_EXTENSIONS } from '../modules/audio';
import { type SelectedAudioFile } from '../modules/files';
import { AppStore } from '../modules/database/store';
import type { AppSettings } from '../modules/settings';
import { findExecutableOnPath, getWhisperModelStatus, transcribeAudio, WHISPER_MODELS, type TranscriptionOptions, type WhisperModel } from '../modules/transcription';

const isDev = process.env.NODE_ENV === 'development';
let store: AppStore | undefined;
const activeTranscriptions = new Map<string, AbortController>();

function getStore(): AppStore {
  if (!store) throw new Error('O armazenamento local ainda não foi inicializado.');
  return store;
}

function getSupportedModel(model: string): WhisperModel {
  const supported = WHISPER_MODELS.find((entry) => entry.value === model);
  if (!supported) throw new Error(`Modelo não suportado: ${model}`);
  return supported.value;
}

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
  store = new AppStore(path.join(app.getPath('userData'), 'lucao-data.json'));
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  store?.close();
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
    defaultPath: getStore().getSettings().inputFolder || app.getPath('documents'),
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
ipcMain.handle('app:select-directory', async (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  const options: OpenDialogOptions = {
    title: 'Selecionar diretório',
    properties: ['openDirectory', 'createDirectory'],
  };
  const selection = window
    ? await dialog.showOpenDialog(window, options)
    : await dialog.showOpenDialog(options);
  return selection.canceled ? null : selection.filePaths[0] ?? null;
});
ipcMain.handle('app:open-path', async (_event, filePath: string) => {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Caminho inválido');
  }
  const normalized = path.resolve(filePath);
  if (!(await fs.stat(normalized).catch(() => null))) throw new Error('O caminho informado não existe.');
  await shell.openPath(normalized);
});

ipcMain.handle('files:getAll', () => getStore().listFiles());
ipcMain.handle('files:add', async (_event, file: SelectedAudioFile) => {
  if (!file || typeof file.path !== 'string' || !path.isAbsolute(file.path)) {
    throw new Error('Arquivo de áudio inválido.');
  }
  if (!AUDIO_EXTENSIONS.includes(path.extname(file.path).toLowerCase())) {
    throw new Error(`Formato de áudio não suportado: ${path.extname(file.path) || 'sem extensão'}.`);
  }

  const fileInfo = await fs.stat(file.path);
  if (!fileInfo.isFile()) {
    throw new Error('O caminho selecionado não é um arquivo.');
  }

  const ffprobePath = findExecutableOnPath(['ffprobe', 'ffprobe.exe']);
  const durationSeconds = ffprobePath ? await probeAudioDuration(file.path, ffprobePath) : undefined;
  return getStore().addFile(file, fileInfo.size, durationSeconds);
});
ipcMain.handle('files:remove', (_event, filePath: string) => {
  const file = getStore().getFile(filePath);
  if (file?.status === 'processing') throw new Error('Cancele a tarefa antes de remover o arquivo.');
  return getStore().removeFile(filePath);
});
ipcMain.handle('files:clear-completed', () => getStore().clearCompletedFiles());
ipcMain.handle('files:clear-pending', () => getStore().clearPendingFiles());
ipcMain.handle(
  'files:updateStatus',
  (_event, filePath: string, status: string, transcript?: string, error?: string) => {
    if (!['waiting', 'queued', 'processing', 'done', 'error', 'cancelled'].includes(status)) {
      throw new Error('Status de arquivo inválido.');
    }
    return getStore().updateFile(filePath, { status: status as 'waiting' | 'queued' | 'processing' | 'done' | 'error' | 'cancelled', transcript, error });
  },
);

ipcMain.handle('settings:get', () => getStore().getSettings());
ipcMain.handle('settings:save', async (_event, settings: Partial<AppSettings>) => {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    throw new Error('Configurações inválidas.');
  }
  const modelDirectory = settings.modelsFolder ?? getStore().getSettings().modelsFolder;
  if (settings.defaultModel !== undefined && !getWhisperModelStatus(settings.defaultModel, modelDirectory).installed) {
    throw new Error(`O modelo "${settings.defaultModel}" não está instalado. Selecione um modelo disponível.`);
  }
  for (const directory of [settings.inputFolder, settings.outputFolder, settings.modelsFolder]) {
    if (directory) {
      const directoryInfo = await fs.stat(directory).catch(() => null);
      if (!directoryInfo?.isDirectory()) throw new Error(`A pasta não existe ou não pode ser acessada: ${directory}`);
    }
  }
  if (process.platform === 'win32' && settings.startWithWindows !== undefined) {
    app.setLoginItemSettings({ openAtLogin: settings.startWithWindows });
  }
  return getStore().saveSettings(settings);
});

ipcMain.handle('transcriptions:list', () => getStore().listFiles().map((file) => ({
  id: file.path,
  fileName: file.name,
  originalPath: file.path,
  duration: file.durationSeconds ? `${Math.floor(file.durationSeconds / 60)}:${String(Math.floor(file.durationSeconds % 60)).padStart(2, '0')}` : '',
  language: file.language,
  model: file.model,
  createdAt: file.createdAt,
  status: file.status === 'waiting' || file.status === 'queued' ? 'waiting' : file.status === 'processing' ? 'transcribing' : file.status === 'done' ? 'completed' : file.status === 'cancelled' ? 'cancelled' : 'failed',
  resultPath: file.resultPath,
  transcriptText: file.transcript,
  errorMessage: file.error,
})));
ipcMain.handle('transcriptions:history', () => getStore().listHistory());
ipcMain.handle('transcriptions:delete-history', (_event, filePath: string) => getStore().deleteHistory(filePath));
ipcMain.handle('transcriptions:export-text', async (_event, filePath: string, transcript: string) => {
  if (typeof transcript !== 'string' || transcript.length === 0) {
    throw new Error('Não há texto de transcrição para exportar.');
  }
  const defaultName = `${path.basename(filePath, path.extname(filePath))}-transcricao.txt`;
  const outputFolder = getStore().getSettings().outputFolder || path.dirname(filePath);
  const selection = await dialog.showSaveDialog({
    title: 'Exportar transcrição',
    defaultPath: path.join(outputFolder, defaultName),
    filters: [{ name: 'Texto', extensions: ['txt'] }],
  });
  if (selection.canceled || !selection.filePath) return null;
  await fs.writeFile(selection.filePath, transcript, 'utf8');
  getStore().log('info', `Transcrição exportada: ${path.basename(selection.filePath)}`);
  return selection.filePath;
});

ipcMain.handle('models:list', () => {
  const settings = getStore().getSettings();
  return WHISPER_MODELS.map((model) => ({
    ...model,
    ...getWhisperModelStatus(model.value, settings.modelsFolder),
    selected: settings.defaultModel === model.value,
  }));
});

ipcMain.handle('diagnostics:check', async () => {
  const ffmpegPath = findExecutableOnPath(['ffmpeg', 'ffmpeg.exe']);
  const whisperPath = findExecutableOnPath(['whisper-cli', 'whisper-cli.exe', 'main', 'main.exe']);
  const settings = getStore().getSettings();
  const selectedModel = getWhisperModelStatus(settings.defaultModel, settings.modelsFolder);
  const dataDirectory = app.getPath('userData');
  const results = await Promise.all([
    fs.access(dataDirectory, fs.constants.R_OK | fs.constants.W_OK).then(() => true, () => false),
    ffmpegPath ? fs.access(ffmpegPath, fs.constants.X_OK).then(() => true, () => false) : Promise.resolve(false),
  ]);
  return {
    ffmpeg: Boolean(ffmpegPath) && results[1],
    ffmpegPath,
    whisper: Boolean(whisperPath),
    whisperPath,
    model: selectedModel,
    dataDirectory,
    storageWritable: results[0],
  };
});

ipcMain.handle('logs:list', (_event, limit?: number) => getStore().listLogs(limit));
ipcMain.handle('logs:clear', () => {
  getStore().clearLogs();
});
ipcMain.handle('logs:export', async () => {
  const selection = await dialog.showSaveDialog({
    title: 'Exportar logs do LUCAO',
    defaultPath: path.join(app.getPath('documents'), 'lucao-logs.json'),
    filters: [{ name: 'JSON', extensions: ['json'] }, { name: 'Texto', extensions: ['txt'] }],
  });
  if (selection.canceled || !selection.filePath) return null;
  const content = selection.filePath.toLowerCase().endsWith('.txt')
    ? getStore().listLogs(5000).map((log) =>
      `[${log.createdAt}] ${log.level.toUpperCase()} ${log.message}${log.details ? ` — ${log.details}` : ''}`,
    ).join('\n')
    : JSON.stringify(getStore().listLogs(5000), null, 2);
  await fs.writeFile(selection.filePath, content, 'utf8');
  return selection.filePath;
});

ipcMain.handle('transcriptions:cancel', (_event, filePath: string) => {
  const controller = activeTranscriptions.get(filePath);
  if (!controller) return false;
  controller.abort();
  return true;
});
async function runTranscription(event: Electron.IpcMainInvokeEvent, filePath: string, options?: TranscriptionOptions) {
  if (!filePath) {
    throw new Error('Arquivo de origem não informado.');
  }
  if (!path.isAbsolute(filePath) || !AUDIO_EXTENSIONS.includes(path.extname(filePath).toLowerCase())) {
    throw new Error('O caminho informado não é um arquivo de áudio suportado.');
  }

  const appStore = getStore();
  if (activeTranscriptions.size > 0) throw new Error('O motor processa uma tarefa por vez. Aguarde ou cancele a transcrição atual.');
  const settings = appStore.getSettings();
  const file = appStore.getFile(filePath);
  if (!file) throw new Error('Adicione o arquivo à fila antes de iniciar a transcrição.');
  if (file.status === 'processing') throw new Error('Este arquivo já está sendo transcrito.');
  const language = options?.language ?? settings.defaultLanguage;
  if (typeof language !== 'string' || !['pt-BR', 'en', 'auto'].includes(language)) {
    throw new Error(`Idioma de transcrição não suportado: ${language}`);
  }
  const transcriptionOptions: TranscriptionOptions = {
    model: options?.model === undefined ? getSupportedModel(settings.defaultModel) : getSupportedModel(options.model),
    language: language === 'auto' ? settings.defaultLanguage : language,
    autoDetectLanguage: options?.autoDetectLanguage ?? language === 'auto',
    outputDir: settings.outputFolder || undefined,
    modelsDirectory: settings.modelsFolder || undefined,
    keepTemporaryFiles: settings.keepTemporaryFiles,
  };
  const controller = new AbortController();
  activeTranscriptions.set(filePath, controller);
  appStore.updateFile(filePath, {
    status: 'processing',
    progressPercent: 0,
    model: transcriptionOptions.model,
    language: transcriptionOptions.language,
  });
  appStore.log('info', `Transcrição iniciada: ${file?.name ?? path.basename(filePath)}`);

  try {
    const result = await transcribeAudio(filePath, {
      ...transcriptionOptions,
      signal: controller.signal,
      onProgress: (line) => {
        const match = line.match(/(\d{1,3})\s*%/);
        const progressPercent = match ? Math.max(0, Math.min(100, Number(match[1]))) : undefined;
        if (progressPercent !== undefined) {
          appStore.updateFile(filePath, { progressPercent });
          if (!event.sender.isDestroyed()) event.sender.send('transcriptions:progress', { filePath, progressPercent });
        }
      },
    });
    appStore.updateFile(filePath, {
      status: 'done',
      progressPercent: 100,
      transcript: result.transcript,
      resultPath: result.outputPath,
      model: result.model,
      language: result.language,
    });
    appStore.log('info', `Transcrição concluída: ${file?.name ?? path.basename(filePath)}`);
    return result;
  } catch (error) {
    if (controller.signal.aborted) {
      appStore.updateFile(filePath, { status: 'cancelled', progressPercent: 0 });
      appStore.log('warn', `Transcrição cancelada: ${file?.name ?? path.basename(filePath)}`);
    } else {
      const message = error instanceof Error ? error.message : 'Falha desconhecida durante a transcrição.';
      appStore.updateFile(filePath, { status: 'error', error: message });
      appStore.log('error', `Falha na transcrição: ${file?.name ?? path.basename(filePath)}`, message);
    }
    throw error;
  } finally {
    activeTranscriptions.delete(filePath);
  }
}

ipcMain.handle('transcriptions:create', (event, filePath: string, options?: TranscriptionOptions) =>
  runTranscription(event, filePath, options));
ipcMain.handle('transcriptions:transcribe', (event, filePath: string, options?: TranscriptionOptions) =>
  runTranscription(event, filePath, options));

ipcMain.handle('app:open-external', async (_event, url: string) => {
  await shell.openExternal(url);
});
