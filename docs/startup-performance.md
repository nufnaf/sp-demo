# Startup performance test build

The native splash now waits for local service readiness, current Feishu authorization,
native permission checks, and a rendered desktop frame. Workspace/calendar preparation
runs after entering the desktop on both first setup and later launches. The desktop
shows preparation progress and retry/reauthorization controls on failure. Calendar
consumers wait for preparation and refresh when it finishes.

## Timing records

The packaged App writes fixed stage names to
`~/Library/Logs/Syntropic/startup.jsonl`. No command output, account names, credentials,
or API response bodies are included. Records include `launchId`, process ID, wall clock,
`stage`, and monotonic `elapsedMs` since the timing module loaded. Once the runtime
manifest is available, later records also include `buildId`. The previous log is retained
as `startup.jsonl.previous` when the file exceeds 2 MB at the next configuration.

- `presentation.run.start/end`: disposable local files.
- `supervisor.start`, `runtime.prepare.start/end`, `services.ready`: packaged runtime and service startup, including readiness probes.
- `workbench.load.start/end`: main page navigation.
- `renderer.feishu.check.*`, `renderer.permissions.check.*`: connection and permission checks.
- `renderer.assets.wait.start/end`, `renderer.frame.ready`: wallpaper, fonts and painted frame.
- `splash.reveal`, `splash.hidden`: start of fade and actual overlay removal.
- `renderer.calendar.prepare.start/end/error`: background preparation.

Use `splash.hidden` after the desktop's `renderer.frame.ready` as the visible startup
endpoint. Setup screens can also reveal the splash: on a launch needing permission,
separate time spent awaiting the user's input from a subsequent fully authorized
cold launch. Reloads share a launch ID and produce further records rather than
replacing earlier measurements. This is App-internal timing, not OS click-to-process time.

## Validation scope

`npm run test:desktop` checks native lifecycle and logging; calendar store/reset tests
check invalidation and idempotence. `scripts/desktop-startup-packaged.test.mjs` holds
preparation responses open and verifies the real packaged renderer reveals the desktop
on initial authorization, retry, and completed-launch reload. Its authorization and
calendar writes are fixtures. The user handles installed App permissions and performs
the actual cold launch measurement; the isolation test is not installed-App acceptance.
