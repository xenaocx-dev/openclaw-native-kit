# Licenses and third-party modifications

Original OpenClaw Native Kit scripts, documentation, configuration templates and locally authored helpers are licensed under the root [MIT LICENSE](LICENSE), copyright 2026 xenaocx-dev and contributors. That license does not replace the licenses of copied or derived third-party files below. This is a community-maintained kit, not an official OpenClaw, Anthropic or OpenAI distribution.

## OpenClaw and its ACPX extension — MIT

`overlay/payload/openclaw/`, `overlay/payload/acpx/` and their corresponding stock/r1/r2 test fixtures contain code derived from OpenClaw 2026.9.4. The installed `@openclaw/acpx` 2026.9.4 package identifies [openclaw/openclaw](https://github.com/openclaw/openclaw) as its repository; it is the extension in that MIT-licensed repository, not a separately relicensed implementation.

- Copyright (c) 2026 OpenClaw Foundation.
- The exact license from the 2026.9.4 installation is retained in [licenses/openclaw-MIT.txt](licenses/openclaw-MIT.txt).
- Its complete upstream notices are preserved in [licenses/openclaw-THIRD_PARTY_NOTICES.md](licenses/openclaw-THIRD_PARTY_NOTICES.md), including Pi / pi-mono and GitHub Octicons attribution. This preserves the upstream notice file rather than claiming every listed component is used by this subset.
- Modified payloads implement the compatibility changes described in `overlay/README.md` and release notes. Stock fixtures are unchanged; r1/r2 fixtures are prior modified snapshots. The manifest and fixture hashes distinguish them.

## Claude ACP adapter — Apache-2.0

`overlay/payload/claude-agent-acp/dist/acp-agent.js` and the stock `overlay/tests/fixtures/adapter/dist/acp-agent.js` derive from [@agentclientprotocol/claude-agent-acp](https://github.com/agentclientprotocol/claude-agent-acp) 0.70.0.

- Copyright 2025 Zed Industries, Inc. and contributors.
- The complete license, including upstream attribution, is retained unchanged in [licenses/claude-agent-acp-Apache-2.0.txt](licenses/claude-agent-acp-Apache-2.0.txt).
- The distributed 0.70.0 package contains LICENSE and no separate NOTICE file.
- The payload is modified: native permission-form integration, reasoning summary/language controls and local compatibility-module wiring. Its file header explicitly identifies these modifications. The r3.1 header itself is a comment-only addition; executable code remains byte-identical to reviewed r3 after removing that header.
- The stock fixture is unmodified. The kit's locally authored `openclaw-acp-compat-v1.mjs` helper is covered by the root MIT license; the derived adapter file remains Apache-2.0.

Claude Code and the Anthropic SDK implementations are not bundled. The adapter imports separately installed packages. Optional MCP SDK/zod dependencies are also not copied into this kit; their installed distributions retain their own licenses.

The MIT license grants no ownership of upstream trademarks or access to hosted models. Users supply their own working native authentication and model access.
