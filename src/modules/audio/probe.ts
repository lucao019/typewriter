import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function probeAudioDuration(filePath: string, ffprobePath: string): Promise<number | undefined> {
  try {
    const { stdout } = await execFileAsync(ffprobePath, [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath,
    ], { windowsHide: true, timeout: 15000, maxBuffer: 1024 * 1024 });
    const duration = Number(stdout.trim());
    return Number.isFinite(duration) && duration >= 0 ? duration : undefined;
  } catch {
    return undefined;
  }
}
