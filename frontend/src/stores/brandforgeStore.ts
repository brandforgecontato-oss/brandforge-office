"use client";

/**
 * Estado do escritório BrandForge: elenco fixo dos agentes e reconhecimento de que a sessão
 * atual é a do escritório (pasta `escritorio_marketingBF`). O elenco vem do backend
 * (`GET /api/v1/brandforge/roster`).
 */

import { create } from "zustand";
import { apiFetch } from "@/utils/api";

export interface RosterEntry {
  slug: string;
  name: string;
  role: string;
  inspiration: string;
  model: string;
  color: string;
}

interface RosterResponse {
  officeDir: string;
  agents: RosterEntry[];
}

/** Compara caminhos ignorando tipo de barra, caixa e barra final. */
export function samePath(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!a || !b) return false;
  const norm = (p: string): string =>
    p.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
  return norm(a) === norm(b);
}

interface BrandforgeState {
  officeDir: string | null;
  roster: RosterEntry[];
  currentProjectRoot: string | null;
  /** A sessão em exibição é a do escritório (o chefe dela é o Orquestrador). */
  isOfficeSession: boolean;

  setRoster: (officeDir: string, roster: RosterEntry[]) => void;
  setCurrentProjectRoot: (projectRoot: string | null) => void;
  fetchRoster: () => Promise<void>;
  bySlug: (slug: string | null | undefined) => RosterEntry | null;
  reset: () => void;
}

export const useBrandforgeStore = create<BrandforgeState>((set, get) => ({
  officeDir: null,
  roster: [],
  currentProjectRoot: null,
  isOfficeSession: false,

  setRoster: (officeDir, roster) =>
    set((state) => ({
      officeDir,
      roster,
      isOfficeSession: samePath(officeDir, state.currentProjectRoot),
    })),

  setCurrentProjectRoot: (projectRoot) =>
    set((state) => ({
      currentProjectRoot: projectRoot,
      isOfficeSession: samePath(state.officeDir, projectRoot),
    })),

  fetchRoster: async () => {
    if (get().roster.length > 0) return;
    try {
      const resp = await apiFetch("/api/v1/brandforge/roster");
      if (!resp.ok) return;
      const body = (await resp.json()) as RosterResponse;
      get().setRoster(body.officeDir, body.agents);
    } catch {
      // Backend fora do ar: os cartões aparecem sem o elenco até a próxima tentativa.
    }
  },

  bySlug: (slug) =>
    slug ? (get().roster.find((entry) => entry.slug === slug) ?? null) : null,

  reset: () =>
    set({
      officeDir: null,
      roster: [],
      currentProjectRoot: null,
      isOfficeSession: false,
    }),
}));
