"use client";

/**
 * Doca do escritório BrandForge: botões no canto inferior esquerdo que abrem o chat com o
 * Orquestrador e o debate com o Crítico (o placar entra na próxima tarefa).
 */

import { useState, useSyncExternalStore, type ReactNode } from "react";
import ChatPanel, { useChatSync } from "./ChatPanel";
import DebatePanel, { useDebateSync } from "./DebatePanel";

type View = "chat" | "debate" | null;

export default function BrandforgeDock(): ReactNode {
  // Link direto para um painel: /?painel=chat|debate. useSyncExternalStore evita erro de
  // hidratação (o servidor não conhece a URL).
  const linkedView = useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).get("painel"),
    () => null,
  );
  const [chosen, setChosen] = useState<View | undefined>(undefined);
  const view: View =
    chosen !== undefined
      ? chosen
      : linkedView === "chat" || linkedView === "debate"
        ? linkedView
        : null;
  useChatSync();
  useDebateSync();

  const toggle = (next: Exclude<View, null>): void =>
    setChosen(view === next ? null : next);

  const buttonClass = (active: boolean): string =>
    `px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
      active
        ? "bg-amber-500 text-black border-amber-400"
        : "bg-neutral-900/90 text-neutral-200 border-neutral-700 hover:bg-neutral-800"
    }`;

  return (
    <div className="fixed bottom-3 left-3 lg:left-[21rem] z-40 flex flex-col items-start gap-2">
      {view !== null && (
        <div className="w-[24rem] max-w-[calc(100vw-1.5rem)] h-[30rem] max-h-[70vh] rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl overflow-hidden">
          {view === "chat" ? <ChatPanel /> : <DebatePanel />}
        </div>
      )}
      <div className="flex gap-2">
        <button
          className={buttonClass(view === "chat")}
          onClick={() => toggle("chat")}
        >
          Chat
        </button>
        <button
          className={buttonClass(view === "debate")}
          onClick={() => toggle("debate")}
        >
          Debate
        </button>
      </div>
    </div>
  );
}
