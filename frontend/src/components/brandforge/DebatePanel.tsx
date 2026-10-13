"use client";

/**
 * Debate em balões de fala: as objeções do Crítico e as respostas do Orquestrador,
 * rodada por rodada. Os balões também aparecem sobre os personagens quando eles estão no
 * escritório (o Crítico só aparece enquanto o Orquestrador o está chamando).
 */

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import {
  buildTimeline,
  newBubbleTexts,
  useDebateStore,
  type TimelineItem,
} from "@/stores/debateStore";
import { useChatStore, bubbleTextFor } from "@/stores/chatStore";
import { useBrandforgeStore } from "@/stores/brandforgeStore";
import { useGameStore } from "@/stores/gameStore";

const POLL_BUSY_MS = 2000;
const POLL_IDLE_MS = 5000;
const MAX_NEW_BUBBLES = 3;

/** Consulta o debate em intervalo e mostra as falas novas sobre os personagens. */
export function useDebateSync(): void {
  const debate = useDebateStore((s) => s.debate);
  const fetchDebate = useDebateStore((s) => s.fetchDebate);
  const selectedPiece = useDebateStore((s) => s.selectedPiece);
  const chatBusy = useChatStore((s) => s.busy);
  const isOfficeSession = useBrandforgeStore((s) => s.isOfficeSession);
  const enqueueBubble = useGameStore((s) => s.enqueueBubble);
  const previous = useRef<{ piece: string; items: TimelineItem[] } | null>(
    null,
  );

  useEffect(() => {
    void fetchDebate();
    const timer = setInterval(
      () => void fetchDebate(),
      chatBusy ? POLL_BUSY_MS : POLL_IDLE_MS,
    );
    return () => clearInterval(timer);
  }, [chatBusy, fetchDebate, selectedPiece]);

  useEffect(() => {
    const items = buildTimeline(debate);
    const before = previous.current;
    previous.current = debate ? { piece: debate.piece, items } : null;
    // Primeira carga ou troca de peça: não "refala" o que já aconteceu.
    if (!debate || !before || before.piece !== debate.piece) return;
    if (!isOfficeSession) return;

    const fresh = newBubbleTexts(before.items, items).slice(-MAX_NEW_BUBBLES);
    const state = useGameStore.getState();
    const criticId = [...state.agents.values()].find(
      (a) => a.agentType === "critico",
    )?.id;
    for (const bubble of fresh) {
      const text = bubbleTextFor(bubble.text);
      if (bubble.speaker === "orquestrador") {
        enqueueBubble("boss", { type: "speech", text });
      } else if (criticId) {
        enqueueBubble(criticId, { type: "speech", text });
      }
    }
  }, [debate, isOfficeSession, enqueueBubble]);
}

const GRAVITY_STYLE: Record<string, string> = {
  fatal: "bg-red-600 text-white",
  séria: "bg-orange-500 text-black",
  menor: "bg-slate-500 text-white",
};

const ACTION_STYLE: Record<string, string> = {
  ACEITAR: "bg-green-600 text-white",
  REBATER: "bg-blue-600 text-white",
  "ASSUMIR RISCO": "bg-orange-500 text-black",
};

const VERDICT_STYLE: Record<string, string> = {
  APROVADA: "border-green-500 bg-green-950/50 text-green-200",
  "APROVADA COM RESSALVAS": "border-amber-500 bg-amber-950/50 text-amber-200",
  REPROVADA: "border-red-500 bg-red-950/50 text-red-200",
};

function Balloon({ item }: { item: TimelineItem }): ReactNode {
  if (item.kind === "attempt") {
    return (
      <div className="pt-2 text-center text-[11px] font-bold uppercase tracking-wider text-neutral-300">
        {item.text}
        {item.notes?.[0] && (
          <span className="ml-2 font-normal text-neutral-500">
            {item.notes[0]}
          </span>
        )}
      </div>
    );
  }
  if (item.kind === "round") {
    return (
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-neutral-500">
        <div className="h-px flex-1 bg-neutral-800" />
        {item.text}
        <div className="h-px flex-1 bg-neutral-800" />
      </div>
    );
  }
  if (item.kind === "status") {
    return (
      <ul className="rounded-lg bg-neutral-800/60 px-3 py-2 text-[11px] text-neutral-400 space-y-0.5">
        <li className="font-bold text-neutral-300">{item.text}</li>
        {item.notes?.map((note) => (
          <li key={note} className="line-clamp-2">
            {note}
          </li>
        ))}
      </ul>
    );
  }
  if (item.kind === "verdict") {
    const style =
      VERDICT_STYLE[item.text] ?? "border-neutral-600 text-neutral-200";
    return (
      <div className={`rounded-lg border px-3 py-2 text-xs ${style}`}>
        <div className="font-bold">Veredito: {item.text}</div>
        {item.notes && item.notes.length > 0 && (
          <ul className="mt-1 list-disc pl-4 space-y-0.5 text-[11px]">
            {item.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const isCritic = item.kind === "critic";
  return (
    <div className={`flex ${isCritic ? "justify-start" : "justify-end"}`}>
      <div
        className={`relative max-w-[88%] rounded-2xl px-3 py-2 text-[13px] ${
          isCritic
            ? "rounded-tl-sm bg-red-950/60 border border-red-900 text-red-50"
            : "rounded-tr-sm bg-amber-950/60 border border-amber-900 text-amber-50"
        }`}
        data-testid={isCritic ? "balloon-critic" : "balloon-orquestrador"}
      >
        <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[10px]">
          <span className="font-bold uppercase tracking-wide opacity-80">
            {isCritic ? "Crítico" : "Orquestrador"}
          </span>
          {item.label && <span className="opacity-60">{item.label}</span>}
          {isCritic && item.gravity && (
            <span
              className={`rounded px-1.5 py-px font-bold ${GRAVITY_STYLE[item.gravity] ?? "bg-slate-500 text-white"}`}
            >
              {item.gravity}
            </span>
          )}
          {!isCritic && item.action && (
            <span
              className={`rounded px-1.5 py-px font-bold ${ACTION_STYLE[item.action] ?? "bg-slate-500 text-white"}`}
            >
              {item.action}
            </span>
          )}
        </div>
        {isCritic && item.criterion && (
          <div className="mb-1 text-[10px] italic opacity-60">
            {item.criterion}
          </div>
        )}
        <p className="whitespace-pre-wrap leading-snug">{item.text}</p>
        {isCritic && (item.reason || item.fix) && (
          <details className="mt-1 text-[11px] opacity-80">
            <summary className="cursor-pointer">
              Motivo e o que resolveria
            </summary>
            {item.reason && <p className="mt-1">Motivo: {item.reason}</p>}
            {item.fix && <p className="mt-1">Resolveria: {item.fix}</p>}
          </details>
        )}
      </div>
    </div>
  );
}

export default function DebatePanel(): ReactNode {
  const debate = useDebateStore((s) => s.debate);
  const available = useDebateStore((s) => s.available);
  const selectedPiece = useDebateStore((s) => s.selectedPiece);
  const selectPiece = useDebateStore((s) => s.selectPiece);
  const timeline = useMemo(() => buildTimeline(debate), [debate]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [timeline.length]);

  return (
    <div className="flex flex-col h-full" data-testid="debate-panel">
      <div className="px-3 py-2 border-b border-neutral-800 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold text-red-300">Debate</span>
          {debate && (
            <span className="text-[11px] text-neutral-400">
              {debate.state}
              {debate.currentRound > 0 && ` · rodada ${debate.currentRound}/3`}
            </span>
          )}
        </div>
        {available.length > 1 && (
          <select
            value={selectedPiece ?? ""}
            onChange={(e) => selectPiece(e.target.value || null)}
            className="w-full rounded bg-neutral-800 text-[11px] text-neutral-200 px-1 py-0.5"
          >
            <option value="">Mais recente</option>
            {available.map((d) => (
              <option key={d.piece} value={d.piece}>
                {d.piece} — {d.state}
              </option>
            ))}
          </select>
        )}
        {debate && (
          <div className="truncate text-[11px] text-neutral-500">
            {debate.title}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {timeline.length === 0 ? (
          <p className="text-neutral-500 text-xs leading-relaxed">
            Nenhum debate ainda. Quando o Orquestrador propuser uma peça, as
            objeções do Crítico e as respostas dele aparecem aqui, rodada por
            rodada.
          </p>
        ) : (
          timeline.map((item) => <Balloon key={item.key} item={item} />)
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}
