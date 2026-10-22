import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { normalizeSettings, DEFAULT_SETTINGS } from '../modules/settings';
import { checkTooling } from '../modules/diagnostics';
import { createWhisperConfig, WHISPER_MODELS } from '../modules/transcription';
import { isSupportedAudioFile, formatAudioDuration } from '../modules/audio';
import { TaskQueue } from '../modules/queue';
import { createTranscriptionRecord } from '../modules/database';
import { AppStore } from '../modules/database/store';
import { serializeTranscript } from '../modules/export';
import { findExecutableOnPath } from '../modules/transcription';

describe('LUCAO baseline', () => {
  it('normalizes settings and keeps defaults', () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    const custom = normalizeSettings({ defaultLanguage: 'pt-BR', maxConcurrentTasks: 3, startWithWindows: true });
    expect(custom.defaultLanguage).toBe('pt-BR');
    expect(custom.maxConcurrentTasks).toBe(1);
    expect(custom.startWithWindows).toBe(true);
  });

  it('reports whether local transcription tools are available', () => {
    const status = checkTooling();
    expect(typeof status.ffmpeg).toBe('boolean');
    expect(typeof status.whisper).toBe('boolean');
    if (status.ffmpeg && status.whisper) {
      expect(status.notes).toContain('Ambientes locais detectados e prontos para transcrição real em máquina local.');
    } else {
      expect(status.notes.length).toBeGreaterThan(0);
    }
  });

  it('exposes whisper model metadata and defaults', () => {
    expect(WHISPER_MODELS.length).toBeGreaterThan(3);
    expect(createWhisperConfig().model).toBe('small');
    expect(createWhisperConfig({ model: 'large' }).model).toBe('large');
  });

  it('finds executables by searching PATH directories', () => {
    const previousPath = process.env.PATH;
    const testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'lucao-whisper-path-'));
    const executableName = process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli';
    const executablePath = path.join(testDirectory, executableName);

    try {
      fs.writeFileSync(executablePath, '');
      process.env.PATH = testDirectory;

      expect(findExecutableOnPath([executableName])).toBe(executablePath);
    } finally {
      process.env.PATH = previousPath;
      fs.rmSync(testDirectory, { recursive: true, force: true });
    }
  });

  it('accepts supported audio files and formats only measured durations', () => {
    expect(isSupportedAudioFile('audio.mp3')).toBe(true);
    expect(isSupportedAudioFile('audio.txt')).toBe(false);
    expect(formatAudioDuration(402)).toBe('6:42');
    expect(formatAudioDuration(undefined)).toBe('Duração indisponível');
  });

  it('manages a task queue with real lifecycle states', () => {
    const queue = new TaskQueue();
    const task = queue.addTask('C:/audio/test.mp3', 'pt-BR', 'small');
    expect(task.status).toBe('waiting');
    expect(queue.cancelTask(task.id)).toBe(true);
    expect(queue.list()[0].status).toBe('cancelled');
  });

  it('creates a database record and serializes export formats', () => {
    const record = createTranscriptionRecord({ id: 'tx-1', fileName: 'demo.mp3', originalPath: 'C:/audio/demo.mp3' });
    expect(record.language).toBe('pt-BR');
    expect(serializeTranscript('Olá mundo', 'txt')).toBe('Olá mundo');
    expect(serializeTranscript('Olá mundo', 'vtt')).toContain('WEBVTT');
  });

  it('persists file records, settings, and logs across database sessions', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lucao-store-'));
    const databasePath = path.join(directory, 'test.json');
    const audio = {
      path: path.join(directory, 'sample.wav'),
      name: 'sample.wav',
      size: 128,
      type: '.wav',
    };
    let store = new AppStore(databasePath);

    try {
      const file = store.addFile(audio, audio.size);
      expect(file.status).toBe('waiting');
      expect(store.updateFile(audio.path, {
        status: 'done',
        transcript: 'Olá mundo',
        resultPath: path.join(directory, 'sample-transcricao.txt'),
      })).toBe(true);
      store.addFile({ ...audio, path: path.join(directory, 'pending.wav'), name: 'pending.wav' }, audio.size);
      expect(store.clearPendingFiles()).toBe(1);
      expect(store.saveSettings({ defaultLanguage: 'pt-BR', defaultModel: 'base' }).defaultModel).toBe('base');
      store.log('info', 'Teste de persistência');
      store.close();

      store = new AppStore(databasePath);
      expect(store.listFiles()[0].transcript).toBe('Olá mundo');
      expect(store.listFiles()[0].resultPath).toBe(path.join(directory, 'sample-transcricao.txt'));
      expect(store.listHistory()[0].status).toBe('done');
      expect(store.getSettings().defaultModel).toBe('base');
      expect(store.listLogs()[0].message).toBe('Teste de persistência');
    } finally {
      store.close();
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
