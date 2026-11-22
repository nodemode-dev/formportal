export interface WheelOptions {
  centred: boolean;
  snap: boolean;
  lead?: () => number;
  onMove?: () => void;
  onRest?: () => void;
}

const EASE = 0.2;
const THROW = 220;
const DRAG = 5;

export class Wheel {
  private items: HTMLElement[] = [];
  private offset = 0;
  private target = 0;
  private pitch = 0;
  private gap = 0;
  private span = 0;
  private view = 0;
  private wraps = false;
  private frame = 0;
  private last = 0;
  private idle = 0;
  private moving = false;
  private placed = new Map<HTMLElement, string>();
  private seen = false;

  constructor(
    private readonly box: HTMLElement,
    private readonly all: HTMLElement[],
    private readonly opts: WheelOptions,
  ) {
    box.addEventListener("wheel", (event) => this.wheel(event), { passive: false });
    box.addEventListener("pointerdown", (event) => this.grab(event));
    box.addEventListener("focusin", (event) => this.reveal(event.target as HTMLElement));
    box.addEventListener("dragstart", (event) => event.preventDefault());
  }

  private on = true;

  enable(on: boolean): void {
    if (this.on === on) return;
    this.on = on;
    if (on) return;
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.moving = false;
    this.held = false;
    this.pitch = 0;
    this.placed.clear();
    for (const el of this.all) el.removeAttribute("tabindex");
  }

  get busy(): boolean {
    return this.moving;
  }

  measure(): void {
    if (!this.on) return;
    this.items = this.all.filter((el) => el.offsetParent !== null);
    const first = this.items[0];
    this.gap = Number.parseFloat(getComputedStyle(this.box).rowGap) || 0;
    this.pitch = first ? first.offsetHeight + this.gap : 0;
    this.span = this.items.length * this.pitch;
    this.view = this.box.clientHeight;
    const wraps = this.pitch > 0 && (this.opts.centred ? this.items.length > 2 : this.span >= this.view + this.pitch);
    if (wraps && !this.seen && !this.opts.centred) {
      const lead = this.opts.lead?.() ?? 0;
      this.offset = this.target = -Math.min(lead, this.pitch);
    }
    this.seen = this.seen || wraps;
    this.wraps = wraps;
    if (!wraps) this.target = this.offset = this.clamp(this.offset);
    this.paint();
  }

  home(): void {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.moving = false;
    this.offset = this.target = 0;
    this.placed.clear();
    if (this.on) this.paint();
  }

  private clamp(at: number): number {
    if (this.wraps) return at;
    return Math.max(0, Math.min(at, Math.max(0, this.span - this.gap - this.view)));
  }

  private place(k: number): number {
    let p = k * this.pitch - this.offset;
    if (this.wraps) {
      const lead = this.opts.centred ? Math.floor(this.items.length / 2) * this.pitch : this.pitch;
      p = ((((p + lead) % this.span) + this.span) % this.span) - lead;
    }
    return p;
  }

  private paint(): void {
    this.items.forEach((el, k) => {
      const p = this.place(k);
      const y = this.opts.centred ? p : p - k * this.pitch;
      const at = `${Math.round(y * 100) / 100}px`;
      if (this.placed.get(el) !== at) {
        this.placed.set(el, at);
        el.style.setProperty("--wy", at);
        if (this.opts.centred) {
          const far = this.pitch ? Math.min(1.5, Math.abs(p) / this.pitch) : 0;
          el.style.setProperty("--wo", String(Math.round(Math.max(0, 1 - far * 0.65) * 1000) / 1000));
          el.tabIndex = Math.abs(p) < this.pitch / 2 ? 0 : -1;
        }
      }
    });
    if (this.opts.centred) return;
    const above = this.wraps || this.offset > 1;
    const below = this.wraps || this.offset < this.span - this.gap - this.view - 1;
    const say = above && below ? "both" : above ? "above" : below ? "below" : "";
    if ((this.box.dataset.more ?? "") !== say) {
      if (say) this.box.dataset.more = say;
      else delete this.box.dataset.more;
    }
  }

  private run(): void {
    if (!this.moving) {
      this.moving = true;
      this.opts.onMove?.();
    }
    if (this.frame) return;
    this.last = performance.now();
    const tick = (now: number) => {
      const step = 1 - Math.pow(1 - EASE, Math.min(4, (now - this.last) / 16.67));
      this.last = now;
      const left = this.target - this.offset;
      this.offset = Math.abs(left) < 0.25 ? this.target : this.offset + left * step;
      this.paint();
      if (this.offset === this.target && !this.held) {
        this.frame = 0;
        this.moving = false;
        this.opts.onRest?.();
        return;
      }
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  private held = false;

  private snapTo(at: number): number {
    return this.opts.snap && this.pitch ? Math.round(at / this.pitch) * this.pitch : at;
  }

  private wheel(event: WheelEvent): void {
    if (!this.pitch || (!this.wraps && this.span - this.gap <= this.view)) return;
    event.preventDefault();
    const unit = event.deltaMode === 1 ? this.pitch : event.deltaMode === 2 ? this.view : 1;
    const delta = event.deltaY * unit;
    if (this.opts.snap && Math.abs(delta) >= 40) this.target = this.snapTo(this.target) + Math.sign(delta) * this.pitch;
    else this.target = this.clamp(this.target + delta);
    window.clearTimeout(this.idle);
    if (this.opts.snap) this.idle = window.setTimeout(() => ((this.target = this.snapTo(this.target)), this.run()), 140);
    this.run();
  }

  private grab(event: PointerEvent): void {
    if (event.button !== 0 || !this.pitch || (!this.wraps && this.span - this.gap <= this.view)) return;
    const y0 = event.clientY;
    const from = this.target;
    const trail: [number, number][] = [[event.timeStamp, y0]];
    let dragging = false;
    const move = (ev: PointerEvent) => {
      const dy = ev.clientY - y0;
      if (!dragging) {
        if (Math.abs(dy) < DRAG) return;
        dragging = true;
        this.held = true;
        this.box.setPointerCapture(ev.pointerId);
        this.box.setAttribute("data-dragging", "");
      }
      trail.push([ev.timeStamp, ev.clientY]);
      if (trail.length > 6) trail.shift();
      this.target = this.offset = this.clamp(from - dy);
      this.paint();
      this.run();
    };
    const up = (ev: PointerEvent) => {
      this.box.removeEventListener("pointermove", move);
      this.box.removeEventListener("pointerup", up);
      this.box.removeEventListener("pointercancel", up);
      if (!dragging) return;
      this.held = false;
      this.box.removeAttribute("data-dragging");
      const swallow = (click: Event) => {
        click.preventDefault();
        click.stopPropagation();
      };
      this.box.addEventListener("click", swallow, { capture: true, once: true });
      window.setTimeout(() => this.box.removeEventListener("click", swallow, { capture: true }), 0);
      const [t0, ya] = trail[0];
      const dt = Math.max(1, ev.timeStamp - t0);
      const speed = ev.timeStamp - trail[trail.length - 1][0] > 90 ? 0 : (ev.clientY - ya) / dt;
      this.target = this.clamp(this.snapTo(this.target - speed * THROW));
      this.run();
    };
    this.box.addEventListener("pointermove", move);
    this.box.addEventListener("pointerup", up);
    this.box.addEventListener("pointercancel", up);
  }

  private reveal(el: HTMLElement): void {
    const k = this.items.findIndex((item) => item.contains(el));
    if (k < 0 || !this.pitch) return;
    const p = this.place(k);
    if (this.opts.centred) {
      if (Math.abs(p) < 1) return;
      this.target = this.offset + p;
    } else {
      if (p >= 0 && p + this.pitch - this.gap <= this.view) return;
      this.target = this.clamp(this.offset + p - (this.view - this.pitch) / 2);
    }
    this.run();
  }
}
