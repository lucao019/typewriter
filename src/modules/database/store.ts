import fs from 'node:fs';
import path from 'node:path';
import type { AudioFile, AudioFileStatus, SelectedAudioFile } from '../files';
import { DEFAULT_SETTINGS, normalizeSettings, type AppSettings } from '../settings';

export type AppLog = {
  id: number;
  level: 'info' | 'warn' | 'error';
  message: string;
  details?: string;
  createdAt: string;
};

type StoreData = {
  files: AudioFile[];
  settings: AppSettings;
  logs: AppLog[];
  nextLogId: number;
};

const createInitialData = (): StoreData => ({
  files: [],
  settings: { ...DEFAULT_SETTINGS },
  logs: [],
  nextLogId: 1,
});

export class AppStore {
  private readonly filePath: string;
  private data: StoreData;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.data = this.load();
    this.recoverInterruptedTasks();
  }

  listFiles(): AudioFile[] {
    return this.data.files.filter((file) => !file.removedFromQueue).map((file) => ({ ...file }));
  }

  listHistory(): AudioFile[] {
    return this.data.files
      .filter((file) => ['done', 'error', 'cancelled'].includes(file.status))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((file) => ({ ...file }));
  }

  addFile(file: SelectedAudioFile, size: number, durationSeconds?: number): AudioFile {
    const existingIndex = this.data.files.findIndex((item) => item.path === file.path);
    if (existingIndex >= 0) {
      const existing = this.data.files[existingIndex];
      const updated: AudioFile = {
        ...existing,
        ...file,
        size,
        status: 'waiting',
        error: undefined,
        transcript: undefined,
        resultPath: undefined,
        progressPercent: 0,
        removedFromQueue: false,
        updatedAt: new Date().toISOString(),
        durationSeconds: durationSeconds ?? existing.durationSeconds,
      };
      this.data.files[existingIndex] = updated;
      this.log('info', `Arquivo adicionado novamente à fila: ${file.name}`);
      this.persist();
      return { ...updated };
    }

    const createdAt = new Date().toISOString();
    const audioFile: AudioFile = {
      ...file,
      size,
      status: 'waiting',
      createdAt,
      updatedAt: createdAt,
      model: this.data.settings.defaultModel,
      language: this.data.settings.defaultLanguage,
      durationSeconds,
    };
    this.data.files.push(audioFile);
    this.log('info', `Arquivo adicionado à fila: ${file.name}`);
    this.persist();
    return { ...audioFile };
  }

  getFile(filePath: string): AudioFile | undefined {
    const file = this.data.files.find((item) => item.path === filePath);
    return file ? { ...file } : undefined;
  }

  updateFile(
    filePath: string,
    update: {
      status?: AudioFileStatus;
      transcript?: string;
      error?: string;
      model?: string;
      language?: string;
      durationSeconds?: number;
      progressPercent?: number;
      resultPath?: string;
    },
  ): boolean {
    const file = this.data.files.find((item) => item.path === filePath);
    if (!file) return false;

    if (update.status !== undefined) file.status = update.status;
    if (update.transcript !== undefined) file.transcript = update.transcript;
    if (update.model !== undefined) file.model = update.model;
    if (update.language !== undefined) file.language = update.language;
    if (update.durationSeconds !== undefined) file.durationSeconds = update.durationSeconds;
    if (update.progressPercent !== undefined) file.progressPercent = update.progressPercent;
    if (update.resultPath !== undefined) file.resultPath = update.resultPath;
    if (update.error !== undefined) file.error = update.error;
    else if (update.status !== undefined && update.status !== 'error') delete file.error;
    file.updatedAt = new Date().toISOString();
    this.persist();
    return true;
  }

  removeFile(filePath: string): boolean {
    const index = this.data.files.findIndex((file) => file.path === filePath);
    if (index === -1) return false;
    const file = this.data.files[index];
    if (file.status === 'done' || file.status === 'error') {
      file.removedFromQueue = true;
      file.updatedAt = new Date().toISOString();
      this.log('info', `Arquivo removido da fila e preservado no histórico: ${file.name}`);
    } else {
      this.data.files.splice(index, 1);
      this.log('info', `Arquivo removido da fila: ${file.name}`);
    }
    this.persist();
    return true;
  }

  clearCompletedFiles(): number {
    const before = this.data.files.filter((file) => !file.removedFromQueue).length;
    for (const file of this.data.files) {
      if (file.status === 'done' || file.status === 'cancelled') file.removedFromQueue = true;
    }
    const removed = before - this.data.files.filter((file) => !file.removedFromQueue).length;
    this.persist();
    return removed;
  }

  clearPendingFiles(): number {
    const before = this.data.files.length;
    this.data.files = this.data.files.filter((file) => file.status !== 'waiting' && file.status !== 'queued');
    const removed = before - this.data.files.length;
    if (removed) this.log('info', `${removed} tarefa(s) pendente(s) removida(s) da fila.`);
    this.persist();
    return removed;
  }

  deleteHistory(filePath: string): boolean {
    const index = this.data.files.findIndex((file) =>
      file.path === filePath && ['done', 'error', 'cancelled'].includes(file.status));
    if (index === -1) return false;
    this.data.files.splice(index, 1);
    this.log('info', 'Registro removido do histórico.');
    this.persist();
    return true;
  }

  getSettings(): AppSettings {
    return { ...this.data.settings };
  }

  saveSettings(settings: Partial<AppSettings>): AppSettings {
    this.data.settings = normalizeSettings({ ...this.data.settings, ...settings });
    this.log('info', 'Configurações atualizadas.');
    this.persist();
    return this.getSettings();
  }

  listLogs(limit = 500): AppLog[] {
    return this.data.logs.slice(-Math.max(1, Math.min(5000, limit))).reverse().map((entry) => ({ ...entry }));
  }

  log(level: AppLog['level'], message: string, details?: string): void {
    const levels: Record<AppLog['level'], number> = { info: 1, warn: 2, error: 3 };
    const threshold = this.data.settings.logLevel === 'debug' ? 'info' : this.data.settings.logLevel;
    if (levels[level] < levels[threshold]) return;

    this.data.logs.push({
      id: this.data.nextLogId++,
      level,
      message,
      details,
      createdAt: new Date().toISOString(),
    });
    if (this.data.logs.length > 5000) this.data.logs.splice(0, this.data.logs.length - 5000);
    this.persist();
  }

  clearLogs(): void {
    this.data.logs = [];
    this.persist();
  }

  close(): void {
    this.persist();
  }

  private load(): StoreData {
    if (!fs.existsSync(this.filePath)) return createInitialData();
    try {
      const loaded = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as Partial<StoreData>;
      return {
        files: Array.isArray(loaded.files) ? loaded.files : [],
        settings: normalizeSettings(loaded.settings),
        logs: Array.isArray(loaded.logs) ? loaded.logs : [],
        nextLogId: Number.isInteger(loaded.nextLogId) ? Number(loaded.nextLogId) : 1,
      };
    } catch (error) {
      throw new Error(`Não foi possível ler o armazenamento local (${this.filePath}): ${error instanceof Error ? error.message : 'arquivo inválido'}`);
    }
  }

  private persist(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
    try {
      fs.writeFileSync(temporaryPath, JSON.stringify(this.data), 'utf8');
      fs.renameSync(temporaryPath, this.filePath);
    } catch (error) {
      if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
      throw new Error(`Não foi possível salvar os dados locais: ${error instanceof Error ? error.message : 'erro desconhecido'}`);
    }
  }

  private recoverInterruptedTasks(): void {
    const interrupted = this.data.files.filter((file) => file.status === 'queued' || file.status === 'processing');
    for (const file of interrupted) {
      file.status = 'waiting';
      file.updatedAt = new Date().toISOString();
    }
    if (interrupted.length) {
      this.log('warn', `${interrupted.length} tarefa(s) interrompida(s) retornaram para a fila.`);
    }
  }
}
