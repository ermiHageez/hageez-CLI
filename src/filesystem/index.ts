import * as fs from 'fs';
import * as path from 'path';
import { ProjectContext } from '../core';

const LANGUAGE_MAP: Record<string, string> = {
'.ts': 'TypeScript', '.tsx': 'TypeScript',
'.js': 'JavaScript', '.jsx': 'JavaScript',
'.py': 'Python', '.java': 'Java', '.go': 'Go',
'.rs': 'Rust', '.cs': 'C#', '.php': 'PHP',
'.rb': 'Ruby', '.swift': 'Swift', '.kt': 'Kotlin',
'.dart': 'Dart',
};

const FRAMEWORK_MAP: Record<string, string> = {
'next': 'Next.js', 'react': 'React', 'vue': 'Vue',
'angular': 'Angular', 'express': 'Express', 'fastify': 'Fastify',
'spring-boot': 'Spring Boot', 'django': 'Django', 'flask': 'Flask',
'nestjs': 'NestJS', '@nestjs/core': 'NestJS',
'@angular/core': 'Angular', 'nuxt': 'Nuxt.js',
};

const DB_MAP: Record<string, string> = {
'prisma': 'Prisma/PostgreSQL', 'mongoose': 'MongoDB', 'typeorm': 'TypeORM',
'sequelize': 'Sequelize', 'knex': 'Knex', 'pg': 'PostgreSQL',
'mysql2': 'MySQL', 'sqlite3': 'SQLite', 'better-sqlite3': 'SQLite',
};

const BUILD_MAP: Record<string, string> = {
'vite': 'Vite', 'webpack': 'Webpack', 'esbuild': 'esbuild',
'rollup': 'Rollup', 'turbo': 'Turborepo', 'nx': 'Nx',
'gradle': 'Gradle', 'maven': 'Maven',
};

function countLines(filePath: string): number {
try {
const content = fs.readFileSync(filePath, 'utf-8');
return content.split('\n').length;
} catch { return 0; }
}

function walkDir(dir: string, exts: string[], maxDepth = 5, depth = 0): string[] {
if (depth > maxDepth) return [];
let files: string[] = [];
try {
const entries = fs.readdirSync(dir, { withFileTypes: true });
for (const e of entries) {
if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'dist') continue;
const full = path.join(dir, e.name);
if (e.isDirectory()) {
files = files.concat(walkDir(full, exts, maxDepth, depth + 1));
} else if (exts.some(ext => e.name.endsWith(ext))) {
files.push(full);
}
}
} catch { }
return files;
}

export async function scanProject(projectPath: string): Promise<ProjectContext> {
const name = path.basename(projectPath);
let language: string | null = null;
let framework: string | null = null;
let database: string | null = null;
let buildTool: string | null = null;
let architecture: string | null = null;
let filesScanned = 0;
let linesOfCode = 0;
let dependencies = 0;
let branch: string | null = null;

const allExts = Object.keys(LANGUAGE_MAP);
const files = walkDir(projectPath, allExts);
filesScanned = files.length;
linesOfCode = files.reduce((acc, f) => acc + countLines(f), 0);

const extCounts: Record<string, number> = {};
for (const f of files) {
const ext = path.extname(f);
extCounts[ext] = (extCounts[ext] ?? 0) + 1;
}
const dominantExt = Object.entries(extCounts).sort((a, b) => b[1] - a[1])[0];
if (dominantExt) language = LANGUAGE_MAP[dominantExt[0]] ?? null;

const pkgPath = path.join(projectPath, 'package.json');
if (fs.existsSync(pkgPath)) {
try {
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as {
dependencies?: Record<string, string>;
devDependencies?: Record<string, string>;
};
const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
dependencies = Object.keys(allDeps).length;

for (const [dep, fw] of Object.entries(FRAMEWORK_MAP)) {
if (allDeps[dep]) { framework = fw; break; }
}
for (const [dep, db] of Object.entries(DB_MAP)) {
if (allDeps[dep]) { database = db; break; }
}
for (const [dep, bt] of Object.entries(BUILD_MAP)) {
if (allDeps[dep]) { buildTool = bt; break; }
}
} catch { }
}

if (fs.existsSync(path.join(projectPath, 'pom.xml'))) {
language = 'Java'; buildTool = 'Maven';
const pom = fs.readFileSync(path.join(projectPath, 'pom.xml'), 'utf-8');
if (pom.includes('spring-boot')) framework = 'Spring Boot';
}
if (fs.existsSync(path.join(projectPath, 'build.gradle'))) {
buildTool = 'Gradle';
}

try {
const headFile = path.join(projectPath, '.git', 'HEAD');
if (fs.existsSync(headFile)) {
const head = fs.readFileSync(headFile, 'utf-8').trim();
if (head.startsWith('ref: refs/heads/')) {
branch = head.replace('ref: refs/heads/', '');
}
}
} catch { }

if (filesScanned > 200) architecture = 'Monorepo/Microservices';
else if (filesScanned > 50) architecture = 'Monolith';
else architecture = 'Small project';

return {
path: projectPath,
name,
language,
framework,
database,
buildTool,
architecture,
branch,
filesScanned,
linesOfCode,
dependencies,
};
}
