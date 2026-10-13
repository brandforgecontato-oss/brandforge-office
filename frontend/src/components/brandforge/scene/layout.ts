/**
 * Planta do escritório BrandForge (cena nova, só para a sessão do escritório).
 *
 * Coordenadas em pixels no canvas de 1280x1024: duas colunas de salas separadas por um
 * corredor central. Cada agente do elenco tem um posto fixo numa sala; o que não é do elenco
 * vai para a área de visitantes, no corredor.
 */

import { CANVAS_HEIGHT, CANVAS_WIDTH } from "@/constants/canvas";

export interface Point {
  x: number;
  y: number;
}

export interface Room {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Ponto da porta, na borda da sala voltada para o corredor. */
  door: Point;
}

const MARGIN = 24;
const ROOM_W = 536;
const ROOM_H = 304;
const ROW_GAP = 32;

const LEFT_X = MARGIN;
const RIGHT_X = CANVAS_WIDTH - MARGIN - ROOM_W;
const ROW_Y = [
  MARGIN,
  MARGIN + ROOM_H + ROW_GAP,
  MARGIN + 2 * (ROOM_H + ROW_GAP),
];

function room(
  id: string,
  label: string,
  col: "left" | "right",
  row: 0 | 1 | 2,
): Room {
  const x = col === "left" ? LEFT_X : RIGHT_X;
  const y = ROW_Y[row];
  return {
    id,
    label,
    x,
    y,
    w: ROOM_W,
    h: ROOM_H,
    door: { x: col === "left" ? x + ROOM_W : x, y: y + ROOM_H / 2 },
  };
}

export const ROOMS: Room[] = [
  room("orquestrador", "Sala do Orquestrador", "left", 0),
  room("debate", "Sala de Debate", "right", 0),
  room("pesquisa", "Pesquisa e Estratégia", "left", 1),
  room("producao", "Produção Visual", "right", 1),
  room("roteiro", "Roteiro e Texto", "left", 2),
  room("revisao", "Revisão e Entrega", "right", 2),
];

export function roomById(id: string): Room {
  const found = ROOMS.find((r) => r.id === id);
  if (!found) throw new Error(`Sala desconhecida: ${id}`);
  return found;
}

/** Corredor central, entre as duas colunas de salas. */
export const CORRIDOR = {
  x: LEFT_X + ROOM_W,
  y: MARGIN,
  w: RIGHT_X - (LEFT_X + ROOM_W),
  h: CANVAS_HEIGHT - 2 * MARGIN,
};

export interface Station {
  roomId: string;
  x: number;
  y: number;
}

/** Altura dos postos dentro da sala (a mesa e o nome ficam abaixo deste ponto). */
const STATION_DY = 150;

function at(roomId: string, fraction: number, dy = STATION_DY): Station {
  const r = roomById(roomId);
  return { roomId, x: Math.round(r.x + r.w * fraction), y: r.y + dy };
}

/** Posto de cada agente do elenco (chave = nome do arquivo do agente). */
export const STATIONS: Record<string, Station> = {
  orquestrador: at("orquestrador", 0.8),
  critico: at("debate", 0.8),
  "cacador-de-tendencias": at("pesquisa", 1 / 6),
  estrategista: at("pesquisa", 3 / 6),
  analista: at("pesquisa", 5 / 6),
  roteirista: at("roteiro", 0.3),
  copywriter: at("roteiro", 0.7),
  "diretor-de-motion": at("producao", 1 / 6),
  "designer-de-posts": at("producao", 3 / 6),
  "editor-de-video": at("producao", 5 / 6),
  revisor: at("revisao", 0.25),
};

/** Mesa redonda da sala de debate, com os lugares do Orquestrador e do Crítico. */
const DEBATE = roomById("debate");
export const DEBATE_TABLE = {
  x: DEBATE.x + 200,
  y: DEBATE.y + 168,
  radius: 66,
};
export const DEBATE_SEATS: Record<"orquestrador" | "critico", Point> = {
  orquestrador: {
    x: DEBATE_TABLE.x - DEBATE_TABLE.radius - 30,
    y: DEBATE_TABLE.y,
  },
  critico: { x: DEBATE_TABLE.x + DEBATE_TABLE.radius + 30, y: DEBATE_TABLE.y },
};

/** Quadro do placar, na parede da sala do Orquestrador. */
const ORQ = roomById("orquestrador");
export const PLACAR_BOARD = {
  x: ORQ.x + 20,
  y: ORQ.y + 56,
  w: 338,
  h: 152,
};

/** Área de visitantes (agentes que não são do elenco), na parte de baixo do corredor. */
export const VISITOR_AREA = {
  x: CORRIDOR.x,
  y: CORRIDOR.y + 640,
  w: CORRIDOR.w,
};
const VISITOR_COLS = 2;
export const MAX_VISITORS = 8;

export function visitorSlot(index: number): Point {
  const col = index % VISITOR_COLS;
  const row = Math.floor(index / VISITOR_COLS);
  return {
    x: Math.round(
      VISITOR_AREA.x + (VISITOR_AREA.w / VISITOR_COLS) * (col + 0.5),
    ),
    y: VISITOR_AREA.y + 60 + row * 84,
  };
}

/** Porta mais próxima de uma sala, para os trajetos (etapa de movimento). */
export function doorOf(roomId: string): Point {
  return roomById(roomId).door;
}
