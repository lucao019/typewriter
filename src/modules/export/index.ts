export type ExportFormat = 'txt' | 'srt' | 'vtt' | 'json' | 'markdown';

export function exportTranscript(content: string, format: ExportFormat, fileName: string): string {
  const extension = format === 'markdown' ? 'md' : format;
  return `${fileName}.${extension}`;
}

export function serializeTranscript(content: string, format: ExportFormat): string {
  switch (format) {
    case 'srt':
      return `1\n00:00:00,000 --> 00:00:05,000\n${content}\n`;
    case 'vtt':
      return `WEBVTT\n\n00:00:00.000 --> 00:00:05.000\n${content}\n`;
    case 'json':
      return JSON.stringify({ text: content, segments: [] }, null, 2);
    case 'markdown':
      return `# Transcrição\n\n${content}\n`;
    default:
      return content;
  }
}
