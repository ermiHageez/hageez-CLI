import { execFile, execFileSync, spawn } from 'child_process';
import * as util from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { HageezError } from '../core';

const execFileAsync = util.promisify(execFile);

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface OpencodeOptions {
  cwd?: string;
  executable?: string;
  stdio?: 'inherit' | 'ignore';
}

export async function runCommand(args: string[], cwd?: string): Promise<RunResult> {
  try {
    const { stdout, stderr } = await execFileAsync(args[0], args.slice(1), {
      cwd: cwd ?? process.cwd(),
    });
    return { stdout, stderr, exitCode: 0 };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? '',
      exitCode: typeof e.code === 'number' ? e.code : 1,
    };
  }
}

export function buildOpencodeArgs(task: string): string[] {
  return ['run', '--', task];
}

export function runViaOpencode(task: string, options: OpencodeOptions = {}): Promise<void> {
  const executable = options.executable ?? 'opencode';
  const cwd = options.cwd ?? process.cwd();

  return new Promise((resolve, reject) => {
    let settled = false;
    const child = spawn(executable, buildOpencodeArgs(task), {
      cwd,
      shell: false,
      stdio: options.stdio ?? 'inherit',
    });

    child.on('error', (err: NodeJS.ErrnoException) => {
      if (settled) return;
      settled = true;
      if (err.code === 'ENOENT') {
        reject(new HageezError('OPENCODE_NOT_FOUND', 'opencode executable was not found.', err));
      } else {
        reject(new HageezError('OPENCODE_FAILED', 'Failed to start opencode.', err));
      }
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      if (code === 0) {
        resolve();
      } else {
        reject(new HageezError('OPENCODE_FAILED', `opencode exited with code ${code ?? 'unknown'}.`));
      }
    });
  });
}

export function isOpencodeInstalled(): boolean {
  try {
    execFileSync('opencode', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export async function validateProject(projectPath: string): Promise<{ ok: boolean; errors: string[] }> {
  const errors: string[] = [];
  const pkgPath = path.join(projectPath, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const result = await runCommand([npm, 'run', 'build', '--if-present'], projectPath);
    if (result.exitCode !== 0) {
      errors.push(result.stderr.slice(0, 200));
    }
  }
  return { ok: errors.length === 0, errors };
}
