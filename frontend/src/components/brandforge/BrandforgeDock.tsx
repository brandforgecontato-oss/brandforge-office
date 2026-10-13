"use client";

/**
 * Doca do escritório BrandForge: botões no canto inferior esquerdo que abrem o chat com o
 * Orquestrador (e, nas próximas tarefas, o debate e o placar).
 */

import { useState, type ReactNode } from "react";
import ChatPanel, { useChatSync } from "./ChatPanel";

type View = "chat" | null;

export default function BrandforgeDock(): ReactNode {
  const [view, setView] = useState<View>(null);
  useChatSync();

  const toggle = (next: Exclude<View, null>): void =>
    setView((current) => (current === next ? null : next));

  const buttonClass = (active: boolean): string =>
    `px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
      active
        ? "bg-amber-500 text-black border-amber-400"
        : "bg-neutral-900/90 text-neutral-200 border-neutral-700 hover:bg-neutral-800"
    }`;

  return (
    <div className="fixed bottom-3 left-3 z-40 flex flex-col items-start gap-2">
      {view === "chat" && (
        <div className="w-[24rem] max-w-[calc(100vw-1.5rem)] h-[30rem] max-h-[70vh] rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl overflow-hidden">
          <ChatPanel />
        </div>
      )}
      <div className="flex gap-2">
        <button
          className={buttonClass(view === "chat")}
          onClick={() => toggle("chat")}
        >
          Chat
        </button>
      </div>
    </div>
  );
}
