import { mkdir, readFile, writeFile, rm, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const marker = 'syntropic-presentation-v1';

// Never touches ~/.pi, legacy daily workspaces or the old recruiting store.
export async function clearPresentation(userData) {
  const root = join(userData, 'presentation');
  let stat;
  try {
    stat = await lstat(root);
  } catch (error) { if (error.code === 'ENOENT') return; throw error; }
  if (stat.isSymbolicLink()) throw new Error('演示目录不能是符号链接');
  const owner = await readFile(join(root, '.owner'), 'utf8').catch(() => '');
  if (owner !== marker) throw new Error('演示目录来源不明，未清理');
  await rm(root, { recursive: true });
}

export async function preparePresentation(userData) {
  await clearPresentation(userData);
  const root = join(userData, 'presentation');
  const home = join(root, 'workspaces');
  const cwd = join(home, 'pi-cwd-20260908-000000');
  const runId = randomUUID();
  await mkdir(root, { recursive: true });
  await writeFile(join(root, '.owner'), marker);
  await mkdir(cwd, { recursive: true });
  await mkdir(join(root, 'sessions'), { recursive: true });
  await writeFile(join(root, 'workspaces.json'), JSON.stringify({ version: 1, workspaces: [{ cwd, name: '招聘工作台', managed: true, createdAt: new Date().toISOString() }] }));
  await writeFile(join(root, 'run.json'), JSON.stringify({ runId, cwd }));
  return { root, cwd, runId };
}
