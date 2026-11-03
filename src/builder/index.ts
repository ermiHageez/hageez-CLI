import * as fs from 'fs';
import * as path from 'path';
import {
  HageezConfig,
  HageezError,
  LLMMessage,
  LLMResponse,
  ProjectContext,
} from '../core';
import { callLLM } from '../core';
import { validateProjectPath, validateProjectPaths } from '../filesystem';

export interface BuilderResult {
  content: string;
  tokensUsed: number;
  files: Array<{ path: string; action: 'create' | 'modify' | 'delete'; content?: string }>;
}

export type BuilderModelCall = (
  config: HageezConfig,
  messages: LLMMessage[]
) => Promise<LLMResponse>;

export interface Builder {
  generate: (task: string, project: ProjectContext, plan: string, fileContext?: string) => Promise<BuilderResult>;
}

const LANGUAGE_EXTENSIONS: Record<string, string> = {
  typescript: 'ts',
  javascript: 'js',
  python: 'py',
  java: 'java',
  go: 'go',
  rust: 'rs',
  'c#': 'cs',
  php: 'php',
  ruby: 'rb',
  swift: 'swift',
  kotlin: 'kt',
  dart: 'dart',
};

function inferExtension(language: string | null): string | null {
  if (!language) return null;
  return LANGUAGE_EXTENSIONS[language.trim().toLowerCase()] ?? null;
}

function slugify(task: string): string {
  const slug = task
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return slug || 'generated';
}

function parseFileContext(fileContext: string): Array<{ path: string; content: string }> {
  const files: Array<{ path: string; content: string }> = [];
  const pattern = /### (.+?)\r?\n```\r?\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(fileContext)) !== null) {
    files.push({ path: match[1].trim(), content: match[2] });
  }

  return files;
}

function extractCodeFromResponse(content: string): string | null {
  const pattern = /```[^\n]*\r?\n([\s\S]*?)```/g;
  const matches = [...content.matchAll(pattern)];
  if (matches.length === 0) return null;

  const code = matches.reduce(
    (best, match) => (match[1].length > best.length ? match[1] : best),
    ''
  );
  return code.trim().length > 0 ? code : null;
}

function retryMessages(messages: LLMMessage[]): LLMMessage[] {
  return [
    ...messages,
    {
      role: 'user',
      content: 'Return only one fenced code block containing the complete file. No prose.',
    },
  ];
}

async function generateCode(
  config: HageezConfig,
  call: BuilderModelCall,
  messages: LLMMessage[],
  filePath: string
): Promise<{ code: string; content: string; tokensUsed: number }> {
  let tokensUsed = 0;
  let content = '';

  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await call(
      config,
      attempt === 0 ? messages : retryMessages(messages)
    );
    tokensUsed += response.tokensUsed;
    content = response.content;

    const code = extractCodeFromResponse(response.content);
    if (code !== null) {
      return { code, content, tokensUsed };
    }
  }

  throw new HageezError(
    'NO_CODE_BLOCK',
    `No fenced code block returned for ${filePath}.`
  );
}

function relativeFilePath(projectRoot: string, filePath: string): string {
  const absolute = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(projectRoot, filePath);
  const relative = path.relative(projectRoot, absolute);

  if (
    relative.length > 0 &&
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  ) {
    return relative;
  }

  return filePath;
}

function pathFromResponse(content: string, projectRoot: string): string {
  const candidates = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of candidates) {
    const unquoted = line.replace(/^`+|`+$/g, '').replace(/^["']|["']$/g, '').trim();
    const match = unquoted.match(/[A-Za-z0-9._/-]+\.[A-Za-z0-9]+/);
    if (!match) continue;

    const candidate = match[0];
    if (path.isAbsolute(candidate)) continue;

    try {
      validateProjectPath(projectRoot, candidate);
      return candidate;
    } catch {
      // Try the next candidate line.
    }
  }

  throw new HageezError('INVALID_PATH', 'The model did not return a valid relative path.');
}

function writeFiles(files: BuilderResult['files'], projectRoot: string): { written: string[]; errors: string[] } {
  const written: string[] = [];
  const errors: string[] = [];

  // Validate the entire batch before mutating anything.
  const targets: string[] = [];
  for (const file of files) {
    try {
      targets.push(validateProjectPaths(projectRoot, [file.path])[0]);
    } catch (err) {
      const code = err instanceof HageezError ? err.code : 'PATH_INVALID';
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${code}: ${message}`);
    }
  }

  if (errors.length > 0) {
    return { written, errors };
  }

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const fullPath = targets[i];
      const dir = path.dirname(fullPath);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (file.action === 'delete') {
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
          written.push(`DELETE ${file.path}`);
        }
      } else if (file.content !== undefined) {
        fs.writeFileSync(fullPath, file.content, 'utf-8');
        written.push(`${file.action === 'create' ? 'CREATE' : 'UPDATE'} ${file.path}`);
      }
    } catch (err) {
      errors.push(`Failed to ${file.action} ${file.path}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { written, errors };
}

export function createBuilder(config: HageezConfig, call: BuilderModelCall = callLLM): Builder {
  return {
    async generate(task: string, project: ProjectContext, plan: string, fileContext?: string): Promise<BuilderResult> {
      const filesToModify = fileContext ? parseFileContext(fileContext) : [];

      if (filesToModify.length > 0) {
        const files: BuilderResult['files'] = [];
        const responses: string[] = [];
        let tokensUsed = 0;

        for (const file of filesToModify) {
          const displayPath = relativeFilePath(project.path, file.path);
          const messages: LLMMessage[] = [
            {
              role: 'system',
              content: `You are an expert code editor. You modify existing files.
Your response MUST contain ONLY the complete updated file code inside a single fenced code block.
No explanations, no markdown headers, no other text. Just the code.`,
            },
            {
              role: 'user',
              content: `Update this file for the task: "${task}"

Plan:
${plan}

Current file path: ${displayPath}

Current file content:
\`\`\`
${file.content}
\`\`\`

Output the COMPLETE updated file. Only the fenced code block, nothing else.`,
            },
          ];

          const result = await generateCode(config, call, messages, displayPath);
          tokensUsed += result.tokensUsed;
          responses.push(result.content);
          files.push({ path: displayPath, action: 'modify', content: result.code });
        }

        return {
          content: responses.join('\n\n'),
          tokensUsed,
          files,
        };
      }

      const knownExtension = inferExtension(project.language);
      let fileName: string;
      let tokensUsed = 0;

      if (knownExtension) {
        fileName = `${slugify(task)}.${knownExtension}`;
      } else {
        const pathResponse = await call(config, [
          {
            role: 'system',
            content: 'You choose one relative file path for a new project file. Return only the path, with no code fences or explanation.',
          },
          {
            role: 'user',
            content: `Choose a relative file path for a new file implementing this task: "${task}"

Project: ${project.name}
Language: ${project.language ?? 'unknown'}

Return only one relative path.`,
          },
        ]);
        tokensUsed += pathResponse.tokensUsed;
        fileName = pathFromResponse(pathResponse.content, project.path);
      }

      const messages: LLMMessage[] = [
        {
          role: 'system',
          content: `You are an expert code generator. You create new files.
Your response MUST contain ONLY the complete file code inside a single fenced code block.
No explanations, no markdown headers, no other text. Just the code.`,
        },
        {
          role: 'user',
          content: `Create the file ${fileName} for this task: "${task}"

Plan:
${plan}

Project: ${project.name}
Language: ${project.language ?? 'unknown'}

Output the COMPLETE file. Only the fenced code block, nothing else.`,
        },
      ];

      const result = await generateCode(config, call, messages, fileName);
      tokensUsed += result.tokensUsed;

      return {
        content: result.content,
        tokensUsed,
        files: [{ path: fileName, action: 'create', content: result.code }],
      };
    },
  };
}

export function applyBuilderResult(result: BuilderResult, projectRoot: string): { written: string[]; errors: string[] } {
  return writeFiles(result.files, projectRoot);
}
