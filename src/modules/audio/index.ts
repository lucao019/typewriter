export const AUDIO_EXTENSIONS = ['.wav', '.mp3', '.m4a', '.aac', '.flac', '.ogg', '.opus', '.webm'];

export function isSupportedAudioFile(fileName: string): boolean {
  return AUDIO_EXTENSIONS.includes(fileName.toLowerCase().substring(fileName.lastIndexOf('.')) || '');
}

export function formatAudioDuration(durationSeconds?: number): string {
  if (!Number.isFinite(durationSeconds) || durationSeconds === undefined || durationSeconds < 0) {
    return 'Duração indisponível';
  }
  const totalSeconds = Math.floor(durationSeconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`;
}
