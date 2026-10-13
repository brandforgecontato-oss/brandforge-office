/**
 * Testes do placar de aprovação (store + agrupamento por status).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/api", () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from "@/utils/api";
import {
  STATUS_LABELS,
  groupByStatus,
  usePlacarStore,
  type PlacarPiece,
} from "@/stores/placarStore";

const mockFetch = vi.mocked(apiFetch);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const piece = (
  id: string,
  status: string,
  extra: Partial<PlacarPiece> = {},
): PlacarPiece => ({
  id,
  tema: `Tema ${id}`,
  formato: "reel",
  status,
  motivo: "",
  origem: "pasta",
  atualizadoEm: "2026-10-12T00:00:00Z",
  ...extra,
});

const STATUSES = [
  "pendente",
  "em produção",
  "entregue",
  "aprovado",
  "refazer",
  "travado",
];

describe("groupByStatus", () => {
  it("devolve as seis colunas, na ordem do protocolo, mesmo vazias", () => {
    const columns = groupByStatus([], STATUSES);
    expect(columns.map((c) => c.status)).toEqual(STATUSES);
    expect(columns.every((c) => c.pieces.length === 0)).toBe(true);
  });

  it("distribui as peças pelo status", () => {
    const columns = groupByStatus(
      [
        piece("a", "pendente"),
        piece("b", "travado"),
        piece("c", "pendente"),
        piece("d", "aprovado"),
      ],
      STATUSES,
    );
    const byStatus = Object.fromEntries(
      columns.map((c) => [c.status, c.pieces.map((p) => p.id)]),
    );
    expect(byStatus["pendente"]).toEqual(["a", "c"]);
    expect(byStatus["travado"]).toEqual(["b"]);
    expect(byStatus["aprovado"]).toEqual(["d"]);
  });

  it("status desconhecido não some: cai em pendente", () => {
    const columns = groupByStatus([piece("x", "voando")], STATUSES);
    expect(columns[0].pieces.map((p) => p.id)).toEqual(["x"]);
  });

  it("usa a ordem padrão quando o backend não manda a lista", () => {
    expect(groupByStatus([], null).map((c) => c.status)).toEqual(STATUSES);
  });
});

describe("STATUS_LABELS", () => {
  it("tem um rótulo em maiúsculas para cada status", () => {
    for (const status of STATUSES) {
      expect(STATUS_LABELS[status]).toBe(status.toUpperCase());
    }
  });
});

describe("placarStore", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    usePlacarStore.getState().reset();
  });

  it("fetchPlacar carrega peças, contagens e travados", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        statuses: STATUSES,
        counts: { pendente: 1, travado: 1 },
        pieces: [piece("a", "pendente"), piece("b", "travado")],
        locked: ["b"],
      }),
    );
    await usePlacarStore.getState().fetchPlacar();
    expect(mockFetch).toHaveBeenLastCalledWith("/api/v1/brandforge/placar");
    const state = usePlacarStore.getState();
    expect(state.pieces).toHaveLength(2);
    expect(state.locked).toEqual(["b"]);
    expect(state.loaded).toBe(true);
  });

  it("falha de rede mantém o placar anterior", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        statuses: STATUSES,
        counts: {},
        pieces: [piece("a", "pendente")],
        locked: [],
      }),
    );
    await usePlacarStore.getState().fetchPlacar();
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    await usePlacarStore.getState().fetchPlacar();
    expect(usePlacarStore.getState().pieces).toHaveLength(1);
  });

  it("resposta com erro HTTP é ignorada", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ detail: "x" }, 500));
    await usePlacarStore.getState().fetchPlacar();
    expect(usePlacarStore.getState().loaded).toBe(false);
  });
});
