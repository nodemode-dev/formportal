import { fixtureBridge } from "../../../frontend/src/bridge/fixture.ts";
import type { Channel } from "../../../frontend/src/engine/types.ts";
import { encoder, sha256 } from "../../../demo/src/util.ts";
import { adoptCurrent, flags, installed, pickArtifact, releaseOf } from "./bridge.ts";
import { readPack, writePack } from "./pack.ts";
import { findArtifact, publish, world } from "./world.ts";

export interface Case {
  id: string;
  title: string;
  what: string;
  caught: string;
  kind: "catalogue" | "download" | "disk";
}

export const CASES: Case[] = [
  { id: "altered", title: "Change the catalogue after it was signed", what: "One SHA-256 in apps.json is swapped on its way to you, so a download could be replaced.", caught: "Signature", kind: "catalogue" },
  { id: "unsigned", title: "Remove the signature", what: "apps.json arrives with no apps.json.sig. Preferences, Catalogue has a developer switch that accepts this; try it with the switch on and off.", caught: "Signature", kind: "catalogue" },
  { id: "stranger", title: "Sign it with a key nobody trusts", what: "A well-formed signature from a key this build was never given.", caught: "Signature", kind: "catalogue" },
  { id: "offline", title: "Lose the network", what: "The download fails, so FormPortal reads the copy it kept, and checks that copy's signature again.", caught: "Kept copy", kind: "catalogue" },
  { id: "flipped", title: "Flip one byte of the download", what: "A signed catalogue, a damaged file: one bit changed in transit.", caught: "SHA-256", kind: "download" },
  { id: "http", title: "Point a release at plain http", what: "A signed entry whose address is http://, not https://.", caught: "Address", kind: "download" },
  { id: "slip", title: "Ship a package that writes outside its folder", what: "Signed and hashed correctly, but one path inside climbs out with ../ to a startup folder.", caught: "Unpack", kind: "download" },
  { id: "link", title: "Ship a package with a link that points outside", what: "Signed and hashed correctly, but one entry is a link to a file outside the install folder.", caught: "Unpack", kind: "download" },
  { id: "missing", title: "Delete an app's files, then repair", what: "An installed app's folder disappears, as if a cleaner removed it. Preferences, About, Check now finds it and Repair installs it again with the SHA-256 checked.", caught: "Repair", kind: "disk" },
];

export interface Target {
  product: string;
  channel: Channel;
}

function press(target: Target): boolean {
  const row = document.querySelector<HTMLElement>(`.list-updates .row[data-row="${target.channel}"][data-product="${target.product}"]`);
  const button = row?.querySelector<HTMLButtonElement>('[data-act="update"]');
  if (!button) return false;
  button.click();
  return true;
}

export async function tryCase(id: string, target: Target): Promise<string> {
  if (id === "altered" || id === "unsigned" || id === "stranger" || id === "offline") {
    flags.armed = id;
    document.querySelector<HTMLButtonElement>("[data-retry]")?.click();
    return "Reading the catalogue again.";
  }
  if (id === "missing") {
    const held = installed.get(`${target.product}:${target.channel}`);
    if (!held) return "That app is not installed.";
    held.gone = true;
    return "The folder is gone. Open Preferences, About, and press Check now.";
  }
  const platform = await fixtureBridge.platform();
  const release = releaseOf(world.catalogue, target.product, target.channel);
  const artifact = release ? pickArtifact(release.artifacts, platform.os, platform.arch) : undefined;
  if (!release || !artifact) return "The catalogue has nothing for this computer there.";
  if (id === "flipped") {
    flags.flip = true;
    return press(target) ? "Installing with one byte changed." : "Choose an app that is installed.";
  }
  if (id === "http") {
    await publish((c) => {
      const a = findArtifact(c, artifact.file);
      if (a) a.url = `http://downloads.example.net/${artifact.file}`;
    });
  } else {
    const entries = await readPack(world.packs.get(artifact.file) as Uint8Array);
    const extra = id === "slip" ? { name: "../../../.config/autostart/updater.desktop", data: encoder.encode("[Desktop Entry]\nType=Application\nExec=updater\n") } : { name: "bin/updater", data: encoder.encode("../../../../.ssh/authorized_keys"), link: true };
    const evil = writePack([...entries.map((e) => ({ name: e.name, data: e.data, link: e.link })), extra]);
    flags.evil.set(artifact.file, evil);
    const hash = await sha256(evil);
    await publish((c) => {
      const a = findArtifact(c, artifact.file);
      if (a) {
        a.sha256 = hash;
        a.bytes = evil.length;
      }
    });
  }
  adoptCurrent();
  return press(target) ? "Installing." : "Choose an app that is installed.";
}
