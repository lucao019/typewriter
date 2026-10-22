import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

export type WhisperModel = 'tiny' | 'base' | 'small' | 'medium' | 'large';

export type WhisperConfig = {
  model: WhisperModel;
  language: string;
  autoDetectLanguage: boolean;
  useGpu: boolean;
};

export type TranscriptionResult = {
  fileName: string;
  transcript: string;
  outputPath?: string;
  language: string;
  model: WhisperModel;
};

export type TranscriptionOptions = Partial<WhisperConfig> & {
  outputDir?: string;
  modelsDirectory?: string;
  keepTemporaryFiles?: boolean;
};

export const WHISPER_MODELS: Array<{ value: WhisperModel; label: string; memoryMb: number; speed: string; precision: string }> = [
  { value: 'tiny', label: 'Tiny', memoryMb: 280, speed: 'Muito rápida', precision: 'Baixa' },
  { value: 'base', label: 'Base', memoryMb: 500, speed: 'Rápida', precision: 'Boa' },
  { value: 'small', label: 'Small', memoryMb: 1200, speed: 'Equilibrada', precision: 'Muito boa' },
  { value: 'medium', label: 'Medium', memoryMb: 2500, speed: 'Mais lenta', precision: 'Alta' },
  { value: 'large', label: 'Large', memoryMb: 5000, speed: 'Lenta', precision: 'Máxima' },
];

export function getWhisperRequirements(model: WhisperModel): { memoryMb: number; note: string } {
  const option = WHISPER_MODELS.find((entry) => entry.value === model) ?? WHISPER_MODELS[2];
  return {
    memoryMb: option.memoryMb,
    note: `${option.label} exige aproximadamente ${option.memoryMb} MB de RAM para execução local e representa um custo mais alto de processamento.`,
  };
}

export function createWhisperConfig(overrides: Partial<WhisperConfig> = {}): WhisperConfig {
  return {
    model: 'small',
    language: 'pt-BR',
    autoDetectLanguage: true,
    useGpu: false,
    ...overrides,
  };
}

export function findExecutableOnPath(candidates: string[]): string | null {
  const list = Array.from(new Set(candidates.filter(Boolean))).map((item) => item.trim());
  if (!list.length) return null;

  const extensions = process.platform === 'win32' ? ['', '.exe', '.cmd', '.bat'] : [''];
  const candidateNames = list.flatMap((candidate) => {
    if (path.isAbsolute(candidate) || candidate.includes(path.sep) || candidate.includes('/')) {
      return [candidate];
    }
    return extensions.map((extension) => extension && !path.extname(candidate) ? `${candidate}${extension}` : candidate);
  });

  for (const candidate of candidateNames) {
    if (path.isAbsolute(candidate) && fs.existsSync(candidate)) return candidate;
  }

  const searchDirectories = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean);
  const isWhisperExecutable = list.some((candidate) => /^(whisper|whisper-cli|main)(\.exe)?$/i.test(candidate));
  if (isWhisperExecutable) {
    const projectRoots = [
      process.cwd(),
      path.resolve(__dirname, '../..'),
      path.resolve(__dirname, '../../..'),
    ];
    for (const root of projectRoots) {
      for (const buildDirectory of ['Release', 'Debug', '']) {
        searchDirectories.push(path.join(root, 'tools', 'whisper.cpp', 'build', 'bin', buildDirectory));
      }
    }
  }

  for (const directory of new Set(searchDirectories)) {
    for (const candidate of candidateNames) {
      if (path.isAbsolute(candidate)) continue;
      const resolved = path.resolve(directory, candidate);
      if (fs.existsSync(resolved)) return resolved;
    }
  }

  return null;
}

function resolveModelFile(whisperExecutable: string, model: WhisperModel, customModelsDirectory?: string): string | null {
  const executableDir = path.dirname(whisperExecutable);
  const modelDirectories = [
    ...(customModelsDirectory ? [customModelsDirectory] : []),
    executableDir,
    path.join(executableDir, 'models'),
    path.join(executableDir, '..', 'models'),
    path.join(executableDir, '..', '..', 'models'),
    path.join(executableDir, '..', '..', '..', 'models'),
  ];
  const expectedFiles = [
    `ggml-${model}.bin`,
    `ggml-${model}.ggml`,
    `${model}.bin`,
    `${model}.ggml`,
  ];

  for (const directory of modelDirectories) {
    for (const fileName of expectedFiles) {
      const candidate = path.resolve(directory, fileName);
      if (fs.existsSync(candidate)) return candidate;
    }
  }

  return null;
}

export function getWhisperModelStatus(model: string, customModelsDirectory?: string): { installed: boolean; modelPath?: string; selectedExecutable?: string } {
  const modelOption = WHISPER_MODELS.find((entry) => entry.value === model);
  if (!modelOption) return { installed: false };
  const executable = findExecutableOnPath(['whisper-cli', 'whisper-cli.exe', 'main', 'main.exe']);
  const modelPath = executable ? resolveModelFile(executable, modelOption.value, customModelsDirectory) : null;
  return {
    installed: Boolean(modelPath),
    modelPath: modelPath ?? undefined,
    selectedExecutable: executable ?? undefined,
  };
}

function runCommand(
  command: string,
  args: string[],
  options: { cwd?: string; signal?: AbortSignal; onOutput?: (text: string) => void } = {},
): Promise<{ stdout: string; stderr: string }> {
  if (options.signal?.aborted) return Promise.reject(new Error('Transcrição cancelada.'));

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      shell: false,
      windowsHide: true,
      signal: options.signal,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let pendingOutput = '';

    const collect = (chunk: Buffer, stream: 'stdout' | 'stderr') => {
      const text = chunk.toString();
      if (stream === 'stdout') stdout += text;
      else stderr += text;
      pendingOutput += text;
      const lines = pendingOutput.split(/\r?\n/);
      pendingOutput = lines.pop() ?? '';
      lines.forEach((line) => options.onOutput?.(line));
    };

    child.stdout.on('data', (chunk: Buffer) => collect(chunk, 'stdout'));
    child.stderr.on('data', (chunk: Buffer) => collect(chunk, 'stderr'));
    child.once('error', (error) => {
      reject(options.signal?.aborted ? new Error('Transcrição cancelada.') : error);
    });
    child.once('close', (code) => {
      if (pendingOutput) options.onOutput?.(pendingOutput);
      if (options.signal?.aborted) {
        reject(new Error('Transcrição cancelada.'));
      } else if (code !== 0) {
        reject(new Error(stderr.trim() || stdout.trim() || `${path.basename(command)} encerrou com código ${code ?? 'desconhecido'}.`));
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

export async function transcribeAudio(
  filePath: string,
  options: TranscriptionOptions & { signal?: AbortSignal; onProgress?: (line: string) => void } = {},
): Promise<TranscriptionResult> {
  const resolvedConfig = createWhisperConfig(options);
  const normalizedPath = path.resolve(filePath);

  if (!fs.existsSync(normalizedPath)) {
    throw new Error(`Arquivo não encontrado: ${normalizedPath}`);
  }

  const ffmpegPath = findExecutableOnPath(['ffmpeg', 'ffmpeg.exe']);
  const whisperExecutable = findExecutableOnPath(['whisper-cli', 'whisper-cli.exe', 'whisper', 'whisper.exe', 'main', 'main.exe']);

  if (!ffmpegPath) {
    throw new Error('FFmpeg não está instalado ou não foi encontrado no PATH. Instale o FFmpeg para converter o áudio antes da transcrição.');
  }

  if (!whisperExecutable) {
    throw new Error('Whisper não está instalado. Baixe o binário do Whisper.cpp ou do Whisper e configure no PATH para concluir a transcrição.');
  }

  const sourceDir = path.dirname(normalizedPath);
  const outputDir = options.outputDir ? path.resolve(options.outputDir) : sourceDir;
  fs.mkdirSync(outputDir, { recursive: true });

  const baseName = path.basename(normalizedPath, path.extname(normalizedPath));
  const wavPath = path.join(os.tmpdir(), `lucao-${Date.now()}-${baseName}.wav`);

  try {
    await runCommand(ffmpegPath, ['-y', '-i', normalizedPath, '-vn', '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1', wavPath], {
      signal: options.signal,
      onOutput: options.onProgress,
    });

    const executableName = path.basename(whisperExecutable).toLowerCase();
    const whisperArgs: string[] = [];
    let whisperWorkingDirectory: string | undefined;
    const modelFile = resolveModelFile(whisperExecutable, resolvedConfig.model, options.modelsDirectory);

    if (executableName.includes('main') || executableName.includes('whisper-cli') || executableName === 'whisper.exe') {
      if (!modelFile) {
        throw new Error(`Modelo do Whisper não encontrado para o perfil "${resolvedConfig.model}". Baixe o arquivo ggml-${resolvedConfig.model}.bin e coloque na pasta models do whisper.cpp.`);
      }

      const outputBase = path.join(outputDir, `${baseName}-transcricao`);
      whisperWorkingDirectory = path.dirname(modelFile);
      const language = resolvedConfig.autoDetectLanguage
        ? 'auto'
        : resolvedConfig.language.toLowerCase() === 'pt-br'
          ? 'pt'
          : resolvedConfig.language;
      whisperArgs.push('-m', path.basename(modelFile), '-f', wavPath, '-l', language, '-otxt', '-of', outputBase, '-pp');
    } else {
      whisperArgs.push(wavPath, '--model', resolvedConfig.model, '--language', resolvedConfig.language, '--output_dir', outputDir, '--output_format', 'txt');
    }

    const transcriptFile = path.join(outputDir, `${baseName}-transcricao.txt`);
    if (fs.existsSync(transcriptFile)) fs.unlinkSync(transcriptFile);
    const whisperRun = await runCommand(whisperExecutable, whisperArgs, {
      cwd: whisperWorkingDirectory,
      signal: options.signal,
      onOutput: options.onProgress,
    });
    const transcript = fs.existsSync(transcriptFile)
      ? fs.readFileSync(transcriptFile, 'utf8').trim()
      : whisperRun.stdout.trim();

    if (!transcript) {
      throw new Error('O processo terminou sem gerar texto transcrito. Verifique o modelo do Whisper e o arquivo de áudio.');
    }

    return {
      fileName: baseName,
      transcript,
      outputPath: fs.existsSync(transcriptFile) ? transcriptFile : undefined,
      language: resolvedConfig.language,
      model: resolvedConfig.model,
    };
  } finally {
    if (!options.keepTemporaryFiles && fs.existsSync(wavPath)) fs.unlinkSync(wavPath);
  }
}
