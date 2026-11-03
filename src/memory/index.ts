import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SessionLog, MemoryEntry } from '../core';

function getMemoryDir(projectPath?: string): string {
const base = projectPath ?? process.cwd();
return path.join(base, 'ai-learning', 'memory');
}

function getSessionDir(projectPath?: string): string {
const base = projectPath ?? process.cwd();
return path.join(base, 'ai-learning', 'session_logs');
}

export async function logSession(session: Omit<SessionLog, 'id' | 'timestamp'>): Promise<void> {
const dir = getSessionDir(session.projectPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const today = new Date().toISOString().slice(0, 10);
const file = path.join(dir, `session_${today}.json`);

let sessions: SessionLog[] = [];
if (fs.existsSync(file)) {
try { sessions = JSON.parse(fs.readFileSync(file, 'utf-8')) as SessionLog[]; } catch { }
}

const entry: SessionLog = {
...session,
id: Math.random().toString(36).slice(2),
timestamp: new Date().toISOString(),
};
sessions.push(entry);
fs.writeFileSync(file, JSON.stringify(sessions, null, 2), 'utf-8');
}

export async function getRecentSessions(
projectPath: string,
limit = 5
): Promise<Array<{ task: string; timeAgo: string }>> {
const dir = getSessionDir(projectPath);
if (!fs.existsSync(dir)) return [];

const files = fs.readdirSync(dir)
.filter(f => f.endsWith('.json'))
.sort()
.reverse()
.slice(0, 3);

const results: Array<{ task: string; timestamp: string }> = [];
for (const f of files) {
try {
const sessions = JSON.parse(
fs.readFileSync(path.join(dir, f), 'utf-8')
) as SessionLog[];
results.push(...sessions.map(s => ({ task: s.task, timestamp: s.timestamp })));
} catch { }
}

return results
.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
.slice(0, limit)
.map(s => ({
task: s.task,
timeAgo: formatTimeAgo(new Date(s.timestamp)),
}));
}

function formatTimeAgo(date: Date): string {
const diffMs = Date.now() - date.getTime();
const diffMins = Math.floor(diffMs / 60000);
if (diffMins < 60) return `${diffMins}m ago`;
const diffHours = Math.floor(diffMins / 60);
if (diffHours < 24) return `${diffHours}h ago`;
return `${Math.floor(diffHours / 24)}d ago`;
}


export function readSessionLogs(projectPath?: string): SessionLog[] {
  const dir = getSessionDir(projectPath);
  if (!fs.existsSync(dir)) return [];
  const sessions: SessionLog[] = [];
  for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.json')).sort()) {
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8')) as SessionLog[];
      sessions.push(...parsed);
    } catch {
      // Skip unreadable session logs.
    }
  }
  return sessions;
}

export function getMemoryFile(projectPath?: string): string {
  return path.join(getMemoryDir(projectPath), 'project_memory.json');
}

function readMemory(projectPath?: string): Record<string, MemoryEntry> {
  const file = getMemoryFile(projectPath);
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, MemoryEntry>;
  } catch {
    return {};
  }
}

export async function rememberDecision(
  key: string,
  value: string,
  projectPath?: string
): Promise<void> {
  const dir = getMemoryDir(projectPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const memory = readMemory(projectPath);
  const now = new Date().toISOString();
  memory[key] = {
    id: memory[key]?.id ?? Math.random().toString(36).slice(2),
    projectPath: projectPath ?? process.cwd(),
    type: 'decision',
    key,
    value,
    createdAt: memory[key]?.createdAt ?? now,
    updatedAt: now,
  };
  fs.writeFileSync(getMemoryFile(projectPath), JSON.stringify(memory, null, 2), 'utf-8');
}

export async function recallDecision(key: string, projectPath?: string): Promise<string | null> {
  return readMemory(projectPath)[key]?.value ?? null;
}

export function listDecisions(projectPath?: string): MemoryEntry[] {
  const root = path.resolve(projectPath ?? process.cwd());
  return Object.values(readMemory(projectPath))
    .filter((entry) => entry.type === 'decision')
    .filter((entry) => path.resolve(entry.projectPath) === root)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function recallDecisions(projectPath?: string, keyword?: string): MemoryEntry[] {
  const decisions = listDecisions(projectPath);
  const needle = keyword?.trim().toLowerCase();
  if (!needle) return decisions;
  return decisions.filter(
    (entry) =>
      entry.key.toLowerCase().includes(needle) ||
      entry.value.toLowerCase().includes(needle)
  );
}

export async function removeDecision(key: string, projectPath?: string): Promise<boolean> {
  const memory = readMemory(projectPath);
  if (!memory[key]) return false;
  delete memory[key];
  fs.writeFileSync(getMemoryFile(projectPath), JSON.stringify(memory, null, 2), 'utf-8');
  return true;
}

export function buildMemoryContext(projectPath?: string, keyword?: string): string {
  const decisions = recallDecisions(projectPath, keyword);
  if (decisions.length === 0) return '';
  return decisions
    .map((entry) => `- ${entry.key}: ${entry.value}`)
    .join('\n');
}
