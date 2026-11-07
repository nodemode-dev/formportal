import type { Bridge } from "../../../frontend/src/bridge/index.ts";
import { demoBridge } from "./bridge.ts";

export function pickBridge(): Bridge {
  return demoBridge;
}
