"use client";

/**
 * Chat com o Orquestrador. O backend roda o Claude Code em segundo plano; aqui só
 * enviamos a mensagem e buscamos as novas (`GET /api/v1/brandforge/chat?after=<id>`).
 */

import { create } from "zustand";
import { apiFetch } from "@/utils/api";

export interface ChatMessage {
  id: number;
  role: "usuario" | "orquestrador" | "sistema" | string;
  text: string;
  timestamp: string;
}

interface ChatResponse {
  busy: boolean;
  sessionId: string | null;
  messages: ChatMessage[];
}

const CHAT_PATH = "/api/v1/brandforge/chat";
const BUBBLE_MAX = 80;

/** Texto curto para o balão sobre o Orquestrador: a primeira frase, sem markdown. */
export function bubbleTextFor(text: string): string {
  const plain = text
    .replace(/[*_`#>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const firstSentence = /^(.+?[.!?])(\s|$)/.exec(plain)?.[1] ?? plain;
  if (firstSentence.length <= BUBBLE_MAX) return firstSentence;
  return firstSentence.slice(0, BUBBLE_MAX - 3).trimEnd() + "...";
}

interface ChatState {
  messages: ChatMessage[];
  busy: boolean;
  offline: boolean;
  error: string | null;

  fetchNew: () => Promise<void>;
  send: (text: string) => Promise<boolean>;
  newConversation: () => Promise<void>;
  reset: () => void;
}

const lastId = (messages: ChatMessage[]): number =>
  messages.length > 0 ? messages[messages.length - 1].id : 0;

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  busy: false,
  offline: false,
  error: null,

  fetchNew: async () => {
    try {
      const resp = await apiFetch(
        `${CHAT_PATH}?after=${lastId(get().messages)}`,
      );
      if (!resp.ok) {
        set({ offline: true });
        return;
      }
      const body = (await resp.json()) as ChatResponse;
      set((state) => {
        const known = new Set(state.messages.map((m) => m.id));
        const fresh = body.messages.filter((m) => !known.has(m.id));
        return {
          messages:
            fresh.length > 0 ? [...state.messages, ...fresh] : state.messages,
          busy: body.busy,
          offline: false,
        };
      });
    } catch {
      set({ offline: true });
    }
  },

  send: async (text) => {
    const trimmed = text.trim();
    if (!trimmed) return false;
    try {
      const resp = await apiFetch(CHAT_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      if (resp.status === 401) {
        set({
          error:
            "O chat precisa do token da sessão. Abra o escritório com .\\iniciar-escritorio.ps1 (ele abre o link certo).",
        });
        return false;
      }
      if (resp.status === 409) {
        set({
          error: "O Orquestrador ainda está trabalhando na mensagem anterior.",
        });
        return false;
      }
      if (!resp.ok) {
        set({ error: `Não consegui enviar a mensagem (erro ${resp.status}).` });
        return false;
      }
      const body = (await resp.json()) as { message: ChatMessage };
      set((state) => ({
        messages: state.messages.some((m) => m.id === body.message.id)
          ? state.messages
          : [...state.messages, body.message],
        busy: true,
        error: null,
        offline: false,
      }));
      return true;
    } catch {
      set({ offline: true, error: "Backend do escritório fora do ar." });
      return false;
    }
  },

  newConversation: async () => {
    try {
      const resp = await apiFetch(CHAT_PATH, { method: "DELETE" });
      if (resp.status === 401) {
        set({
          error:
            "O chat precisa do token da sessão. Abra o escritório com .\\iniciar-escritorio.ps1.",
        });
        return;
      }
      if (resp.ok) set({ messages: [], busy: false, error: null });
    } catch {
      set({ offline: true });
    }
  },

  reset: () => set({ messages: [], busy: false, offline: false, error: null }),
}));
