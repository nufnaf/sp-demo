# Feishu CLI

This executable invokes the unmodified `github.com/larksuite/cli` v1.0.95 command implementation (MIT, Copyright 2026 Lark Technologies Pte. Ltd.). Syntropic adds a transport provider through its public extension API, forwarding network requests to the application's Chromium system-proxy bridge over a local Unix socket. The official authorization, credential storage, user identity, permission checks and command execution remain intact.

Source: https://github.com/larksuite/cli/tree/v1.0.95

`go.mod` and `go.sum` record the exact dependency graph. The distribution includes dependency license files under `dependencies/`. Go runtime license is included as `LICENSE.go`.
