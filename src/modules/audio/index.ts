export const AUDIO_EXTENSIONS = ['.wav', '.mp3', '.m4a', '.aac', '.flac', '.ogg', '.opus', '.webm'];

export function isSupportedAudioFile(fileName: string): boolean {
  return AUDIO_EXTENSIONS.includes(fileName.toLowerCase().substring(fileName.lastIndexOf('.')) || '');
}

export function getAudioDurationEstimate(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.includes('long')) return '06:42';
  if (lower.includes('podcast')) return '18:15';
  return '03:20';
}
