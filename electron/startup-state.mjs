import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

/** Stable across presentation runs, ports and restarts; never a replacement for OS checks. */
export function createStartupState(directory) {
  const file = join(directory, 'startup-state.json');
  return {
    read() {
      try {
        const value = JSON.parse(readFileSync(file, 'utf8'));
        return value?.version === 1 ? { captureVerified: value.captureVerified === true, complete: value.complete === true } : {};
      } catch (error) {
        if (error.code === 'ENOENT' || error instanceof SyntaxError) return {};
        throw error;
      }
    },
    write(value) {
      mkdirSync(directory, { recursive: true });
      const temporary = `${file}.${randomUUID()}.tmp`;
      writeFileSync(temporary, JSON.stringify({ version: 1, ...value }), { mode: 0o600 });
      renameSync(temporary, file);
    },
  };
}
