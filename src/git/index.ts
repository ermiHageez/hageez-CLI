import simpleGit, { SimpleGit } from 'simple-git';

function getGit(cwd?: string): SimpleGit {
return simpleGit(cwd ?? process.cwd());
}

export async function getGitDiff(stagedOnly: boolean): Promise<string> {
const git = getGit();
try {
if (stagedOnly) {
return await git.diff(['--staged']);
}
return await git.diff();
} catch {
return '';
}
}

export async function gitCommit(message: string, push: boolean): Promise<void> {
const git = getGit();
await git.commit(message);
if (push) {
const status = await git.status();
await git.push('origin', status.current ?? 'main');
}
}

export async function getCurrentBranch(): Promise<string | null> {
const git = getGit();
try {
const status = await git.status();
return status.current;
} catch {
return null;
}
}

export async function gitStatus(): Promise<{ modified: number; staged: number; untracked: number }> {
const git = getGit();
try {
const status = await git.status();
return {
modified: status.modified.length,
staged: status.staged.length,
untracked: status.not_added.length,
};
} catch {
return { modified: 0, staged: 0, untracked: 0 };
}
}

export async function createBranch(name: string): Promise<void> {
const git = getGit();
await git.checkoutLocalBranch(name);
}
