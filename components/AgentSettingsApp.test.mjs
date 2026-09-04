import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const settingsSource = await readFile(new URL("./AgentSettingsApp.tsx", import.meta.url), "utf8");
const desktopSource = await readFile(new URL("./AgentDesktop.tsx", import.meta.url), "utf8");
const cssSource = await readFile(new URL("./AgentDesktop.css", import.meta.url), "utf8");

test("Agent OS dock opens a real settings application", () => {
  assert.match(desktopSource, /<AgentSettingsApp/);
  assert.match(desktopSource, /setSettingsOpen\(true\)/);
  assert.match(desktopSource, /kind="settings"/);
});

test("Agent OS settings reuses every Pi configuration surface", () => {
  for (const component of ["ModelsConfig", "VoiceConfig", "AgentsConfig", "SkillsConfig", "PluginsConfig"]) {
    assert.match(settingsSource, new RegExp(`<${component} embedded`));
  }
  for (const section of ["general", "models", "voice", "agents", "skills", "plugins"]) {
    assert.match(settingsSource, new RegExp(`id: "${section}"`));
  }
});

test("settings app includes Apple-style split navigation and accessibility fallbacks", () => {
  assert.match(cssSource, /\.agent-settings-app \{[\s\S]*?grid-template-columns: 238px minmax\(0, 1fr\)/);
  assert.match(cssSource, /backdrop-filter: blur\(28px\)/);
  assert.match(cssSource, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(cssSource, /@media \(prefers-reduced-transparency: reduce\)/);
  assert.match(settingsSource, /aria-label="搜索设置"/);
  assert.match(settingsSource, /role="radiogroup"/);
});
