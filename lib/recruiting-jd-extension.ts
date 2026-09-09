import { randomUUID } from "node:crypto";
import { readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Type } from "@earendil-works/pi-ai";
import { defineTool, type InlineExtension } from "@earendil-works/pi-coding-agent";
import { presentationCwd } from "./presentation-runtime";
import { recruitingJdContract } from "./recruiting-jd-contract";
import { countRecruitingJdCharacters, renderRecruitingJd, type RecruitingJdContent } from "./recruiting-jd-renderer";

export async function saveRecruitingJd(cwd: string, input: RecruitingJdContent, signal?: AbortSignal) {
  const expected = presentationCwd();
  if (!expected || resolve(cwd) !== resolve(expected) || await realpath(cwd) !== await realpath(expected)) throw new Error("此工具仅用于当前招聘工作台。");
  signal?.throwIfAborted();
  const html = renderRecruitingJd(input);
  const path = join(cwd, "ai-agent-engineer-jd.html");
  const temporary = join(cwd, `.jd-${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, html, { encoding: "utf8", mode: 0o600, flag: "wx" });
    if (await readFile(temporary, "utf8") !== html) throw new Error("岗位文件写入核对失败。");
    signal?.throwIfAborted();
    // Replacing the directory entry never follows an existing file symlink.
    await rename(temporary, path);
    return { path, title: input.title, sections: input.sections.length, characters: countRecruitingJdCharacters(input), bytes: Buffer.byteLength(html), verified: true };
  } finally { await rm(temporary, { force: true }); }
}

export function createRecruitingJdExtension(cwd: string): InlineExtension {
  return { name: "syntropic-recruiting-jd", hidden: true, factory(pi) {
    if (!recruitingJdContract(cwd)) return;
    pi.registerTool(defineTool({
      name: "save_recruiting_jd", label: "保存岗位 JD",
      description: "Save the freshly generated JD using the fixed HTML layout. Supply plain-text title and sections, without HTML/CSS or Markdown. Validates the combined 1200-character limit, writes atomically and verifies the file. On success no separate write/read is needed; on validation failure revise the content and retry.",
      parameters: Type.Object({
        path: Type.Literal("ai-agent-engineer-jd.html"),
        title: Type.Literal("AI Agent 工程师"),
        sections: Type.Array(Type.Object({ heading: Type.String({ minLength: 1, maxLength: 80 }), content: Type.String({ minLength: 1, maxLength: 8000 }) }), { minItems: 3, maxItems: 12 }),
      }),
      async execute(_id, input, signal, _update, ctx) {
        try {
          const saved = await saveRecruitingJd(ctx.cwd, input, signal);
          return { content: [{ type: "text" as const, text: JSON.stringify(saved) }], details: saved };
        } catch (error) {
          return { content: [{ type: "text" as const, text: error instanceof Error ? error.message : "岗位文件保存失败" }], details: {}, isError: true };
        }
      },
    }));
  } };
}
