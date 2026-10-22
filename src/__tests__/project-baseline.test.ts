import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { normalizeSettings, DEFAULT_SETTINGS } from '../modules/settings';
import { checkTooling } from '../modules/diagnostics';
import { createWhisperConfig, WHISPER_MODELS } from '../modules/transcription';
import { isSupportedAudioFile, getAudioDurationEstimate } from '../modules/audio';
import { TaskQueue } from '../modules/queue';
import { createTranscriptionRecord } from '../modules/database';
import { serializeTranscript } from '../modules/export';
import { findExecutableOnPath } from '../modules/transcription';

describe('LUCAO baseline', () => {
  it('normalizes settings and keeps defaults', () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    const custom = normalizeSettings({ defaultLanguage: 'pt-BR', maxConcurrentTasks: 3, startWithWindows: true });
    expect(custom.defaultLanguage).toBe('pt-BR');
    expect(custom.maxConcurrentTasks).toBe(3);
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

  it('accepts the desired audio extensions and estimates duration', () => {
    expect(isSupportedAudioFile('audio.mp3')).toBe(true);
    expect(isSupportedAudioFile('audio.txt')).toBe(false);
    expect(getAudioDurationEstimate('long_audio.wav')).toMatch(/\d{2}:\d{2}/);
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
});
