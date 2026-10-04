import type { Channel, ChannelView } from "../../engine/types.ts";
import type { Extension } from "../registry.ts";

const WORDS: Record<Channel, Record<ChannelView["availability"], string>> = {
  stable: {
    unreleased: "Not released yet",
    "no-release": "No release yet",
    available: "Available",
    "other-platform": "Not built for this computer yet",
  },
  beta: {
    unreleased: "No beta build",
    "no-release": "No beta build",
    available: "Beta available",
    "other-platform": "No beta for this computer yet",
  },
  nightly: {
    unreleased: "No nightly build",
    "no-release": "No nightly build",
    available: "Nightly available",
    "other-platform": "No nightly for this computer yet",
  },
};

export const apps: Extension = {
  id: "apps",
  setup(engine) {
    const rows = Array.from(document.querySelectorAll<HTMLElement>("[data-row]"));

    const patch = (row: HTMLElement) => {
      const id = row.dataset.product ?? "";
      const channel = (row.dataset.row ?? "stable") as Channel;
      const view = engine.view(id, channel);
      row.setAttribute("data-availability", view.availability);
      const status = row.querySelector<HTMLElement>("[data-field='status']");
      const version = row.querySelector<HTMLElement>("[data-field='version']");
      if (status) status.textContent = WORDS[channel][view.availability];
      if (version) version.textContent = view.version ?? "";
    };

    engine.on("product", ({ id }) => {
      for (const row of rows) if (row.dataset.product === id) patch(row);
    });
  },
};
