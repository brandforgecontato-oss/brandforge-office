"use client";

/**
 * Debate Orquestrador × Crítico. O backend lê o `debate.md` da peça
 * (`GET /api/v1/brandforge/debate`); aqui o transformamos numa linha do tempo de balões de
 * fala, rodada por rodada.
 */

import { create } from "zustand";
import { apiFetch } from "@/utils/api";

export interface Objection {
  id: string;
  gravity: string;
  criterion: string;
  text: string;
  reason: string;
  fix: string;
}

export interface Answer {
  ids: string[];
  action: string;
  text: string;
}

export interface ObjectionStatus {
  id: string;
  status: string;
  note: string;
}

export interface DebateRound {
  round: number;
  objections: Objection[];
  answers: Answer[];
  statuses: ObjectionStatus[];
}

export interface DebateAttempt {
  number: number;
  proposals: { version: number; title: string }[];
  rounds: DebateRound[];
  verdict: string | null;
  verdictNotes: string[];
}

export interface Debate {
  piece: string;
  title: string;
  kind: string;
  attempts: DebateAttempt[];
  verdict: string | null;
  state: string;
  currentRound: number;
  updatedAt: string | null;
}

export interface DebateSummary {
  piece: string;
  title: string;
  state: string;
  updatedAt: string | null;
}

// ----------------------------------------------------------------------------
// Linha do tempo
// ----------------------------------------------------------------------------

export type TimelineKind =
  "attempt" | "round" | "critic" | "orquestrador" | "status" | "verdict";

export interface TimelineItem {
  key: string;
  kind: TimelineKind;
  /** Texto principal do balão (ou título, nos separadores). */
  text: string;
  /** Id da objeção (R1.1) ou das objeções respondidas. */
  label?: string;
  gravity?: string;
  criterion?: string;
  action?: string;
  reason?: string;
  fix?: string;
  notes?: string[];
}

/** Transforma o debate em balões, rodada por rodada: Crítico, status, Orquestrador. */
export function buildTimeline(debate: Debate | null): TimelineItem[] {
  if (!debate) return [];
  const items: TimelineItem[] = [];
  for (const attempt of debate.attempts) {
    const a = attempt.number;
    const proposal = attempt.proposals.at(-1);
    items.push({
      key: `${a}-attempt`,
      kind: "attempt",
      text: `Tentativa ${a}`,
      notes: proposal ? [`Proposta v${proposal.version}`] : undefined,
    });
    for (const round of attempt.rounds) {
      const r = round.round;
      items.push({
        key: `${a}-${r}-round`,
        kind: "round",
        text: `Rodada ${r}`,
      });
      if (round.statuses.length > 0) {
        items.push({
          key: `${a}-${r}-status`,
          kind: "status",
          text: "Objeções anteriores",
          notes: round.statuses.map(
            (s) => `${s.id}: ${s.status}${s.note ? ` — ${s.note}` : ""}`,
          ),
        });
      }
      for (const o of round.objections) {
        items.push({
          key: `${a}-${r}-obj-${o.id}`,
          kind: "critic",
          label: o.id,
          gravity: o.gravity,
          criterion: o.criterion,
          text: o.text,
          reason: o.reason,
          fix: o.fix,
        });
      }
      round.answers.forEach((answer, i) => {
        items.push({
          key: `${a}-${r}-ans-${i}-${answer.ids.join("+")}`,
          kind: "orquestrador",
          label: answer.ids.join(" + "),
          action: answer.action,
          text: answer.text,
        });
      });
    }
    if (attempt.verdict) {
      items.push({
        key: `${a}-verdict`,
        kind: "verdict",
        text: attempt.verdict,
        notes: attempt.verdictNotes,
      });
    }
  }
  return items;
}

export interface NewBubble {
  speaker: "critico" | "orquestrador";
  text: string;
}

/** Balões que aparecem em `depois` e não existiam em `antes` (para o balão sobre o personagem). */
export function newBubbleTexts(
  antes: TimelineItem[],
  depois: TimelineItem[],
): NewBubble[] {
  const known = new Set(antes.map((i) => i.key));
  const out: NewBubble[] = [];
  for (const item of depois) {
    if (known.has(item.key)) continue;
    if (item.kind === "critic") {
      out.push({
        speaker: "critico",
        text: `${item.label} [${item.gravity}] ${item.text}`,
      });
    } else if (item.kind === "orquestrador") {
      out.push({
        speaker: "orquestrador",
        text: `${item.label} — ${item.action}: ${item.text}`,
      });
    }
  }
  return out;
}

// ----------------------------------------------------------------------------
// Store
// ----------------------------------------------------------------------------

const DEBATE_PATH = "/api/v1/brandforge/debate";

interface DebateResponse {
  debate: Debate | null;
  available: DebateSummary[];
}

interface DebateState {
  debate: Debate | null;
  available: DebateSummary[];
  /** null = o debate mais recente. */
  selectedPiece: string | null;

  fetchDebate: () => Promise<void>;
  selectPiece: (piece: string | null) => void;
  reset: () => void;
}

export const useDebateStore = create<DebateState>((set, get) => ({
  debate: null,
  available: [],
  selectedPiece: null,

  fetchDebate: async () => {
    const piece = get().selectedPiece;
    const path = piece
      ? `${DEBATE_PATH}?piece=${encodeURIComponent(piece)}`
      : DEBATE_PATH;
    try {
      const resp = await apiFetch(path);
      if (!resp.ok) return;
      const body = (await resp.json()) as DebateResponse;
      set({ debate: body.debate, available: body.available });
    } catch {
      // Backend fora do ar: mantém o último debate carregado.
    }
  },

  selectPiece: (piece) => set({ selectedPiece: piece }),

  reset: () => set({ debate: null, available: [], selectedPiece: null }),
}));
