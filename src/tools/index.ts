import { execSync, exec } from 'child_process';
import * as util from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = util.promisify(exec);

export interface RunResult {
stdout: string;
stderr: string;
exitCode: number;
}

export async function runCommand(cmd: string, cwd?: string): Promise<RunResult> {
try {
const { stdout, stderr } = await execAsync(cmd, { cwd: cwd ?? process.cwd() });
return { stdout, stderr, exitCode: 0 };
} catch (err) {
const e = err as { stdout?: string; stderr?: string; code?: number };
return {
stdout: e.stdout ?? '',
stderr: e.stderr ?? '',
exitCode: e.code ?? 1,
};
}
}

export async function runViaOpencode(task: string): Promise<void> {
try {
execSync(`opencode assist "${task}"`, { stdio: 'inherit', cwd: process.cwd() });
} catch {
console.log('opencode not found. Install via: curl -fsSL https://opencode.ai/install | bash');
}
}

export function isOpencodeInstalled(): boolean {
try {
execSync('which opencode', { stdio: 'pipe' });
return true;
} catch { return false; }
}

export async function validateProject(projectPath: string): Promise<{ ok: boolean; errors: string[] }> {
const errors: string[] = [];
const pkgPath = path.join(projectPath, 'package.json');
if (fs.existsSync(pkgPath)) {
const result = await runCommand('npm run build --if-present', projectPath);
if (result.exitCode !== 0) {
errors.push(result.stderr.slice(0, 200));
}
}
return { ok: errors.length === 0, errors };
}
