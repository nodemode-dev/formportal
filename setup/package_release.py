import argparse
import hashlib
import json
import platform as host
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

HUB = Path(__file__).resolve().parent.parent
REPOSITORY = "https://github.com/nodemode-dev/formportal"
STORE = "https://dl.formai.studio/formportal"
FLOORS = {"macos": "macOS 12", "windows": "Windows 10"}


def version() -> str:
    return json.loads((HUB / "src-tauri" / "tauri.conf.json").read_text(encoding="utf-8"))["version"]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def floor(system: str) -> str:
    if system in FLOORS:
        return FLOORS[system]
    name, release = host.libc_ver()
    return f"{name} {release}".strip() or "Linux"


INSTALLERS = {
    "macos": [("dmg", "dmg/*.dmg", ".dmg")],
    "linux": [("appimage", "appimage/*.AppImage", ".AppImage"), ("deb", "deb/*.deb", ".deb"), ("rpm", "rpm/*.rpm", ".rpm")],
    "windows": [("nsis", "nsis/*-setup.exe", "-setup.exe")],
}


def installers(system: str, arch: str, bundle: Path) -> list[tuple[Path, str, str]]:
    found = []
    for kind, pattern, suffix in INSTALLERS[system]:
        matches = sorted(bundle.glob(pattern))
        if matches:
            found.append((matches[0], f"formportal-{version()}-{system}-{arch}{suffix}", kind))
    return found


def pack(system: str, arch: str, bundle: Path, out: Path) -> list[dict]:
    out.mkdir(parents=True, exist_ok=True)
    files = installers(system, arch, bundle)
    if not files:
        sys.exit(f"no installer for {system} under {bundle}")
    entries, shipped = [], {}
    for source, name, kind in files:
        target = out / name
        target.unlink(missing_ok=True)
        shutil.copyfile(source, target)
        shipped[source.resolve()] = name
        entry = {"platform": system, "arch": arch, "kind": kind, "file": name, "bytes": target.stat().st_size, "sha256": sha256(target), "minimum_os": floor(system)}
        (out / f"manifest-{system}-{arch}-{kind}.json").write_text(json.dumps(entry, indent=2) + "\n", encoding="utf-8")
        entries.append(entry)
    updater(system, arch, bundle, out, shipped)
    return entries


UPDATER = {"macos": ("macos", "*.app.tar.gz"), "linux": ("appimage", "*.AppImage"), "windows": ("nsis", "*.exe")}
TARGET = {"macos": "darwin", "linux": "linux", "windows": "windows"}
ARCH = {"arm64": "aarch64", "x86_64": "x86_64"}


def updater(system: str, arch: str, bundle: Path, out: Path, shipped: dict[Path, str]) -> None:
    folder, pattern = UPDATER[system]
    for found in sorted((bundle / folder).glob(pattern)):
        signature = found.with_name(found.name + ".sig")
        if not signature.is_file():
            continue
        name = shipped.get(found.resolve())
        if not name:
            suffix = ".app.tar.gz" if found.name.endswith(".app.tar.gz") else found.suffix
            name = f"formportal-{version()}-{system}-{arch}-update{suffix}"
            shutil.copyfile(found, out / name)
        part = {"key": f"{TARGET[system]}-{ARCH[arch]}", "file": name, "signature": signature.read_text(encoding="utf-8").strip()}
        (out / f"updater-{system}-{arch}.json").write_text(json.dumps(part, indent=2) + "\n", encoding="utf-8")
        return


def finish(out: Path) -> dict:
    assets = [json.loads(p.read_text(encoding="utf-8")) for p in sorted(out.glob("manifest-*.json"))]
    if not assets:
        sys.exit(f"no manifest-*.json under {out}")
    for asset in assets:
        shipped = out / asset["file"]
        if shipped.is_file():
            asset["bytes"], asset["sha256"] = shipped.stat().st_size, sha256(shipped)
    for notice, name in (("LICENSE", "LICENSE.txt"), ("LICENSES.md", "LICENSES.md")):
        shutil.copyfile(HUB / notice, out / name)
    commit = subprocess.run(["git", "rev-parse", "HEAD"], cwd=HUB, capture_output=True, text=True).stdout.strip()
    manifest = {
        "name": "formportal",
        "version": version(),
        "commit": commit,
        "published": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "repository": REPOSITORY,
        "assets": assets,
    }
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    (out / "SHA256SUMS").write_text("".join(f"{a['sha256']}  {a['file']}\n" for a in assets), encoding="utf-8")
    parts = [json.loads(p.read_text(encoding="utf-8")) for p in sorted(out.glob("updater-*.json"))]
    if parts:
        latest = {
            "version": version(),
            "notes": f"{REPOSITORY}/blob/main/CHANGELOG.md",
            "pub_date": manifest["published"],
            "platforms": {p["key"]: {"signature": p["signature"], "url": f"{STORE}/{version()}/{p['file']}"} for p in parts},
        }
        (out / "latest.json").write_text(json.dumps(latest, indent=2) + "\n", encoding="utf-8")
    for part in list(out.glob("manifest-*.json")) + list(out.glob("updater-*.json")):
        part.unlink()
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description="Copy a built FormPortal bundle's installers into the release folder, or finish a release from the copied parts.")
    parser.add_argument("--platform", choices=["macos", "windows", "linux"])
    parser.add_argument("--arch", choices=["arm64", "x86_64"])
    parser.add_argument("--bundle-dir", default=str(HUB / "target" / "release" / "bundle"))
    parser.add_argument("--out", default=str(HUB / "release-dist"))
    parser.add_argument("--finish", action="store_true")
    args = parser.parse_args()
    out = Path(args.out)
    if args.finish:
        print(json.dumps(finish(out), indent=2))
        return
    if not args.platform or not args.arch:
        parser.error("--platform and --arch are needed unless --finish is given")
    print(json.dumps(pack(args.platform, args.arch, Path(args.bundle_dir), out), indent=2))


if __name__ == "__main__":
    main()
