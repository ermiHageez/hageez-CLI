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

export async function rememberDecision(
key: string,
value: string,
projectPath?: string
): Promise<void> {
const dir = getMemoryDir(projectPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const file = path.join(dir, 'project_memory.json');
let memory: Record<string, MemoryEntry> = {};
if (fs.existsSync(file)) {
try { memory = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, MemoryEntry>; } catch { }
}

memory[key] = {
id: Math.random().toString(36).slice(2),
projectPath: projectPath ?? process.cwd(),
type: 'decision',
key,
value,
createdAt: memory[key]?.createdAt ?? new Date().toISOString(),
updatedAt: new Date().toISOString(),
};
fs.writeFileSync(file, JSON.stringify(memory, null, 2), 'utf-8');
}

export async function recallDecision(key: string, projectPath?: string): Promise<string | null> {
const dir = getMemoryDir(projectPath);
const file = path.join(dir, 'project_memory.json');
if (!fs.existsSync(file)) return null;
try {
const memory = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, MemoryEntry>;
return memory[key]?.value ?? null;
} catch { return null; }
}
