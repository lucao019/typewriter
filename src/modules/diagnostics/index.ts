import { findExecutableOnPath } from '../transcription';

export type DiagnosticsStatus = {
  ffmpeg: boolean;
  whisper: boolean;
  ffmpegVersion?: string;
  whisperVersion?: string;
  notes: string[];
};

export function checkTooling(): DiagnosticsStatus {
  const notes: string[] = [];
  const ffmpegPath = findExecutableOnPath(['ffmpeg', 'ffmpeg.exe']);
  const whisperPath = findExecutableOnPath(['whisper', 'whisper.exe', 'main', 'main.exe', 'whisper-cli']);

  if (!ffmpegPath) {
    notes.push('FFmpeg ainda não foi instalado ou não está no PATH.');
  }
  if (!whisperPath) {
    notes.push('Whisper.cpp ou o binário do Whisper não foi detectado. Instale o modelo localmente antes de transcrever.');
  }

  if (ffmpegPath && whisperPath) {
    notes.push('Ambientes locais detectados e prontos para transcrição real em máquina local.');
  }

  return {
    ffmpeg: Boolean(ffmpegPath),
    whisper: Boolean(whisperPath),
    ffmpegVersion: ffmpegPath ? 'ffmpeg detectado no PATH' : undefined,
    whisperVersion: whisperPath ? 'binário do Whisper detectado' : undefined,
    notes,
  };
}
