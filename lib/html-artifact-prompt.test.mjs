import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DefaultResourceLoader } from "@earendil-works/pi-coding-agent";
import { createJiti } from "jiti";

const { appendHtmlArtifactPrompt, TASK_HTML_ARTIFACT_PROMPT } = await createJiti(import.meta.url).import("./html-artifact-prompt.ts");

test("HTML guidance preserves discovered APPEND_SYSTEM.md across SDK resource reloads", async () => {
  const root = await mkdtemp(join(tmpdir(), "pi-html-prompt-"));
  try {
    const cwd = join(root, "project");
    const agentDir = join(root, "agent");
    await mkdir(join(cwd, ".pi"), { recursive: true });
    await mkdir(agentDir);
    const projectPrompt = "Use the user's existing brand and deliver in Chinese.";
    await writeFile(join(cwd, ".pi", "APPEND_SYSTEM.md"), projectPrompt);
    const loader = new DefaultResourceLoader({
      cwd, agentDir,
      noExtensions: true, noSkills: true, noPromptTemplates: true,
      noThemes: true, noContextFiles: true,
      appendSystemPromptOverride: appendHtmlArtifactPrompt,
    });
    await loader.reload();
    assert.deepEqual(loader.getAppendSystemPrompt(), [projectPrompt, TASK_HTML_ARTIFACT_PROMPT]);
    await loader.reload();
    assert.deepEqual(loader.getAppendSystemPrompt(), [projectPrompt, TASK_HTML_ARTIFACT_PROMPT]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("restoring a subagent resource snapshot does not duplicate HTML guidance or mutate it", () => {
  const snapshot = Object.freeze(["Profile", "Inherited task context", TASK_HTML_ARTIFACT_PROMPT]);
  const restored = appendHtmlArtifactPrompt(snapshot);
  assert.deepEqual(restored, snapshot);
  assert.notEqual(restored, snapshot);
});
