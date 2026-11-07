const KEY = "formportal.library.v1";

export interface Kept {
  fonts: { id: string; style: string; sha256: string }[];
  saved: string[];
  learn: Record<string, number[]>;
  apps: boolean;
}

const fresh = (): Kept => ({
  fonts: [
    { id: "fraunces", style: "Variable", sha256: "" },
    { id: "fraunces", style: "Variable Italic", sha256: "" },
    { id: "space-grotesk", style: "Variable", sha256: "" },
    { id: "lora", style: "Variable", sha256: "" },
    { id: "inter", style: "Variable", sha256: "earlier" },
  ],
  saved: ["photo-trajans-market-rome", "photo-snowy-alpine-valley", "formencoder-look-teal-and-orange"],
  learn: { "portal-fonts-stock": [1, 3] },
  apps: false,
});

let held: Kept | null = null;

export function kept(): Kept {
  if (held) return held;
  try {
    const raw = localStorage.getItem(KEY);
    held = raw ? (JSON.parse(raw) as Kept) : fresh();
  } catch {
    held = fresh();
  }
  return held;
}

export function remember(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(kept()));
  } catch {
    return;
  }
}

export function forgetLibrary(): void {
  held = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    return;
  }
}
