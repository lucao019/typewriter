export type AppSettings = {
  defaultLanguage: string;
  defaultModel: string;
  inputFolder: string;
  outputFolder: string;
  modelsFolder: string;
  maxConcurrentTasks: number;
  keepTemporaryFiles: boolean;
  openOutputAfterExport: boolean;
  startWithWindows: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
};

export const DEFAULT_SETTINGS: AppSettings = {
  defaultLanguage: 'pt-BR',
  defaultModel: 'small',
  inputFolder: '',
  outputFolder: '',
  modelsFolder: '',
  maxConcurrentTasks: 1,
  keepTemporaryFiles: false,
  openOutputAfterExport: true,
  startWithWindows: false,
  logLevel: 'info',
};

export function normalizeSettings(input: Partial<AppSettings> | undefined): AppSettings {
  const partial = input ?? {};
  const normalized: AppSettings = {
    ...DEFAULT_SETTINGS,
    ...partial,
  };

  normalized.defaultLanguage = String(normalized.defaultLanguage || DEFAULT_SETTINGS.defaultLanguage);
  normalized.defaultModel = String(normalized.defaultModel || DEFAULT_SETTINGS.defaultModel);
  normalized.inputFolder = String(normalized.inputFolder || '');
  normalized.outputFolder = String(normalized.outputFolder || '');
  normalized.modelsFolder = String(normalized.modelsFolder || '');
  normalized.maxConcurrentTasks = DEFAULT_SETTINGS.maxConcurrentTasks;
  normalized.keepTemporaryFiles = Boolean(normalized.keepTemporaryFiles);
  normalized.openOutputAfterExport = Boolean(normalized.openOutputAfterExport);
  normalized.startWithWindows = Boolean(normalized.startWithWindows);
  normalized.logLevel = ['debug', 'info', 'warn', 'error'].includes(normalized.logLevel as string)
    ? (normalized.logLevel as AppSettings['logLevel'])
    : DEFAULT_SETTINGS.logLevel;

  return normalized;
}
