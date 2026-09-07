import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
const run = promisify(execFile);

async function processes() {
  const { stdout } = await run('ps', ['-axo', 'pid=,ppid=,lstart=']);
  return stdout.trim().split('\n').flatMap((line) => {
    const match = line.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/);
    return match ? [{ pid: Number(match[1]), parent: Number(match[2]), started: match[3] }] : [];
  });
}

// Track only descendants of a process we spawned, including separate Chrome/PTY
// process groups. Start times prevent killing a PID that has since been reused.
export class OwnedProcessTree {
  members = new Map();
  constructor(pid) {
    this.pid = pid;
    this.timer = setInterval(() => { void this.capture().catch(() => {}); }, 500);
    this.timer.unref();
  }
  async capture() {
    const rows = await processes();
    const root = rows.find((row) => row.pid === this.pid);
    if (root && !this.members.has(this.pid)) this.members.set(this.pid, root.started);
    const live = new Set(rows.filter((row) => this.members.get(row.pid) === row.started).map((row) => row.pid));
    let changed = true;
    while (changed) {
      changed = false;
      for (const row of rows) {
        if (live.has(row.parent) && !live.has(row.pid)) {
          this.members.set(row.pid, row.started);
          live.add(row.pid);
          changed = true;
        }
      }
    }
    return rows.filter((row) => live.has(row.pid));
  }
  async stop() {
    if (this.stopping) return this.stopping;
    this.stopping = this.stopAll();
    return this.stopping;
  }
  async stopAll() {
    clearInterval(this.timer);
    const signal = async (name) => {
      const live = await this.capture();
      for (const row of live.reverse()) {
        try { process.kill(row.pid, name); } catch (error) { if (error.code !== 'ESRCH') throw error; }
      }
    };
    await signal('SIGTERM');
    await delay(1500);
    await signal('SIGKILL');
  }
}
