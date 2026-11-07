import { encoder } from "./util.ts";
import { signedCatalogue, packageBytes } from "./catalogue.ts";
import { fontBytes, fontsReady } from "./store.ts";
import { SAMPLES, put } from "./library.ts";

function poster(): Promise<Uint8Array> {
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 500;
  const g = canvas.getContext("2d");
  if (!g) return Promise.resolve(new Uint8Array());
  const sky = g.createLinearGradient(0, 0, 800, 500);
  sky.addColorStop(0, "#1b1530");
  sky.addColorStop(0.55, "#8a3b2a");
  sky.addColorStop(1, "#f0a23a");
  g.fillStyle = sky;
  g.fillRect(0, 0, 800, 500);
  g.fillStyle = "rgba(255,255,255,0.14)";
  g.beginPath();
  g.arc(600, 170, 90, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#0b0912";
  g.beginPath();
  g.moveTo(0, 500);
  for (let x = 0; x <= 800; x += 40) g.lineTo(x, 360 + Math.sin(x / 70) * 36 + Math.cos(x / 23) * 12);
  g.lineTo(800, 500);
  g.closePath();
  g.fill();
  g.fillStyle = "#ffffff";
  g.font = "700 54px system-ui, sans-serif";
  g.fillText("Launch poster", 48, 108);
  g.font = "400 22px system-ui, sans-serif";
  g.fillText("Generated in the page, opens in FormVis", 50, 148);
  return new Promise((done) => canvas.toBlob(async (blob) => done(new Uint8Array(await (blob as Blob).arrayBuffer())), "image/png"));
}

function tone(): Uint8Array {
  const rate = 22050;
  const seconds = 3;
  const count = rate * seconds;
  const out = new Uint8Array(44 + count * 2);
  const view = new DataView(out.buffer);
  const write = (at: number, text: string) => text.split("").forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  write(0, "RIFF");
  view.setUint32(4, 36 + count * 2, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, count * 2, true);
  for (let i = 0; i < count; i += 1) {
    const t = i / rate;
    const gate = Math.max(0, Math.sin(t * Math.PI * 1.3)) ** 0.6;
    const v = (Math.sin(2 * Math.PI * 220 * t) * 0.5 + Math.sin(2 * Math.PI * 330 * t) * 0.25 + Math.sin(2 * Math.PI * 440 * t * (1 + 0.02 * Math.sin(t * 5))) * 0.15) * gate;
    view.setInt16(44 + i * 2, Math.round(v * 22000), true);
  }
  return out;
}

const NOTES = `# Release notes

FormPortal 0.62.0 adds this browser demo.

## What you can do

- Open the Apps list and install an app: the catalogue signature, the package SHA-256 and every entry's CRC-32 are checked before anything is recorded.
- Update, then roll back to the version it replaced.
- Drop your own files on the window to see which Form app opens them.

Edit this text in the inspector and keep a new version.
`;

export async function loadSamples(): Promise<void> {
  const made = await signedCatalogue();
  await fontsReady;
  const font = fontBytes("fonts/space-grotesk/SpaceGrotesk-Variable.ttf");
  await put(SAMPLES, "launch-poster.png", await poster(), "image/png", "first seen");
  await put(SAMPLES, "interview-tone.wav", tone(), "audio/wav", "first seen");
  await put(SAMPLES, "release-notes.md", encoder.encode(NOTES), "text/markdown", "first seen");
  await put(SAMPLES, "demo-catalogue.json", encoder.encode(made.body), "application/json", "first seen");
  await put(SAMPLES, "demo-catalogue.json.sig", encoder.encode(made.signature), "text/plain", "first seen");
  await put(SAMPLES, "formcut-2.6.2-demo.zip", packageBytes("formcut", "2.6.2", "formcut-2.6.2-demo.zip"), "application/zip", "first seen");
  if (font) await put(SAMPLES, "sample-font.ttf", font, "font/ttf", "first seen");
}
