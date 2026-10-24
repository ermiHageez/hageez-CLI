import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface TelemetryEvent {
event: string;
properties: Record<string, string | number | boolean>;
timestamp: string;
sessionId: string;
}

const TELEMETRY_FILE = path.join(os.homedir(), '.hageezai', 'telemetry.jsonl');

let sessionId = Math.random().toString(36).slice(2);

export function track(
event: string,
properties: Record<string, string | number | boolean> = {}
): void {
const entry: TelemetryEvent = {
event,
properties,
timestamp: new Date().toISOString(),
sessionId,
};
try {
fs.appendFileSync(TELEMETRY_FILE, JSON.stringify(entry) + '\n', 'utf-8');
} catch {
}
}

export function setSessionId(id: string): void {
sessionId = id;
}

export function getSessionId(): string {
return sessionId;
}
