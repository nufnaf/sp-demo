import assert from "node:assert/strict";
import test from "node:test";
import { emitFileEvent, subscribeToFileEvents } from "./events.ts";

test("files app events are delivered only while subscribed", () => {
  const received = [];
  const unsubscribe = subscribeToFileEvents((event) => received.push(event));
  const event = { type: "file.open", cwd: "/workspace", filePath: "/workspace/app.ts", line: 4, foreground: true };
  emitFileEvent(event);
  unsubscribe();
  emitFileEvent({ ...event, line: 8 });
  assert.deepEqual(received, [event]);
});
