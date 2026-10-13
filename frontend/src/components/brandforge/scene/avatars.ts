/**
 * Monta os avatares da cena a partir do elenco e do estado do jogo (puro, sem React).
 *
 * Os 11 agentes do elenco aparecem sempre, em posto fixo: apagados quando não estão no
 * escritório, acesos quando trabalham. O que não é do elenco vira "visitante".
 */

import type { BubbleContent } from "@/types";
import type { AgentAnimationState } from "@/stores/slices/types";
import { MAX_VISITORS, STATIONS, visitorSlot, type Point } from "./layout";

export type Activity = "offline" | "idle" | "active" | "waiting";

export interface RosterLike {
  slug: string;
  name: string;
  color: string;
}

export interface BossLike {
  backendState: string;
  currentTask: string | null;
  bubble: { content: BubbleContent | null };
}

export interface AvatarModel {
  /** Chave estável do avatar (slug do elenco ou id do visitante). */
  key: string;
  /** Id para abrir o cartão ("boss" para o Orquestrador, id do agente nos demais). */
  focusId: string | null;
  slug: string | null;
  name: string;
  color: string;
  activity: Activity;
  task: string | null;
  bubble: BubbleContent | null;
  position: Point;
  visitor: boolean;
}

const ACTIVE_AGENT_STATES = new Set([
  "arriving",
  "reporting",
  "walking_to_desk",
  "working",
  "thinking",
  "reporting_done",
]);
const WAITING_STATES = new Set(["waiting_permission"]);
const ACTIVE_BOSS_STATES = new Set([
  "phone_ringing",
  "on_phone",
  "receiving",
  "working",
  "delegating",
  "reviewing",
]);

export function agentActivity(state: string): Activity {
  if (WAITING_STATES.has(state)) return "waiting";
  if (ACTIVE_AGENT_STATES.has(state)) return "active";
  return "idle";
}

export function bossActivity(state: string): Activity {
  if (WAITING_STATES.has(state)) return "waiting";
  return ACTIVE_BOSS_STATES.has(state) ? "active" : "idle";
}

const RANK: Record<Activity, number> = {
  waiting: 3,
  active: 2,
  idle: 1,
  offline: 0,
};

/** Texto de tarefa limpo: sem tags XML (ex.: <agent-message ...>) e sem espaços repetidos. */
export function cleanTask(task: string | null | undefined): string | null {
  if (!task) return null;
  const text = task
    .replace(/<[^>]*>?/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text || null;
}

const SMALL_WORDS = new Set(["de", "da", "do", "das", "dos", "e"]);

/** Iniciais para o avatar: duas palavras viram duas letras; uma palavra, as duas primeiras. */
export function initials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((w) => w && !SMALL_WORDS.has(w.toLowerCase()));
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function buildAvatars(
  roster: RosterLike[],
  agents: Iterable<AgentAnimationState>,
  boss: BossLike,
): AvatarModel[] {
  const bySlug = new Map<string, AgentAnimationState>();
  const visitors: AgentAnimationState[] = [];

  for (const agent of agents) {
    const slug = agent.agentType;
    if (slug && STATIONS[slug] && slug !== "orquestrador") {
      const current = bySlug.get(slug);
      const better =
        !current ||
        RANK[agentActivity(agent.backendState)] >
          RANK[agentActivity(current.backendState)];
      if (better) bySlug.set(slug, agent);
    } else {
      visitors.push(agent);
    }
  }

  const models: AvatarModel[] = [];

  for (const entry of roster) {
    const station = STATIONS[entry.slug];
    if (!station) continue;
    const position = { x: station.x, y: station.y };

    if (entry.slug === "orquestrador") {
      models.push({
        key: entry.slug,
        focusId: "boss",
        slug: entry.slug,
        name: entry.name,
        color: entry.color,
        activity: bossActivity(boss.backendState),
        task: cleanTask(boss.currentTask),
        bubble: boss.bubble.content,
        position,
        visitor: false,
      });
      continue;
    }

    const agent = bySlug.get(entry.slug);
    models.push({
      key: entry.slug,
      focusId: agent ? agent.id : null,
      slug: entry.slug,
      name: entry.name,
      color: entry.color,
      activity: agent ? agentActivity(agent.backendState) : "offline",
      task: cleanTask(agent?.currentTask),
      bubble: agent?.bubble.content ?? null,
      position,
      visitor: false,
    });
  }

  visitors.slice(0, MAX_VISITORS).forEach((agent, index) => {
    models.push({
      key: `visitante:${agent.id}`,
      focusId: agent.id,
      slug: null,
      name: agent.name ?? `Visitante ${index + 1}`,
      color: agent.color,
      activity: agentActivity(agent.backendState),
      task: cleanTask(agent.currentTask),
      bubble: agent.bubble.content,
      position: visitorSlot(index),
      visitor: true,
    });
  });

  return models;
}
