import { libraryBridge } from "./bridge.ts";
import type { Bridge } from "../../../frontend/src/bridge/index.ts";

export function pickBridge(): Bridge {
  return libraryBridge;
}
