"use client";

/**
 * Painel de chat com o Orquestrador. A resposta aparece aqui e também em balão sobre o
 * chefe do escritório (quando a sessão em exibição é a do escritório).
 */

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useChatStore, bubbleTextFor } from "@/stores/chatStore";
import { useBrandforgeStore } from "@/stores/brandforgeStore";
import { useGameStore } from "@/stores/gameStore";

const POLL_BUSY_MS = 1500;
const POLL_IDLE_MS = 4000;

/** Consulta o backend em intervalo e mostra cada fala nova do Orquestrador no balão do chefe. */
export function useChatSync(): void {
  const busy = useChatStore((s) => s.busy);
  const fetchNew = useChatStore((s) => s.fetchNew);
  const messages = useChatStore((s) => s.messages);
  const isOfficeSession = useBrandforgeStore((s) => s.isOfficeSession);
  const enqueueBubble = useGameStore((s) => s.enqueueBubble);
  // Balões só para falas que chegam depois da primeira carga (o histórico não "fala" de novo).
  const bubbledUpTo = useRef<number | null>(null);

  useEffect(() => {
    void fetchNew();
    const timer = setInterval(
      () => void fetchNew(),
      busy ? POLL_BUSY_MS : POLL_IDLE_MS,
    );
    return () => clearInterval(timer);
  }, [busy, fetchNew]);

  useEffect(() => {
    const lastId = messages.length > 0 ? messages[messages.length - 1].id : 0;
    if (bubbledUpTo.current === null) {
      if (lastId > 0 || !busy) bubbledUpTo.current = lastId;
      return;
    }
    const mark = bubbledUpTo.current;
    if (lastId <= mark) return;
    bubbledUpTo.current = lastId;
    if (!isOfficeSession) return;
    for (const m of messages) {
      if (m.id > mark && m.role === "orquestrador") {
        enqueueBubble("boss", { type: "speech", text: bubbleTextFor(m.text) });
      }
    }
  }, [messages, busy, isOfficeSession, enqueueBubble]);
}

export default function ChatPanel(): ReactNode {
  const messages = useChatStore((s) => s.messages);
  const busy = useChatStore((s) => s.busy);
  const offline = useChatStore((s) => s.offline);
  const error = useChatStore((s) => s.error);
  const send = useChatStore((s) => s.send);
  const newConversation = useChatStore((s) => s.newConversation);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, busy]);

  const submit = async (): Promise<void> => {
    const text = draft;
    if (!text.trim() || busy) return;
    setDraft("");
    const ok = await send(text);
    if (!ok) setDraft(text);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <div className="flex flex-col h-full" data-testid="chat-panel">
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800">
        <span className="text-sm font-bold text-amber-400">Orquestrador</span>
        <button
          onClick={() => void newConversation()}
          disabled={busy}
          className="text-[11px] text-neutral-500 hover:text-neutral-300 disabled:opacity-40"
        >
          Nova conversa
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 text-[13px]">
        {messages.length === 0 && (
          <p className="text-neutral-500 text-xs leading-relaxed">
            Converse com o Orquestrador: peça uma ideia de peça, um cronograma,
            ou avise que há um vídeo novo em entrada/. Depois dê o feedback
            (&quot;gostei&quot; ou &quot;refaça porque...&quot;).
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={
              m.role === "usuario"
                ? "ml-8 rounded-lg bg-blue-600/80 text-white px-3 py-2 whitespace-pre-wrap"
                : m.role === "sistema"
                  ? "rounded-lg border border-red-900 bg-red-950/40 text-red-200 px-3 py-2 text-xs whitespace-pre-wrap"
                  : "mr-8 rounded-lg bg-neutral-800 text-neutral-100 px-3 py-2 whitespace-pre-wrap"
            }
          >
            {m.text}
          </div>
        ))}
        {busy && (
          <div className="text-xs text-amber-400/80 animate-pulse">
            Orquestrador trabalhando...
          </div>
        )}
        <div ref={endRef} />
      </div>

      {(error || offline) && (
        <div className="px-3 py-1 text-[11px] text-red-300 bg-red-950/40">
          {error ?? "Backend do escritório fora do ar."}
        </div>
      )}

      <div className="border-t border-neutral-800 p-2 flex gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          rows={2}
          placeholder={
            busy
              ? "Aguarde o Orquestrador terminar..."
              : "Escreva para o Orquestrador"
          }
          className="flex-1 resize-none rounded-lg bg-neutral-800 text-neutral-100 text-sm px-2 py-1 outline-none focus:ring-1 focus:ring-amber-500 placeholder:text-neutral-500"
        />
        <button
          onClick={() => void submit()}
          disabled={busy || !draft.trim()}
          className="self-end bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black text-xs font-bold px-3 py-2 rounded-lg"
        >
          Enviar
        </button>
      </div>
    </div>
  );
}
