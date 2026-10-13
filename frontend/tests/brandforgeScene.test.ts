/**
 * Cena do escritório BrandForge: planta (salas, postos, corredor) e montagem dos avatares.
 */

import { describe, expect, it } from "vitest";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "@/constants/canvas";
import {
  CORRIDOR,
  DEBATE_SEATS,
  DEBATE_TABLE,
  MAX_VISITORS,
  PLACAR_BOARD,
  ROOMS,
  STATIONS,
  roomById,
  visitorSlot,
  type Point,
} from "@/components/brandforge/scene/layout";
import {
  agentActivity,
  bossActivity,
  buildAvatars,
  cleanTask,
  initials,
  isDebating,
  type BossLike,
  type RosterLike,
} from "@/components/brandforge/scene/avatars";
import {
  advance,
  planRoute,
  roomAt,
  WALK_SPEED,
} from "@/components/brandforge/scene/route";
import { nameToLines, wrapText } from "@/components/brandforge/scene/draw";
import type { AgentAnimationState } from "@/stores/slices/types";

const SLUGS = [
  "orquestrador",
  "critico",
  "cacador-de-tendencias",
  "estrategista",
  "roteirista",
  "copywriter",
  "diretor-de-motion",
  "designer-de-posts",
  "editor-de-video",
  "revisor",
  "analista",
];

const ROSTER: RosterLike[] = SLUGS.map((slug) => ({
  slug,
  name: slug === "critico" ? "Crítico" : slug,
  color: "#AABBCC",
}));

function agent(
  id: string,
  agentType: string | null,
  backendState: string,
  extra: Partial<AgentAnimationState> = {},
): AgentAnimationState {
  return {
    id,
    name: agentType ?? "Qualquer",
    color: "#112233",
    number: 1,
    desk: null,
    backendState,
    currentTask: null,
    characterType: null,
    agentType,
    parentSessionId: null,
    parentId: null,
    phase: "idle",
    currentPosition: { x: 0, y: 0 },
    targetPosition: { x: 0, y: 0 },
    path: null,
    bubble: { content: null, displayStartTime: null, queue: [] },
    queueType: null,
    queueIndex: -1,
    isTyping: false,
    ...extra,
  } as AgentAnimationState;
}

const BOSS: BossLike = {
  backendState: "idle",
  currentTask: null,
  bubble: { content: null },
};

describe("planta", () => {
  it("as salas ficam dentro do canvas e não se sobrepõem", () => {
    for (const r of ROOMS) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(CANVAS_WIDTH);
      expect(r.y + r.h).toBeLessThanOrEqual(CANVAS_HEIGHT);
    }
    for (let i = 0; i < ROOMS.length; i++) {
      for (let j = i + 1; j < ROOMS.length; j++) {
        const a = ROOMS[i];
        const b = ROOMS[j];
        const overlap =
          a.x < b.x + b.w &&
          b.x < a.x + a.w &&
          a.y < b.y + b.h &&
          b.y < a.y + a.h;
        expect(overlap, `${a.id} x ${b.id}`).toBe(false);
      }
    }
  });

  it("o corredor fica entre as colunas e as portas abrem para ele", () => {
    expect(CORRIDOR.w).toBeGreaterThan(100);
    for (const r of ROOMS) {
      const toCorridor =
        r.door.x === CORRIDOR.x || r.door.x === CORRIDOR.x + CORRIDOR.w;
      expect(toCorridor, r.id).toBe(true);
      expect(r.door.y).toBeGreaterThan(r.y);
      expect(r.door.y).toBeLessThan(r.y + r.h);
    }
  });

  it("os 11 agentes do elenco têm posto, dentro da sala", () => {
    for (const slug of SLUGS) {
      const station = STATIONS[slug];
      expect(station, slug).toBeDefined();
      const r = roomById(station.roomId);
      expect(station.x).toBeGreaterThan(r.x + 40);
      expect(station.x).toBeLessThan(r.x + r.w - 40);
      expect(station.y).toBeGreaterThan(r.y + 40);
      expect(station.y + 135).toBeLessThan(r.y + r.h); // mesa, nome e tarefa cabem
    }
    expect(Object.keys(STATIONS).sort()).toEqual([...SLUGS].sort());
  });

  it("nenhum posto se sobrepõe a outro", () => {
    const list = Object.entries(STATIONS);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const [na, a] = list[i];
        const [nb, b] = list[j];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        expect(dist, `${na} x ${nb}`).toBeGreaterThanOrEqual(110);
      }
    }
  });

  it("os lugares do debate ficam na sala de debate, em lados opostos da mesa", () => {
    const r = roomById("debate");
    for (const seat of Object.values(DEBATE_SEATS)) {
      expect(seat.x).toBeGreaterThan(r.x);
      expect(seat.x).toBeLessThan(r.x + r.w);
    }
    expect(DEBATE_SEATS.orquestrador.x).toBeLessThan(DEBATE_TABLE.x);
    expect(DEBATE_SEATS.critico.x).toBeGreaterThan(DEBATE_TABLE.x);
  });

  it("o quadro do placar cabe na parede da sala do Orquestrador", () => {
    const r = roomById("orquestrador");
    expect(PLACAR_BOARD.x).toBeGreaterThan(r.x);
    expect(PLACAR_BOARD.x + PLACAR_BOARD.w).toBeLessThan(r.x + r.w);
    expect(PLACAR_BOARD.y + PLACAR_BOARD.h).toBeLessThan(r.y + r.h);
    // não esbarra no posto do Orquestrador
    expect(PLACAR_BOARD.x + PLACAR_BOARD.w).toBeLessThan(
      STATIONS.orquestrador.x - 60,
    );
  });

  it("os visitantes ficam dentro do corredor, sem se sobrepor", () => {
    const slots = Array.from({ length: MAX_VISITORS }, (_, i) =>
      visitorSlot(i),
    );
    for (const s of slots) {
      expect(s.x).toBeGreaterThan(CORRIDOR.x);
      expect(s.x).toBeLessThan(CORRIDOR.x + CORRIDOR.w);
      expect(s.y).toBeLessThan(CORRIDOR.y + CORRIDOR.h);
    }
    const keys = new Set(slots.map((s) => `${s.x},${s.y}`));
    expect(keys.size).toBe(MAX_VISITORS);
  });
});

describe("atividade", () => {
  it("agentes: trabalhando = ativo; esperando permissão = espera; o resto = parado", () => {
    expect(agentActivity("working")).toBe("active");
    expect(agentActivity("thinking")).toBe("active");
    expect(agentActivity("waiting_permission")).toBe("waiting");
    expect(agentActivity("idle")).toBe("idle");
    expect(agentActivity("completed")).toBe("idle");
    expect(agentActivity("leaving")).toBe("idle");
  });

  it("chefe: delegando e trabalhando = ativo", () => {
    expect(bossActivity("delegating")).toBe("active");
    expect(bossActivity("working")).toBe("active");
    expect(bossActivity("idle")).toBe("idle");
    expect(bossActivity("waiting_permission")).toBe("waiting");
  });
});

describe("iniciais", () => {
  it.each([
    ["Orquestrador", "OR"],
    ["Crítico", "CR"],
    ["Caçador de Tendências", "CT"],
    ["Diretor de Motion", "DM"],
    ["Designer de Posts", "DP"],
    ["", "?"],
  ])("%s → %s", (name, esperado) => {
    expect(initials(name)).toBe(esperado);
  });
});

describe("cleanTask", () => {
  it("tira tags e espaços repetidos", () => {
    expect(cleanTask('<agent-message from="a35">[Subag...')).toBe("[Subag...");
    expect(cleanTask("  Escreve   o roteiro ")).toBe("Escreve o roteiro");
  });
  it("vazio ou só tags vira null", () => {
    expect(cleanTask(null)).toBeNull();
    expect(cleanTask("")).toBeNull();
    expect(cleanTask("<agent-message>")).toBeNull();
  });
});

describe("textos do desenho", () => {
  it("wrapText quebra sem partir palavras e limita as linhas", () => {
    expect(wrapText("uma frase bem curta", 30)).toEqual([
      "uma frase bem curta",
    ]);
    expect(wrapText("uma frase um pouco mais longa para quebrar", 14)).toEqual([
      "uma frase um",
      "pouco mais",
      "longa para…",
    ]);
  });
  it("nomes longos viram duas linhas", () => {
    expect(nameToLines("Crítico")).toEqual(["Crítico"]);
    expect(nameToLines("Caçador de Tendências")).toEqual([
      "Caçador de",
      "Tendências",
    ]);
  });
});

describe("buildAvatars", () => {
  it("sem ninguém no escritório, o elenco inteiro aparece apagado, cada um no seu posto", () => {
    const models = buildAvatars(ROSTER, [], BOSS);
    expect(models).toHaveLength(11);
    for (const m of models.filter((x) => x.slug !== "orquestrador")) {
      expect(m.activity).toBe("offline");
      expect(m.focusId).toBeNull();
      expect(m.position).toEqual({
        x: STATIONS[m.slug!].x,
        y: STATIONS[m.slug!].y,
      });
    }
  });

  it("o Orquestrador é o chefe da sessão e abre o cartão pelo id 'boss'", () => {
    const models = buildAvatars(ROSTER, [], {
      ...BOSS,
      backendState: "delegating",
      currentTask: "Montando proposta",
    });
    const orq = models.find((m) => m.slug === "orquestrador")!;
    expect(orq.focusId).toBe("boss");
    expect(orq.activity).toBe("active");
    expect(orq.task).toBe("Montando proposta");
  });

  it("um subagente do elenco acende no seu posto", () => {
    const models = buildAvatars(
      ROSTER,
      [agent("a1", "critico", "working", { currentTask: "Rodada 1" })],
      BOSS,
    );
    const critico = models.find((m) => m.slug === "critico")!;
    expect(critico.activity).toBe("active");
    expect(critico.focusId).toBe("a1");
    expect(critico.task).toBe("Rodada 1");
    expect(models.filter((m) => m.visitor)).toHaveLength(0);
  });

  it("dois agentes do mesmo tipo: o mais ativo ocupa o posto", () => {
    const models = buildAvatars(
      ROSTER,
      [agent("a1", "roteirista", "idle"), agent("a2", "roteirista", "working")],
      BOSS,
    );
    expect(models.find((m) => m.slug === "roteirista")!.focusId).toBe("a2");
    expect(models).toHaveLength(11);
  });

  it("quem não é do elenco vira visitante, no corredor", () => {
    const models = buildAvatars(
      ROSTER,
      [agent("g1", "general-purpose", "working"), agent("g2", null, "idle")],
      BOSS,
    );
    const visitors = models.filter((m) => m.visitor);
    expect(visitors.map((v) => v.focusId)).toEqual(["g1", "g2"]);
    expect(visitors[0].position).toEqual(visitorSlot(0));
    expect(visitors[1].position).toEqual(visitorSlot(1));
    expect(models).toHaveLength(13);
  });

  it("nunca passa do limite de visitantes", () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      agent(`v${i}`, "general-purpose", "idle"),
    );
    expect(
      buildAvatars(ROSTER, many, BOSS).filter((m) => m.visitor),
    ).toHaveLength(MAX_VISITORS);
  });

  it("leva o balão do agente", () => {
    const bubble = { type: "speech", text: "Objeção R1.1" } as never;
    const models = buildAvatars(
      ROSTER,
      [
        agent("a1", "critico", "working", {
          bubble: { content: bubble, displayStartTime: null, queue: [] },
        }),
      ],
      BOSS,
    );
    expect(models.find((m) => m.slug === "critico")!.bubble).toBe(bubble);
  });

  it("ignora entradas do elenco sem posto na planta", () => {
    const models = buildAvatars(
      [...ROSTER, { slug: "novo-agente", name: "Novo", color: "#fff" }],
      [],
      BOSS,
    );
    expect(models).toHaveLength(11);
  });
});

describe("isDebating", () => {
  const fresh = (now: number) => ({
    state: "em debate",
    updatedAt: new Date(now - 30_000).toISOString(),
  });
  const NOW = Date.parse("2026-10-13T20:00:00Z");

  it("com o Crítico trabalhando, há debate", () => {
    expect(isDebating("active", "idle", null, NOW)).toBe(true);
    expect(isDebating("waiting", "idle", null, NOW)).toBe(true);
  });

  it("debate recente em andamento e Orquestrador ocupado: há debate", () => {
    expect(isDebating("idle", "active", fresh(NOW), NOW)).toBe(true);
  });

  it("debate em andamento mas Orquestrador parado: não há debate", () => {
    expect(isDebating("offline", "idle", fresh(NOW), NOW)).toBe(false);
  });

  it("debate velho (abandonado) não prende ninguém à mesa", () => {
    const old = {
      state: "em debate",
      updatedAt: new Date(NOW - 10 * 60_000).toISOString(),
    };
    expect(isDebating("offline", "active", old, NOW)).toBe(false);
  });

  it("debate encerrado não conta", () => {
    const done = { state: "aprovada", updatedAt: new Date(NOW).toISOString() };
    expect(isDebating("offline", "active", done, NOW)).toBe(false);
  });
});

describe("buildAvatars com debate", () => {
  it("Orquestrador e Crítico vão à mesa quando o Crítico trabalha; os outros ficam", () => {
    const models = buildAvatars(
      ROSTER,
      [agent("c1", "critico", "working"), agent("r1", "roteirista", "working")],
      { ...BOSS, backendState: "working" },
      { now: Date.now() },
    );
    const orq = models.find((m) => m.slug === "orquestrador")!;
    const critico = models.find((m) => m.slug === "critico")!;
    const roteirista = models.find((m) => m.slug === "roteirista")!;
    expect(orq.atTable).toBe(true);
    expect(orq.position).toEqual(DEBATE_SEATS.orquestrador);
    expect(orq.home).toEqual({
      x: STATIONS.orquestrador.x,
      y: STATIONS.orquestrador.y,
    });
    expect(critico.atTable).toBe(true);
    expect(critico.position).toEqual(DEBATE_SEATS.critico);
    expect(roteirista.atTable).toBe(false);
    expect(roteirista.position).toEqual({
      x: STATIONS.roteirista.x,
      y: STATIONS.roteirista.y,
    });
  });

  it("sem debate, cada um fica no seu posto", () => {
    const models = buildAvatars(ROSTER, [], BOSS, { now: Date.now() });
    expect(models.every((m) => !m.atTable)).toBe(true);
    expect(models.every((m) => m.position.x === m.home.x)).toBe(true);
  });
});

describe("trajetos", () => {
  it("roomAt acha a sala do ponto, ou nada no corredor", () => {
    expect(roomAt(STATIONS.orquestrador)?.id).toBe("orquestrador");
    expect(roomAt(STATIONS.critico)?.id).toBe("debate");
    expect(roomAt({ x: CORRIDOR.x + CORRIDOR.w / 2, y: 500 })).toBeNull();
  });

  it("na mesma sala vai direto ao destino", () => {
    expect(planRoute(STATIONS.critico, DEBATE_SEATS.critico)).toEqual([
      DEBATE_SEATS.critico,
    ]);
  });

  it("entre salas passa pela porta de saída, corredor e porta de entrada", () => {
    const route = planRoute(STATIONS.orquestrador, DEBATE_SEATS.orquestrador);
    const orq = roomById("orquestrador");
    const deb = roomById("debate");
    expect(route[0]).toEqual(orq.door);
    expect(route).toContainEqual(deb.door);
    expect(route[route.length - 1]).toEqual(DEBATE_SEATS.orquestrador);
    // nunca atravessa uma parede: todo trecho entre pontos consecutivos é curto ou passa por porta
    expect(route.length).toBeGreaterThanOrEqual(3);
  });

  it("de uma sala para outra em linhas diferentes cruza o corredor na vertical", () => {
    const route = planRoute(STATIONS.estrategista, STATIONS.revisor);
    const lane = CORRIDOR.x + CORRIDOR.w / 2;
    expect(route.some((p) => p.x === lane)).toBe(true);
    expect(route[route.length - 1]).toEqual(STATIONS.revisor);
  });

  it("não repete pontos em sequência", () => {
    const route = planRoute(STATIONS.orquestrador, DEBATE_SEATS.orquestrador);
    for (let i = 1; i < route.length; i++) {
      expect(
        route[i].x === route[i - 1].x && route[i].y === route[i - 1].y,
      ).toBe(false);
    }
  });

  it("advance anda a distância pedida e devolve o resto do trajeto", () => {
    const path = [
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ];
    const step = advance({ x: 0, y: 0 }, path, 150);
    expect(step.position).toEqual({ x: 100, y: 50 });
    expect(step.path).toEqual([{ x: 100, y: 100 }]);
    const done = advance(step.position, step.path, 1000);
    expect(done.position).toEqual({ x: 100, y: 100 });
    expect(done.path).toEqual([]);
  });

  it("a caminhada leva poucos segundos entre as salas", () => {
    const route = planRoute(STATIONS.orquestrador, DEBATE_SEATS.orquestrador);
    let length = 0;
    let last: Point = STATIONS.orquestrador;
    for (const p of route) {
      length += Math.hypot(p.x - last.x, p.y - last.y);
      last = p;
    }
    expect(length / WALK_SPEED).toBeLessThan(4);
  });
});
