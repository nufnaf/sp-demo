import assert from "node:assert/strict";
import test from "node:test";

const { isRemoteTerminalEnabled, isTerminalHostAllowed } = await import("./security.ts");

test("terminal access is loopback-only by default", () => {
  assert.equal(isTerminalHostAllowed(new Request("http://localhost:30141/api/terminal/state", {
    headers: { host: "localhost:30141" },
  }), {}), true);
  assert.equal(isTerminalHostAllowed(new Request("http://localhost:30141/api/terminal/state", {
    headers: { host: "127.0.0.1:30141" },
  }), {}), true);
  assert.equal(isTerminalHostAllowed(new Request("http://localhost:30141/api/terminal/state", {
    headers: { host: "192.168.1.20:30141" },
  }), {}), false);
});

test("remote terminal access requires an explicit opt-in", () => {
  const environment = { PI_WEB_ENABLE_REMOTE_TERMINAL: "true" };
  assert.equal(isRemoteTerminalEnabled(environment), true);
  assert.equal(isTerminalHostAllowed(new Request("http://localhost:30141/api/terminal/state", {
    headers: { host: "agent.example:30141" },
  }), environment), true);
});
