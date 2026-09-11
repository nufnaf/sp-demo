import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { existsSync } from "node:fs";

/** Stable, app-owned storage. Never borrow ~/.lark-cli or disposable run storage. */
export function feishuHome(): string {
  return process.env.SYNTROPIC_FEISHU_HOME || join(homedir(), ".syntropic", "feishu");
}
export function feishuCommand(): string {
  if (process.env.SYNTROPIC_FEISHU_CLI) return process.env.SYNTROPIC_FEISHU_CLI;
  const bundled = resolve("build/feishu-cli/lark-cli");
  return existsSync(bundled) ? bundled : process.platform === "win32" ? "lark-cli.cmd" : "lark-cli";
}
export function feishuEnvironment(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of Object.keys(env)) if ((key.startsWith("LARKSUITE_CLI_") || key.startsWith("LARK_CLI_"))) delete env[key];
  return { ...env, LARKSUITE_CLI_CONFIG_DIR: join(feishuHome(), "cli"), LARKSUITE_CLI_NO_UPDATE_NOTIFIER: "1", LARKSUITE_CLI_NO_SKILLS_NOTIFIER: "1" };
}
