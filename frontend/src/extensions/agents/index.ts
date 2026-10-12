import type { AgentClient } from "../../engine/types.ts";
import type { Extension } from "../registry.ts";

const WORDS: Record<AgentClient["state"], string> = {
  connected: "Connected",
  "not-connected": "Not connected",
  taken: "Another server with this name is set up; left alone",
  "no-client": "Not installed on this computer",
};

export const agents: Extension = {
  id: "agents",
  setup(engine) {
    const sections = new Map(Array.from(document.querySelectorAll<HTMLElement>("[data-agents]")).map((s) => [s.dataset.agents ?? "", s]));

    const current = () => (engine.state.route.startsWith("app-") ? engine.state.route.slice(4) : "");
    const check = (product: string) => {
      if (sections.has(product)) void engine.dispatch("agents.check", product);
    };

    engine.on("route", () => check(current()));
    engine.on("install", ({ key }) => {
      const product = current();
      if (product && key === engine.key(product, "stable")) check(product);
    });

    engine.on("agents", ({ product, view }) => {
      const section = sections.get(product);
      if (!section) return;
      if (section.hidden === view.surface) section.hidden = !view.surface;
      let connected = 0;
      let open = 0;
      for (const client of view.clients) {
        const row = section.querySelector<HTMLElement>(`[data-client='${client.client}']`);
        if (!row) continue;
        if (row.dataset.state !== client.state) row.dataset.state = client.state;
        const text = row.querySelector<HTMLElement>("[data-agent-state]");
        const words = WORDS[client.state];
        if (text && text.textContent !== words) text.textContent = words;
        if (client.state === "connected") connected += 1;
        if (client.state === "not-connected") open += 1;
      }
      const connect = section.querySelector<HTMLButtonElement>("[data-agents-connect]");
      const disconnect = section.querySelector<HTMLButtonElement>("[data-agents-disconnect]");
      if (connect && connect.disabled !== (open === 0)) connect.disabled = open === 0;
      if (disconnect && disconnect.disabled !== (connected === 0)) disconnect.disabled = connected === 0;
      section.toggleAttribute("data-busy", false);
    });

    for (const [product, section] of sections) {
      const run = (disconnect: boolean) => {
        section.toggleAttribute("data-busy", true);
        void engine.dispatch("agents.connect", { product, disconnect });
      };
      section.querySelector("[data-agents-connect]")?.addEventListener("click", () => run(false));
      section.querySelector("[data-agents-disconnect]")?.addEventListener("click", () => run(true));
    }
  },
};
