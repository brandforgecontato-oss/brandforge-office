"use client";

/**
 * Placar de aprovação das peças. O backend lê os status da pasta `saida/` do escritório
 * (`GET /api/v1/brandforge/placar`); aqui agrupamos por status para o quadro Kanban.
 */

import { create } from "zustand";
import { apiFetch } from "@/utils/api";

export interface PlacarPiece {
  id: string;
  tema: string;
  formato: string;
  status: string;
  motivo: string;
  origem: string;
  atualizadoEm: string;
}

export interface PlacarColumn {
  status: string;
  pieces: PlacarPiece[];
}

/** Ordem do fluxo (spec, seção 4); `travado` fica fora do caminho, por último. */
export const DEFAULT_STATUSES = [
  "pendente",
  "em produção",
  "entregue",
  "aprovado",
  "refazer",
  "travado",
];

export const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  DEFAULT_STATUSES.map((s) => [s, s.toUpperCase()]),
);

/** Cores de cada coluna (cabeçalho, em hexadecimal). */
export const STATUS_COLORS: Record<string, string> = {
  pendente: "#64748b",
  "em produção": "#3b82f6",
  entregue: "#a855f7",
  aprovado: "#22c55e",
  refazer: "#f59e0b",
  travado: "#ef4444",
};

/** Agrupa as peças nas colunas do placar; status desconhecido cai em `pendente`. */
export function groupByStatus(
  pieces: PlacarPiece[],
  statuses: string[] | null,
): PlacarColumn[] {
  const order = statuses && statuses.length > 0 ? statuses : DEFAULT_STATUSES;
  const columns: PlacarColumn[] = order.map((status) => ({
    status,
    pieces: [],
  }));
  for (const piece of pieces) {
    const column = columns.find((c) => c.status === piece.status) ?? columns[0];
    column.pieces.push(piece);
  }
  return columns;
}

interface PlacarResponse {
  statuses: string[];
  counts: Record<string, number>;
  pieces: PlacarPiece[];
  locked: string[];
}

interface PlacarState {
  statuses: string[] | null;
  pieces: PlacarPiece[];
  counts: Record<string, number>;
  locked: string[];
  loaded: boolean;

  fetchPlacar: () => Promise<void>;
  reset: () => void;
}

export const usePlacarStore = create<PlacarState>((set) => ({
  statuses: null,
  pieces: [],
  counts: {},
  locked: [],
  loaded: false,

  fetchPlacar: async () => {
    try {
      const resp = await apiFetch("/api/v1/brandforge/placar");
      if (!resp.ok) return;
      const body = (await resp.json()) as PlacarResponse;
      set({
        statuses: body.statuses,
        pieces: body.pieces,
        counts: body.counts,
        locked: body.locked,
        loaded: true,
      });
    } catch {
      // Backend fora do ar: mantém o último placar.
    }
  },

  reset: () =>
    set({ statuses: null, pieces: [], counts: {}, locked: [], loaded: false }),
}));
