import chalk from 'chalk';

export async function streamText(
  text: string,
  opts: { delay?: number; prefix?: string } = {}
): Promise<void> {
  const delayMs = opts.delay ?? 15;
  const prefix = opts.prefix ?? '';
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i > 0) process.stdout.write('\n');
    process.stdout.write(prefix);
    for (const char of line) {
      process.stdout.write(char);
      if (delayMs > 0) {
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
  }
}

export async function streamLLMResponse(
  tokens: AsyncIterable<string>,
  opts: { prefix?: string; onToken?: (token: string) => void } = {}
): Promise<string> {
  const prefix = opts.prefix ?? '';
  let full = '';
  let lineBuffer = '';

  process.stdout.write(prefix);

  for await (const token of tokens) {
    full += token;
    lineBuffer += token;
    process.stdout.write(token);
    opts.onToken?.(token);

    // Flush on newlines
    if (token.includes('\n')) {
      lineBuffer = '';
    }
  }

  process.stdout.write('\n');
  return full;
}

export function printStreamingHeader(): void {
  console.log('');
}

export function printStreamingFooter(tokens?: number, durationMs?: number): void {
  if (tokens !== undefined || durationMs !== undefined) {
    const parts: string[] = [];
    if (tokens !== undefined) parts.push(`${chalk.dim('Tokens:')} ${chalk.cyan(tokens.toLocaleString())}`);
    if (durationMs !== undefined) parts.push(`${chalk.dim('Time:')} ${chalk.cyan(`${(durationMs / 1000).toFixed(1)}s`)}`);
    console.log(chalk.dim('  ' + parts.join('  ')));
  }
}
