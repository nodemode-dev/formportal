---
name: agent-substrate
description: Changes to FormPortal's command line, MCP server and agent wiring. Use when adding or changing an MCP tool or CLI command, the protocol handling, the ./formportal mcp dispatch, the Claude Code, Codex or Cursor configs, setup/agents.py, or the formportal-harness skill.
---

# agent-substrate

## Shape

- `cli/src/ops.rs` holds every operation once, returning JSON (`serde_json::Value`). Both surfaces call it.
- `cli/src/mcp.rs` is a line-delimited JSON-RPC 2.0 server on stdio: `initialize` (negotiates 2025-11-25, 2025-06-18, 2025-03-26, 2024-11-05), `ping`, `tools/list`, `tools/call`, empty `resources/list` and `prompts/list`. Results carry text and `structuredContent`; failures are `isError: true` with FormPortal's sentence. Nothing but JSON-RPC may reach stdout.
- `cli/src/main.rs` maps `status`, `apps`, `info`, `installs`, `install`, `open`, `rollback`, `remove` and `mcp`.
- `./formportal mcp` builds `formportal-cli` in release when its sources are newer, then execs it. `.mcp.json`, `.codex/config.toml` and `.cursor/mcp.json` run that.

## Adding a tool

1. The operation in `ops.rs` (calling `core`, never re-implementing it).
2. The schema and annotations in `mcp.rs`'s `tools()` (`readOnlyHint`, `destructiveHint` honest), the dispatch in `call`.
3. The command in `main.rs`.
4. `./formportal agents sync`, then the harness skill's prose (routing table, sub-skill) in the same commit.
5. Drive it: pipe `initialize`, `tools/list` and a `tools/call` into `./formportal mcp` with a scratch `FORMPORTAL_ROOT`, and a local catalogue served on 127.0.0.1.

## Rules

- Tools that change the computer say so in their description and annotations; the harness tells agents to confirm first.
- No tool may accept a flag that skips the SHA-256 check.
- Log in `cli/HASHOUT_LOG.md`.
