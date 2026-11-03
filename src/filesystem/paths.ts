import * as fs from 'fs';
import * as path from 'path';
import { HageezError } from '../core';

const PROTECTED_SEGMENTS = new Set(['.git', 'node_modules']);

function isInsideOrEqual(root: string, target: string): boolean {
  const rel = path.relative(root, target);
  return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel));
}

function relativeForMessage(root: string, target: string): string {
  return path.relative(root, target) || '.';
}

function assertInsideProject(root: string, target: string): void {
  if (!isInsideOrEqual(root, target)) {
    throw new HageezError(
      'PATH_ESCAPE',
      `Path escapes the project: ${relativeForMessage(root, target)}`
    );
  }
}

function entryExists(root: string, target: string): boolean {
  try {
    fs.lstatSync(target);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw new HageezError(
      'PATH_INVALID',
      `Cannot inspect path: ${relativeForMessage(root, target)}`,
      err
    );
  }
}

function realProjectPath(root: string, target: string): string {
  try {
    return fs.realpathSync(target);
  } catch (err) {
    throw new HageezError(
      'PATH_ESCAPE',
      `Path cannot be resolved safely: ${relativeForMessage(root, target)}`,
      err
    );
  }
}

export function validateProjectPath(projectRoot: string, requestedPath: string): string {
  if (typeof requestedPath !== 'string' || requestedPath.trim().length === 0) {
    throw new HageezError('PATH_INVALID', 'Path must be a non-empty relative path.');
  }

  const root = fs.realpathSync(projectRoot);
  const target = path.resolve(root, requestedPath);
  const relative = path.relative(root, target);

  if (
    relative.length === 0 ||
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new HageezError(
      'PATH_ESCAPE',
      `Path escapes the project: ${relativeForMessage(root, target)}`
    );
  }

  const segments = relative.split(path.sep);
  if (segments.some((segment) => PROTECTED_SEGMENTS.has(segment.toLowerCase()))) {
    throw new HageezError(
      'PATH_FORBIDDEN',
      `Path is protected: ${relativeForMessage(root, target)}`
    );
  }

  let existing = target;
  while (!entryExists(root, existing) && existing !== path.dirname(existing)) {
    existing = path.dirname(existing);
  }

  const realExisting = realProjectPath(root, existing);
  assertInsideProject(root, realExisting);

  if (entryExists(root, target)) {
    const realTarget = realProjectPath(root, target);
    assertInsideProject(root, realTarget);
  }

  return target;
}

export function validateProjectPaths(projectRoot: string, requestedPaths: string[]): string[] {
  return requestedPaths.map((requestedPath) => validateProjectPath(projectRoot, requestedPath));
}
