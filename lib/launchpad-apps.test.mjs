import assert from "node:assert/strict";
import test from "node:test";
import { getInstalledLaunchpadApps, getLaunchpadApps, getPluginPackageName, toLaunchpadApp } from "./launchpad-apps.ts";

function plugin(source, packageName, status = "loaded") {
  return {
    source,
    scope: "global",
    filtered: false,
    disabled: status === "disabled",
    installedPath: "/tmp/plugin",
    packageName,
    counts: { extensions: 1, skills: 0, prompts: 0, themes: 0 },
    resources: [],
    status,
  };
}

test("the six default Pi plugins become branded launchpad apps", () => {
  const apps = getInstalledLaunchpadApps([
    plugin("npm:pi-google-workspace", "pi-google-workspace"),
    plugin("npm:pi-mono-linear", "pi-mono-linear"),
    plugin("npm:@feniix/pi-notion", "@feniix/pi-notion"),
    plugin("npm:@dreki-gg/pi-slack", "@dreki-gg/pi-slack"),
    plugin("npm:pi-mono-figma", "pi-mono-figma"),
    plugin("npm:@aduverger/pi-ship", "@aduverger/pi-ship"),
  ]);

  assert.deepEqual(apps.map((app) => app.name), ["GitHub", "Figma", "Slack", "Notion", "Linear", "Google Workspace"]);
  assert.match(apps.at(-1)?.description ?? "", /Gmail/);
  assert.ok(apps.every((app) => app.plugin.source.startsWith("npm:")));
});

test("missing packages stay out while disabled installed apps remain visible", () => {
  const apps = getInstalledLaunchpadApps([
    plugin("npm:pi-mono-linear", "pi-mono-linear", "disabled"),
    plugin("npm:missing", "missing", "missing"),
  ]);
  assert.deepEqual(apps.map((app) => [app.name, app.plugin.disabled]), [["Linear", true]]);
});

test("unknown packages get a readable fallback without becoming a second data source", () => {
  assert.equal(getPluginPackageName(plugin("npm:@scope/pi-calendar@1.2.0", undefined)), "@scope/pi-calendar");
  const app = toLaunchpadApp(plugin("npm:pi-calendar", "pi-calendar"));
  assert.equal(app.name, "Calendar");
  assert.equal(app.category, "其他");
  assert.equal(app.plugin.source, "npm:pi-calendar");
});

test("Feishu is a built-in CLI app and is not represented as a Pi plugin", () => {
  const apps = getLaunchpadApps([]);
  assert.deepEqual(apps.map((app) => [app.name, app.kind]), [["飞书", "builtin"]]);
  assert.equal(apps[0].appearance, "feishu");
  assert.ok(!("plugin" in apps[0]));
});

test("installed China-market connectors become first-class launchpad apps", () => {
  const apps = getLaunchpadApps([], ["wecom", "wind", "qichacha"]);
  assert.deepEqual(apps.map((app) => [app.name, app.kind, app.category]), [
    ["飞书", "builtin", "企业协同"],
    ["企业微信", "connector", "企业协同"],
    ["Wind 万得", "connector", "金融数据"],
    ["企查查", "connector", "法律服务"],
  ]);
});
