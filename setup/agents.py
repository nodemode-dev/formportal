#!/usr/bin/env python3
"""./formportal agents: Claude Code, Codex and Cursor driving FormPortal.

  sync [--check]    regenerate the formportal-harness skill's references/tools.md from the MCP server itself and
                    mirror .claude/skills/formportal-harness to .agents/skills; --check exits 1 when anything drifted
  install [--dry-run] [claude|codex|cursor ...]
                    set the clients up for this user account: the MCP server and the skill (all three by default)
  status            which clients are on this computer and whether the skill is in step
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NAME = "formportal"
SKILL = ROOT / ".claude" / "skills" / "formportal-harness"
MIRROR = ROOT / ".agents" / "skills" / "formportal-harness"
HEAD = "Generated from the FormPortal MCP server by `./formportal agents sync`; do not edit by hand."


def launch() -> str:
    return str(ROOT / ("formportal.bat" if os.name == "nt" else "formportal"))


def tools() -> list[dict]:
    msgs = [
        {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "agents-sync", "version": "1"}}},
        {"jsonrpc": "2.0", "id": 2, "method": "tools/list"},
    ]
    feed = "".join(json.dumps(m) + "\n" for m in msgs)
    run = subprocess.run([launch(), "mcp"], input=feed, capture_output=True, text=True, cwd=ROOT, timeout=900)
    for line in run.stdout.splitlines():
        msg = json.loads(line)
        if msg.get("id") == 2:
            return msg["result"]["tools"]
    sys.exit("agents: the MCP server did not answer tools/list:\n" + run.stderr)


def tools_md() -> str:
    out = ["# FormPortal MCP tools", "", HEAD, ""]
    out.append("## Contents")
    out.append("")
    out.append("- The tool table, below")
    out.append("- Parameters, one heading per tool")
    out.append("- Shell equivalents, including `policy` and the command-line-only `mirror`")
    out.append("")
    out.append("## Tools")
    out.append("")
    out.append("| Tool | Changes the computer | What it does |")
    out.append("| --- | --- | --- |")
    for t in tools():
        a = t.get("annotations", {})
        change = "no" if a.get("readOnlyHint") else ("yes, destructive" if a.get("destructiveHint") else "yes")
        out.append(f"| `{t['name']}` | {change} | {t['description']} |")
    out.append("")
    out.append("## Parameters")
    out.append("")
    for t in tools():
        props = t["inputSchema"].get("properties", {})
        req = set(t["inputSchema"].get("required", []))
        out.append(f"### {t['name']}")
        out.append("")
        if not props:
            out.append("No parameters.")
        for k, v in props.items():
            kind = "|".join(v["enum"]) if "enum" in v else v.get("type", "any")
            out.append(f"- `{k}`{'' if k in req else ' (optional)'}: {kind}. {v.get('description', '')}")
        out.append("")
    out.append("## Shell equivalents")
    out.append("")
    out.append("`./formportal cli status`, `apps [--source S]`, `info [product]`, `installs`, `install [product] [--channel C] [--source S] [--allow-unsigned]`, `open [product]`, `rollback [product]`, `remove [product]`, `policy`. Output is the same JSON the tools return. `mirror --to DIR --base-url URL` exists only on the command line (see sub-skills/organisations).")
    return "\n".join(out) + "\n"


def _files(folder: Path) -> dict:
    return {str(p.relative_to(folder)): p.read_bytes() for p in sorted(folder.rglob("*")) if p.is_file()}


def sync(check: bool) -> int:
    drift = []
    ref = SKILL / "references" / "tools.md"
    text = tools_md()
    if not ref.exists() or ref.read_text(encoding="utf-8") != text:
        drift.append(str(ref.relative_to(ROOT)))
        if not check:
            ref.parent.mkdir(parents=True, exist_ok=True)
            ref.write_text(text, encoding="utf-8")
    if not MIRROR.exists() or _files(MIRROR) != _files(SKILL):
        drift.append(str(MIRROR.relative_to(ROOT)))
        if not check:
            shutil.rmtree(MIRROR, ignore_errors=True)
            shutil.copytree(SKILL, MIRROR)
    if check:
        print("agents: in step" if not drift else "agents: drifted: " + ", ".join(drift) + " (run ./formportal agents sync)")
        return 1 if drift else 0
    print("agents: " + ("updated " + ", ".join(drift) if drift else "already in step"))
    return 0


def _backup(path: Path, dry: bool) -> None:
    if path.exists() and not dry:
        shutil.copy2(path, path.with_name(path.name + f".bak-{time.strftime('%Y%m%d-%H%M%S')}"))


def _copy_skill(to: Path, dry: bool, said: list) -> None:
    if to.exists() and _files(to) == _files(SKILL):
        said.append(f"  skill already at {to}")
        return
    said.append(f"  skill -> {to}")
    if not dry:
        shutil.rmtree(to, ignore_errors=True)
        to.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(SKILL, to)


def install_claude(home: Path, dry: bool, said: list) -> None:
    said.append("Claude Code:")
    cmd = launch()
    claude = shutil.which("claude")
    if claude:
        have = subprocess.run([claude, "mcp", "get", NAME], capture_output=True, text=True)
        if have.returncode == 0 and cmd in have.stdout:
            said.append(f"  MCP server {NAME} already set (user scope)")
        else:
            said.append(f"  claude mcp add --scope user {NAME} -- {cmd} mcp")
            if not dry:
                if have.returncode == 0:
                    subprocess.run([claude, "mcp", "remove", NAME, "--scope", "user"], capture_output=True)
                subprocess.run([claude, "mcp", "add", "--scope", "user", NAME, "--", cmd, "mcp"], check=True, capture_output=True)
    else:
        said.append(f"  the claude command is not installed here; once it is, run: claude mcp add --scope user {NAME} -- {cmd} mcp")
    _copy_skill(home / ".claude" / "skills" / SKILL.name, dry, said)


def install_codex(home: Path, dry: bool, said: list) -> None:
    said.append("Codex:")
    cmd = launch().replace("\\", "\\\\")
    cfg = Path(os.environ.get("CODEX_HOME", home / ".codex")) / "config.toml"
    block = f'[mcp_servers.{NAME}]\ncommand = "{cmd}"\nargs = ["mcp"]\nstartup_timeout_sec = 600\ntool_timeout_sec = 3600\n'
    text = cfg.read_text(encoding="utf-8") if cfg.exists() else ""
    found = re.search(rf"(?ms)^\[mcp_servers\.{NAME}\]\n.*?(?=^\[|\Z)", text)
    if found and found.group(0).strip() == block.strip():
        said.append(f"  MCP server {NAME} already in {cfg}")
    else:
        said.append(f"  MCP server {NAME} -> {cfg}")
        if not dry:
            _backup(cfg, dry)
            cfg.parent.mkdir(parents=True, exist_ok=True)
            new = text[: found.start()] + block + "\n" + text[found.end():] if found else (text.rstrip("\n") + "\n\n" if text.strip() else "") + block
            cfg.write_text(new, encoding="utf-8")
    _copy_skill(home / ".agents" / "skills" / SKILL.name, dry, said)


def install_cursor(home: Path, dry: bool, said: list) -> None:
    said.append("Cursor:")
    cfg = home / ".cursor" / "mcp.json"
    raw = cfg.read_text(encoding="utf-8") if cfg.exists() else ""
    data = json.loads(raw) if raw.strip() else {}
    entry = {"command": launch(), "args": ["mcp"]}
    if data.get("mcpServers", {}).get(NAME) == entry:
        said.append(f"  MCP server {NAME} already in {cfg}")
    else:
        said.append(f"  MCP server {NAME} -> {cfg}")
        if not dry:
            _backup(cfg, dry)
            data.setdefault("mcpServers", {})[NAME] = entry
            cfg.parent.mkdir(parents=True, exist_ok=True)
            cfg.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    _copy_skill(home / ".agents" / "skills" / SKILL.name, dry, said)


CLIENTS = {"claude": install_claude, "codex": install_codex, "cursor": install_cursor}


def install(args: list[str]) -> int:
    dry = "--dry-run" in args
    which = [a for a in args if not a.startswith("--")] or list(CLIENTS)
    home = Path(os.environ.get("HOME", str(Path.home())))
    said: list[str] = []
    for w in which:
        if w in CLIENTS:
            CLIENTS[w](home, dry, said)
        else:
            said.append(f"unknown client {w} (claude, codex or cursor)")
    print("\n".join(said))
    return 0


def status() -> int:
    for name, binary in (("claude", "claude"), ("codex", "codex"), ("cursor", "cursor-agent")):
        print(f"{name}: {'found' if shutil.which(binary) else 'not found'}")
    return sync(True)


def main(argv: list[str]) -> int:
    if not argv or argv[0] in ("-h", "--help", "help"):
        print(__doc__)
        return 0
    if argv[0] == "sync":
        return sync("--check" in argv[1:])
    if argv[0] == "install":
        return install(argv[1:])
    if argv[0] == "status":
        return status()
    print(f"agents: unknown action {argv[0]}\n{__doc__}")
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
