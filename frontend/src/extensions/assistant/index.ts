import type { Extension } from "../registry.ts";

export const assistant: Extension = {
  id: "assistant",
  setup(engine) {
    const dialog = document.querySelector<HTMLDialogElement>("[data-ask]");
    const openButton = document.querySelector<HTMLButtonElement>("[data-ask-open]");
    const agentsBox = document.querySelector<HTMLElement>("[data-ask-agents]");
    const none = document.querySelector<HTMLElement>("[data-ask-none]");
    const input = document.querySelector<HTMLTextAreaElement>("[data-ask-input]");
    const send = document.querySelector<HTMLButtonElement>("[data-ask-send]");
    const state = document.querySelector<HTMLElement>("[data-ask-state]");
    const answer = document.querySelector<HTMLElement>("[data-ask-answer]");
    if (!dialog || !openButton || !agentsBox || !none || !input || !send || !state || !answer) return;
    let client = "";
    let busy = false;
    let loaded = false;

    const ready = () => {
      const on = Boolean(client) && !busy && input.value.trim().length > 0;
      if (send.disabled === on) send.disabled = !on;
    };
    const say = (text: string) => {
      if (state.textContent !== text) state.textContent = text;
    };

    engine.on("assistant", ({ agents }) => {
      loaded = true;
      const present = agents.filter((a) => a.path);
      agentsBox.replaceChildren(
        ...present.map((a, i) => {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "seg-item";
          b.textContent = a.label;
          b.dataset.client = a.client;
          b.setAttribute("aria-pressed", String(i === 0));
          b.addEventListener("click", () => {
            client = a.client;
            for (const o of agentsBox.querySelectorAll("button")) o.setAttribute("aria-pressed", String(o === b));
            ready();
          });
          return b;
        }),
      );
      client = present[0]?.client ?? "";
      agentsBox.hidden = present.length === 0;
      none.hidden = present.length > 0;
      input.disabled = present.length === 0;
      ready();
    });

    engine.on("answer", ({ pending, answer: text, error }) => {
      busy = pending;
      dialog.toggleAttribute("data-busy", pending);
      say(pending ? "Asking. An agent can take a minute." : "");
      if (!pending) {
        answer.textContent = text ?? (error ? `It could not answer: ${error}` : "");
        answer.toggleAttribute("data-fault", Boolean(error));
      }
      ready();
    });

    openButton.addEventListener("click", () => {
      if (!dialog.open) dialog.showModal();
      if (!loaded) void engine.dispatch("assistant.agents");
      input.focus();
    });
    document.querySelector("[data-ask-close]")?.addEventListener("click", () => dialog.close());
    input.addEventListener("input", ready);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && !send.disabled) send.click();
    });
    send.addEventListener("click", () => {
      const question = input.value.trim();
      if (!question || !client || busy) return;
      answer.textContent = "";
      void engine.dispatch("assistant.ask", { client, question });
    });
  },
};
