import { NextResponse } from "next/server";
import { allowFileRoot } from "@/lib/file-access";
import { createManagedWorkspace } from "@/lib/workspaces";

// POST /api/default-cwd
// Creates a managed workspace for the first desktop task and returns its path.
export async function POST() {
  try {
    const workspace = createManagedWorkspace();
    allowFileRoot(workspace.cwd);
    return NextResponse.json({ cwd: workspace.cwd });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
