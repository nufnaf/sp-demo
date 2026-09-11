import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { computerAvailable } from "@/lib/computer/runtime";
import { computerRequestAllowed } from "@/lib/computer/request";
import { hasJsonContentType } from "@/lib/request-security";

export async function POST(request: Request) {
  if (!computerRequestAllowed(request) || !hasJsonContentType(request)) return Response.json({}, { status: 403 });
  if (!computerAvailable()) return Response.json({ error: "请在 macOS 版 Syntropic 中打开飞书。" }, { status: 409 });
  try {
    // User-requested activation only. No shell, supplied path, restart or
    // target-app flags; background model tools cannot invoke this action.
    await promisify(execFile)("/usr/bin/open", ["-b", "com.electron.lark"], { timeout: 5000 });
    return Response.json({ opened: true });
  } catch {
    return Response.json({ error: "暂时无法打开飞书，请检查客户端是否已安装。" }, { status: 503 });
  }
}
