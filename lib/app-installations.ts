import { randomBytes } from "node:crypto";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { isChinaConnectorAppId, type ChinaConnectorAppId } from "./china-apps";

const INSTALLATIONS_PATH = join(getAgentDir(), "app-installations.json");

interface InstallationFile {
  version: 1;
  installed: Partial<Record<ChinaConnectorAppId, { installedAt: string }>>;
}

async function readFileState(): Promise<InstallationFile> {
  try {
    const parsed = JSON.parse(await readFile(INSTALLATIONS_PATH, "utf8")) as Partial<InstallationFile>;
    return { version: 1, installed: parsed.installed ?? {} };
  } catch {
    return { version: 1, installed: {} };
  }
}

async function writeFileState(value: InstallationFile): Promise<void> {
  await mkdir(dirname(INSTALLATIONS_PATH), { recursive: true });
  const temporary = `${INSTALLATIONS_PATH}.${process.pid}.${randomBytes(5).toString("hex")}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, INSTALLATIONS_PATH);
  await chmod(INSTALLATIONS_PATH, 0o600);
}

export async function listInstalledConnectorIds(): Promise<ChinaConnectorAppId[]> {
  const state = await readFileState();
  return Object.keys(state.installed).filter(isChinaConnectorAppId);
}

export async function installConnector(id: ChinaConnectorAppId): Promise<ChinaConnectorAppId[]> {
  const state = await readFileState();
  state.installed[id] ??= { installedAt: new Date().toISOString() };
  await writeFileState(state);
  return Object.keys(state.installed).filter(isChinaConnectorAppId);
}

export async function uninstallConnector(id: ChinaConnectorAppId): Promise<ChinaConnectorAppId[]> {
  const state = await readFileState();
  delete state.installed[id];
  await writeFileState(state);
  return Object.keys(state.installed).filter(isChinaConnectorAppId);
}
