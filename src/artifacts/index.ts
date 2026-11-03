import * as fs from 'fs';
import * as path from 'path';
import { HageezError } from '../core';

export interface ArtifactRecord {
  agent: string;
  file: string;
  status: 'success' | 'failed' | 'skipped';
  startedAt: string;
  finishedAt: string;
  model: string;
  connection: string;
  inputs: string[];
}

export interface RunManifest {
  runId: string;
  task: string;
  projectPath: string;
  startedAt: string;
  finishedAt?: string;
  status: 'running' | 'success' | 'partial' | 'failed';
  artifacts: ArtifactRecord[];
}

function validateSegment(value: string, label: string): string {
  if (
    value.length === 0 ||
    value === '.' ||
    value === '..' ||
    value.includes('/') ||
    value.includes('\\') ||
    path.isAbsolute(value) ||
    !/^[A-Za-z0-9._-]+$/.test(value)
  ) {
    throw new HageezError('ARTIFACT_PATH_INVALID', `Invalid ${label}: ${value}`);
  }
  return value;
}

export function runsDir(projectPath = process.cwd()): string {
  return path.join(projectPath, 'ai-learning', 'runs');
}

export function runDir(runId: string, projectPath = process.cwd()): string {
  return path.join(runsDir(projectPath), validateSegment(runId, 'run id'));
}

function manifestFile(runId: string, projectPath = process.cwd()): string {
  return path.join(runDir(runId, projectPath), 'run.json');
}

function atomicWrite(file: string, content: string): void {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const temp = `${file}.tmp-${process.pid}-${Math.random().toString(36).slice(2)}`;
  try {
    fs.writeFileSync(temp, content, { encoding: 'utf-8', mode: 0o600 });
    fs.renameSync(temp, file);
  } catch (err) {
    try { fs.rmSync(temp, { force: true }); } catch { /* best effort */ }
    throw new HageezError('ARTIFACT_WRITE_FAILED', `Failed to write artifact ${path.basename(file)}.`, err);
  }
}

export function createRun(
  task: string,
  projectPath = process.cwd(),
  runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${Math.random().toString(36).slice(2, 8)}`
): RunManifest {
  validateSegment(runId, 'run id');
  const manifest: RunManifest = {
    runId,
    task,
    projectPath,
    startedAt: new Date().toISOString(),
    status: 'running',
    artifacts: [],
  };
  atomicWrite(manifestFile(runId, projectPath), JSON.stringify(manifest, null, 2));
  return manifest;
}

export function readManifest(runId: string, projectPath = process.cwd()): RunManifest {
  const file = manifestFile(runId, projectPath);
  if (!fs.existsSync(file)) {
    throw new HageezError('RUN_NOT_FOUND', `Unknown run: ${runId}`);
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as RunManifest;
  } catch (err) {
    throw new HageezError('ARTIFACT_READ_FAILED', `Failed to read run manifest ${runId}.`, err);
  }
}

export function writeArtifact(
  runId: string,
  agent: string,
  content: string,
  meta: Partial<Omit<ArtifactRecord, 'agent' | 'file'>> = {},
  projectPath = process.cwd()
): ArtifactRecord {
  const safeAgent = validateSegment(agent, 'agent name');
  const dir = runDir(runId, projectPath);
  const file = `${safeAgent}.md`;
  atomicWrite(path.join(dir, file), content);

  const manifest = readManifest(runId, projectPath);
  const record: ArtifactRecord = {
    agent: safeAgent,
    file,
    status: meta.status ?? 'success',
    startedAt: meta.startedAt ?? new Date().toISOString(),
    finishedAt: meta.finishedAt ?? new Date().toISOString(),
    model: meta.model ?? '',
    connection: meta.connection ?? '',
    inputs: meta.inputs ?? [],
  };
  manifest.artifacts = manifest.artifacts.filter((item) => item.agent !== safeAgent);
  manifest.artifacts.push(record);
  atomicWrite(manifestFile(runId, projectPath), JSON.stringify(manifest, null, 2));
  return record;
}

export function readArtifact(runId: string, agent: string, projectPath = process.cwd()): string {
  const file = path.join(runDir(runId, projectPath), `${validateSegment(agent, 'agent name')}.md`);
  if (!fs.existsSync(file)) {
    throw new HageezError('ARTIFACT_NOT_FOUND', `No artifact for ${agent} in run ${runId}.`);
  }
  try {
    return fs.readFileSync(file, 'utf-8');
  } catch (err) {
    throw new HageezError('ARTIFACT_READ_FAILED', `Failed to read ${agent} artifact.`, err);
  }
}

export function listArtifacts(runId: string, projectPath = process.cwd()): ArtifactRecord[] {
  return readManifest(runId, projectPath).artifacts;
}

export function finishRun(
  runId: string,
  status: RunManifest['status'],
  projectPath = process.cwd()
): RunManifest {
  const manifest = readManifest(runId, projectPath);
  manifest.status = status;
  manifest.finishedAt = new Date().toISOString();
  atomicWrite(manifestFile(runId, projectPath), JSON.stringify(manifest, null, 2));
  return manifest;
}
