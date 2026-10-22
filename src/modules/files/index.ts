export type AudioFileStatus = 'waiting' | 'queued' | 'processing' | 'done' | 'error' | 'cancelled';

export type AudioFile = {
  path: string;
  name: string;
  size: number;
  type: string;
  status: AudioFileStatus;
  transcript?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
  durationSeconds?: number;
  model: string;
  language: string;
  progressPercent?: number;
  removedFromQueue?: boolean;
  resultPath?: string;
};

export type SelectedAudioFile = Pick<AudioFile, 'path' | 'name' | 'size' | 'type'>;
