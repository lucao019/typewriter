export type TranscriptionRecord = {
  id: string;
  fileName: string;
  originalPath: string;
  duration: string;
  language: string;
  model: string;
  createdAt: string;
  status: 'waiting' | 'preparing' | 'transcribing' | 'completed' | 'cancelled' | 'failed';
  resultPath?: string;
  transcriptText?: string;
  errorMessage?: string;
};

export function createTranscriptionRecord(input: Partial<TranscriptionRecord>): TranscriptionRecord {
  const now = new Date().toISOString();
  return {
    id: input.id ?? `tx-${Date.now()}`,
    fileName: input.fileName ?? 'unknown-audio',
    originalPath: input.originalPath ?? '',
    duration: input.duration ?? '00:00',
    language: input.language ?? 'pt-BR',
    model: input.model ?? 'small',
    createdAt: input.createdAt ?? now,
    status: input.status ?? 'waiting',
    resultPath: input.resultPath,
    transcriptText: input.transcriptText,
    errorMessage: input.errorMessage,
  };
}
