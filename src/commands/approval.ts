import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { HageezError } from '../core';
import { validateProjectPath } from '../filesystem';
import { applyBuilderResult, type BuilderResult } from '../builder';
import { createFileDiff, renderDiff, type DiffFile, type DiffOperation } from '../ui/diff';
import { emitUIEvent } from '../ui/events';

export interface PendingChange {
  path: string;
  absolutePath: string;
  action: 'create' | 'modify' | 'delete';
  operation: DiffOperation;
  content?: string;
  exists: boolean;
  previousContent: string | null;
}

export interface ApprovalOptions {
  yes?: boolean;
  dryRun?: boolean;
  isTTY?: boolean;
  ask?: (question: string) => Promise<string>;
  timestamp?: Date;
}

export interface ReviewOptions extends ApprovalOptions {
  render?: (text: string) => void;
}

export interface ReviewResult {
  approved: PendingChange[];
  rejected: PendingChange[];
  diffs: DiffFile[];
  written: string[];
  errors: string[];
  dryRun: boolean;
}

function displayPath(projectRoot: string, absolutePath: string): string {
  return path.relative(projectRoot, absolutePath).split(path.sep).join('/');
}

function readExisting(
  absolutePath: string,
  displayPath: string
): { exists: boolean; content: string | null } {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(absolutePath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { exists: false, content: null };
    }
    throw new HageezError('BACKUP_FAILED', `Cannot inspect ${displayPath}.`, err);
  }

  if (!stat.isFile()) {
    throw new HageezError(
      'BACKUP_FAILED',
      `Cannot back up ${displayPath}: target is not a regular file.`
    );
  }

  try {
    return { exists: true, content: fs.readFileSync(absolutePath, 'utf-8') };
  } catch (err) {
    throw new HageezError('BACKUP_FAILED', `Cannot read ${displayPath} for backup.`, err);
  }
}

export function prepareChanges(
  files: BuilderResult['files'],
  projectRoot: string
): PendingChange[] {
  return files.map((file) => {
    const absolutePath = validateProjectPath(projectRoot, file.path);
    const relativePath = displayPath(projectRoot, absolutePath);
    const existing = readExisting(absolutePath, relativePath);

    let action: PendingChange['action'];
    if (file.action === 'delete') {
      action = 'delete';
    } else {
      action = existing.exists ? 'modify' : 'create';
    }

    const operation: DiffOperation =
      action === 'delete' ? 'delete' : action === 'create' ? 'create' : 'update';

    return {
      path: relativePath,
      absolutePath,
      action,
      operation,
      content: file.content,
      exists: existing.exists,
      previousContent: existing.content,
    };
  });
}

export function createDiffs(changes: PendingChange[]): DiffFile[] {
  return changes.map((change) =>
    createFileDiff(
      change.path,
      change.operation,
      change.previousContent ?? '',
      change.action === 'delete' ? '' : change.content ?? ''
    )
  );
}

function defaultAsk(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function decide(
  changes: PendingChange[],
  options: ApprovalOptions
): Promise<{ approved: PendingChange[]; rejected: PendingChange[] }> {
  if (options.dryRun) {
    return { approved: [], rejected: [] };
  }

  if (options.yes) {
    return { approved: [...changes], rejected: [] };
  }

  const interactive = options.isTTY ?? process.stdin.isTTY === true;
  if (!interactive) {
    throw new HageezError(
      'APPROVAL_REQUIRES_TTY',
      'Refusing to write without --yes in a non-interactive terminal.'
    );
  }

  const ask = options.ask ?? defaultAsk;
  const approved: PendingChange[] = [];
  const rejected: PendingChange[] = [];
  let approveAll = false;

  for (const change of changes) {
    if (approveAll) {
      approved.push(change);
      continue;
    }

    try {
      const diffText = renderDiff([createFileDiff(change.path, change.operation, change.previousContent ?? '', change.action === 'delete' ? '' : change.content ?? '')]);
      emitUIEvent('approval:request', {
        file: change.path,
        diff: diffText,
        index: changes.indexOf(change) + 1,
        total: changes.length,
      });
    } catch {}

    let answer = '';
    while (answer !== 'y' && answer !== 'n' && answer !== 'a') {
      answer = (await ask(`Approve ${change.path}? [y/N/a] `)).trim().toLowerCase();
      if (answer === '') answer = 'n';
    }

    if (answer === 'a') {
      approveAll = true;
      approved.push(change);
    } else if (answer === 'y') {
      approved.push(change);
    } else {
      rejected.push(change);
    }
  }

  return { approved, rejected };
}

function formatTimestamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-');
}

export function backupChanges(
  changes: PendingChange[],
  projectRoot: string,
  timestamp = new Date()
): string[] {
  const backups: string[] = [];
  const backupRoot = path.join(
    projectRoot,
    'ai-learning',
    'backups',
    formatTimestamp(timestamp)
  );

  for (const change of changes) {
    if (!change.exists || change.action === 'create') continue;

    const target = path.join(backupRoot, change.path);
    try {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(change.absolutePath, target);
      backups.push(target);
    } catch (err) {
      throw new HageezError(
        'BACKUP_FAILED',
        `Failed to back up ${change.path}.`,
        err
      );
    }
  }

  return backups;
}

export function applyApprovedChanges(
  changes: PendingChange[],
  projectRoot: string
): { written: string[]; errors: string[] } {
  if (changes.length === 0) return { written: [], errors: [] };

  return applyBuilderResult(
    {
      content: '',
      tokensUsed: 0,
      files: changes.map((change) => ({
        path: change.path,
        action: change.action,
        content: change.content,
      })),
    },
    projectRoot
  );
}

export async function reviewAndApply(
  files: BuilderResult['files'],
  projectRoot: string,
  options: ReviewOptions = {}
): Promise<ReviewResult> {
  const changes = prepareChanges(files, projectRoot);
  const diffs = createDiffs(changes);
  const render = options.render ?? ((text: string) => console.log(text));

  if (diffs.length > 0) {
    const renderedDiff = renderDiff(diffs);
    render(renderedDiff);
    emitUIEvent('feed:block', {
      kind: 'diff',
      content: renderedDiff,
    });
  }

  const decision = await decide(changes, options);

  if (options.dryRun) {
    return {
      approved: [],
      rejected: [],
      diffs,
      written: [],
      errors: [],
      dryRun: true,
    };
  }

  const errors: string[] = [];
  let written: string[] = [];

  if (decision.approved.length > 0) {
    try {
      backupChanges(decision.approved, projectRoot, options.timestamp);
      const applied = applyApprovedChanges(decision.approved, projectRoot);
      written = applied.written;
      errors.push(...applied.errors);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  return {
    approved: decision.approved,
    rejected: decision.rejected,
    diffs,
    written,
    errors,
    dryRun: false,
  };
}
