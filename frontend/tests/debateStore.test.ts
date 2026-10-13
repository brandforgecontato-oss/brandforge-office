/**
 * Testes do debate Orquestrador × Crítico: linha do tempo de balões e store.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/api", () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from "@/utils/api";
import {
  buildTimeline,
  newBubbleTexts,
  useDebateStore,
  type Debate,
} from "@/stores/debateStore";

const mockFetch = vi.mocked(apiFetch);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const DEBATE: Debate = {
  piece: "2026-10-07_tema",
  title: "Tema",
  kind: "peca",
  verdict: "APROVADA COM RESSALVAS",
  state: "aprovada com ressalvas",
  currentRound: 3,
  updatedAt: "2026-10-07T10:00:00Z",
  attempts: [
    {
      number: 1,
      proposals: [{ version: 1, title: "Tema" }],
      verdict: "APROVADA COM RESSALVAS",
      verdictNotes: ["R3.1 (menor): reordenar."],
      rounds: [
        {
          round: 1,
          objections: [
            {
              id: "R1.1",
              gravity: "séria",
              criterion: "Gancho",
              text: "Gancho fraco.",
              reason: "motivo",
              fix: "arrumar",
            },
            {
              id: "R1.2",
              gravity: "menor",
              criterion: "Marca",
              text: "Cor.",
              reason: "",
              fix: "",
            },
          ],
          answers: [
            { ids: ["R1.1"], action: "ACEITAR", text: "Mudei o gancho." },
            { ids: ["R1.2"], action: "REBATER", text: "A cor é da marca." },
          ],
          statuses: [],
        },
        {
          round: 2,
          objections: [],
          answers: [],
          statuses: [{ id: "R1.1", status: "resolvida", note: "ok" }],
        },
      ],
    },
  ],
};

describe("buildTimeline", () => {
  it("ordena rodada a rodada: Crítico, depois status, depois Orquestrador", () => {
    const kinds = buildTimeline(DEBATE).map((i) => i.kind);
    expect(kinds).toEqual([
      "attempt",
      "round",
      "critic",
      "critic",
      "orquestrador",
      "orquestrador",
      "round",
      "status",
      "verdict",
    ]);
  });

  it("balão do Crítico traz id, gravidade e texto", () => {
    const critic = buildTimeline(DEBATE).find((i) => i.kind === "critic");
    expect(critic).toMatchObject({
      key: "1-1-obj-R1.1",
      label: "R1.1",
      gravity: "séria",
      text: "Gancho fraco.",
    });
  });

  it("balão do Orquestrador traz a ação", () => {
    const answers = buildTimeline(DEBATE).filter(
      (i) => i.kind === "orquestrador",
    );
    expect(answers.map((a) => a.action)).toEqual(["ACEITAR", "REBATER"]);
    expect(answers[0].label).toBe("R1.1");
  });

  it("veredito leva as ressalvas", () => {
    const verdict = buildTimeline(DEBATE).at(-1);
    expect(verdict).toMatchObject({
      kind: "verdict",
      text: "APROVADA COM RESSALVAS",
      notes: ["R3.1 (menor): reordenar."],
    });
  });

  it("debate nulo ou sem tentativas dá linha do tempo vazia", () => {
    expect(buildTimeline(null)).toEqual([]);
    expect(buildTimeline({ ...DEBATE, attempts: [] })).toEqual([]);
  });

  it("as chaves são únicas (React precisa delas)", () => {
    const keys = buildTimeline(DEBATE).map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("newBubbleTexts", () => {
  it("devolve só os balões que não existiam antes, por falante", () => {
    const antes = buildTimeline({
      ...DEBATE,
      attempts: [
        {
          ...DEBATE.attempts[0],
          rounds: [{ ...DEBATE.attempts[0].rounds[0], answers: [] }],
        },
      ],
    });
    const depois = buildTimeline(DEBATE);
    const novos = newBubbleTexts(antes, depois);
    expect(novos.map((n) => n.speaker)).toEqual([
      "orquestrador",
      "orquestrador",
    ]);
    expect(novos[0].text).toContain("Mudei o gancho");
  });

  it("sem diferença, nada novo", () => {
    const t = buildTimeline(DEBATE);
    expect(newBubbleTexts(t, t)).toEqual([]);
  });
});

describe("debateStore", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    useDebateStore.getState().reset();
  });

  it("fetchDebate carrega o debate e a lista", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        debate: DEBATE,
        available: [
          {
            piece: DEBATE.piece,
            title: "Tema",
            state: "em debate",
            updatedAt: "x",
          },
        ],
      }),
    );
    await useDebateStore.getState().fetchDebate();
    expect(mockFetch).toHaveBeenLastCalledWith("/api/v1/brandforge/debate");
    expect(useDebateStore.getState().debate?.title).toBe("Tema");
    expect(useDebateStore.getState().available).toHaveLength(1);
  });

  it("escolher uma peça pede aquela peça", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ debate: DEBATE, available: [] }),
    );
    useDebateStore.getState().selectPiece("2026-10-07_tema");
    await useDebateStore.getState().fetchDebate();
    expect(mockFetch).toHaveBeenLastCalledWith(
      "/api/v1/brandforge/debate?piece=2026-10-07_tema",
    );
  });

  it("voltar a 'mais recente' remove o filtro", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ debate: null, available: [] }));
    useDebateStore.getState().selectPiece("x");
    useDebateStore.getState().selectPiece(null);
    await useDebateStore.getState().fetchDebate();
    expect(mockFetch).toHaveBeenLastCalledWith("/api/v1/brandforge/debate");
  });

  it("falha de rede mantém o debate anterior", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ debate: DEBATE, available: [] }),
    );
    await useDebateStore.getState().fetchDebate();
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    await useDebateStore.getState().fetchDebate();
    expect(useDebateStore.getState().debate?.piece).toBe(DEBATE.piece);
  });
});
