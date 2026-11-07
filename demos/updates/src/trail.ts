import { pause } from "../../../demo/src/util.ts";

export type Tone = "wait" | "hold" | "run" | "ok" | "no" | "skip";

export interface Step {
  id: string;
  label: string;
  tone: Tone;
  short: string;
  full: string;
}

export interface Run {
  id: number;
  kind: string;
  title: string;
  sub: string;
  steps: Step[];
  outcome: "run" | "ok" | "refused";
  at: number;
  say: string;
}

export const settings = { pausing: false, dwell: 230 };

const runs: Run[] = [];
const listeners = new Set<(run: Run, fresh: boolean) => void>();
let counter = 0;
let release: (() => void) | null = null;

export const history = () => runs;

export function onTrail(fn: (run: Run, fresh: boolean) => void): void {
  listeners.add(fn);
}

function emit(run: Run, fresh = false): void {
  for (const fn of listeners) fn(run, fresh);
}

export function begin(kind: string, title: string, sub: string, steps: [string, string][]): Run {
  counter += 1;
  const run: Run = { id: counter, kind, title, sub, steps: steps.map(([id, label]) => ({ id, label, tone: "wait", short: "", full: "" })), outcome: "run", at: Date.now(), say: "" };
  runs.unshift(run);
  if (runs.length > 14) runs.pop();
  emit(run, true);
  return run;
}

export function stepOf(run: Run, id: string): Step {
  const step = run.steps.find((s) => s.id === id);
  if (!step) throw new Error(`no step ${id}`);
  return step;
}

export function waiting(): boolean {
  return release !== null;
}

export function next(): void {
  const fn = release;
  release = null;
  fn?.();
}

export interface Done {
  short: string;
  full?: string;
  tone?: Tone;
}

export async function stage<T>(run: Run, id: string, work: () => Promise<Done & { value: T }> | (Done & { value: T })): Promise<T> {
  const step = stepOf(run, id);
  if (settings.pausing) {
    step.tone = "hold";
    run.say = `Next check: ${step.label}`;
    const gate = new Promise<void>((go) => {
      release = go;
    });
    emit(run);
    await gate;
  }
  step.tone = "run";
  run.say = step.label;
  emit(run);
  await pause(settings.dwell);
  try {
    const done = await work();
    step.tone = done.tone ?? "ok";
    step.short = done.short;
    step.full = done.full ?? done.short;
    run.say = done.short;
    emit(run);
    return done.value;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    step.tone = "no";
    step.short = message;
    step.full = message;
    for (const rest of run.steps) if (rest.tone === "wait" || rest.tone === "hold") rest.tone = "skip";
    run.outcome = "refused";
    run.say = message;
    emit(run);
    throw e;
  }
}

export function finish(run: Run, say: string): void {
  if (run.outcome === "run") run.outcome = "ok";
  if (run.outcome === "ok") run.say = say;
  emit(run);
}

export function note(run: Run, id: string, short: string, full = short): void {
  const step = stepOf(run, id);
  step.short = short;
  step.full = full;
  emit(run);
}
