/**
 * Paleta e funções de desenho da cena (estilo plano, Obsidian e Ouro).
 */

import type { Graphics } from "pixi.js";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "@/constants/canvas";
import { CORRIDOR, DEBATE_TABLE, type Room } from "./layout";

export const PALETTE = {
  canvas: 0x0f0d09,
  corridor: 0x17140f,
  roomFloor: 0x211d16,
  roomEdge: 0x463e31,
  desk: 0x2e281f,
  deskTop: 0x3a3226,
  gold: 0xd4af6a,
  goldDeep: 0x7a5b22,
  cream: 0xf1e9d8,
  inkDim: 0x9a8f78,
  waiting: 0xf59e0b,
} as const;

export const FONT_UI = '"Inter", "Segoe UI", system-ui, sans-serif';
export const FONT_DISPLAY = '"Playfair Display", Georgia, serif';

/** "#RRGGBB" para número; devolve o ouro se o texto não for uma cor válida. */
export function hexToNumber(color: string): number {
  return /^#[0-9a-fA-F]{6}$/.test(color)
    ? parseInt(color.slice(1), 16)
    : PALETTE.gold;
}

export function drawBackground(g: Graphics): void {
  g.clear();
  g.rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  g.fill(PALETTE.canvas);
  g.roundRect(CORRIDOR.x + 8, CORRIDOR.y, CORRIDOR.w - 16, CORRIDOR.h, 20);
  g.fill(PALETTE.corridor);
  // Fio central do corredor
  g.rect(CORRIDOR.x + CORRIDOR.w / 2 - 0.5, CORRIDOR.y + 110, 1, 480);
  g.fill({ color: PALETTE.gold, alpha: 0.07 });
}

export function drawRoom(g: Graphics, room: Room): void {
  g.clear();
  // Sombra suave
  g.roundRect(room.x + 3, room.y + 5, room.w, room.h, 18);
  g.fill({ color: 0x000000, alpha: 0.35 });
  // Piso
  g.roundRect(room.x, room.y, room.w, room.h, 18);
  g.fill(PALETTE.roomFloor);
  // Faixas sutis no piso
  for (let x = room.x + 48; x < room.x + room.w - 8; x += 48) {
    g.rect(x, room.y + 56, 1, room.h - 72);
    g.fill({ color: PALETTE.gold, alpha: 0.025 });
  }
  // Borda
  g.roundRect(room.x, room.y, room.w, room.h, 18);
  g.stroke({ width: 1.5, color: PALETTE.roomEdge, alpha: 0.9 });
  // Barra de ouro do título
  g.roundRect(room.x + 18, room.y + 20, 3, 18, 1.5);
  g.fill(PALETTE.gold);
  // Porta (vão na borda, voltado para o corredor)
  const doorHalf = 26;
  const onRight = room.door.x > room.x + room.w / 2;
  const gapX = onRight ? room.door.x - 3 : room.door.x - 3;
  g.rect(gapX, room.door.y - doorHalf, 6, doorHalf * 2);
  g.fill(PALETTE.corridor);
  g.rect(gapX + 2, room.door.y - doorHalf, 2, doorHalf * 2);
  g.fill({ color: PALETTE.gold, alpha: 0.55 });
}

/** Mesa e notebook de um posto (o avatar é desenhado por cima). */
export function drawDesk(g: Graphics, active: boolean): void {
  g.clear();
  g.roundRect(-60, 26, 120, 34, 9);
  g.fill(PALETTE.desk);
  g.roundRect(-60, 26, 120, 6, 3);
  g.fill({ color: PALETTE.gold, alpha: active ? 0.55 : 0.18 });
  // Notebook
  g.roundRect(-22, 35, 44, 20, 3);
  g.fill(PALETTE.canvas);
  g.roundRect(-22, 35, 44, 20, 3);
  g.stroke({
    width: 1,
    color: PALETTE.gold,
    alpha: active ? 0.85 : 0.3,
  });
  if (active) {
    g.roundRect(-18, 39, 36, 12, 2);
    g.fill({ color: PALETTE.gold, alpha: 0.18 });
  }
}

/** Mesa redonda da sala de debate, com as cadeiras. */
export function drawDebateTable(g: Graphics): void {
  g.clear();
  const { x, y, radius } = DEBATE_TABLE;
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI * 2 * i) / 8 + Math.PI / 8;
    g.circle(
      x + Math.cos(angle) * (radius + 26),
      y + Math.sin(angle) * (radius + 26),
      9,
    );
    g.fill(PALETTE.deskTop);
  }
  g.circle(x, y, radius);
  g.fill(PALETTE.desk);
  g.circle(x, y, radius);
  g.stroke({ width: 1.5, color: PALETTE.gold, alpha: 0.45 });
  g.circle(x, y, radius - 14);
  g.stroke({ width: 1, color: PALETTE.gold, alpha: 0.18 });
}

/** Bandeja de entrega da sala de revisão. */
export function drawDeliveryTray(g: Graphics, x: number, y: number): void {
  g.clear();
  g.roundRect(x, y, 150, 74, 10);
  g.fill(PALETTE.desk);
  g.roundRect(x, y, 150, 74, 10);
  g.stroke({ width: 1, color: PALETTE.gold, alpha: 0.35 });
  for (let i = 0; i < 3; i++) {
    g.roundRect(x + 14 + i * 6, y + 14 + i * 5, 96, 40, 4);
    g.fill({ color: PALETTE.cream, alpha: 0.9 - i * 0.2 });
  }
  g.circle(x + 126, y + 37, 10);
  g.fill({ color: PALETTE.gold, alpha: 0.85 });
}

export function drawPlantInto(g: Graphics, x: number, y: number): void {
  g.circle(x, y - 10, 11);
  g.fill(0x3f5b3a);
  g.circle(x - 7, y - 4, 8);
  g.fill(0x4b6b44);
  g.roundRect(x - 8, y, 16, 12, 3);
  g.fill(PALETTE.goldDeep);
}

export function drawBoardFrame(g: Graphics, w: number, h: number): void {
  g.clear();
  g.roundRect(3, 5, w, h, 12);
  g.fill({ color: 0x000000, alpha: 0.35 });
  g.roundRect(0, 0, w, h, 12);
  g.fill(PALETTE.canvas);
  g.roundRect(0, 0, w, h, 12);
  g.stroke({ width: 1.5, color: PALETTE.gold, alpha: 0.5 });
}

/** Balão de fala: retângulo arredondado creme com ponta para baixo. */
export function drawSpeechBubble(g: Graphics, w: number, h: number): void {
  g.clear();
  g.roundRect(-w / 2 + 2, -h + 3, w, h, 11);
  g.fill({ color: 0x000000, alpha: 0.3 });
  g.roundRect(-w / 2, -h, w, h, 11);
  g.fill({ color: PALETTE.cream, alpha: 0.98 });
  g.roundRect(-w / 2, -h, w, h, 11);
  g.stroke({ width: 1.5, color: PALETTE.gold, alpha: 0.9 });
  g.poly([-7, -1, 7, -1, 0, 9]);
  g.fill({ color: PALETTE.cream, alpha: 0.98 });
}

/** Nome do agente em até duas linhas (nomes longos quebram no espaço). */
export function nameToLines(name: string): string[] {
  return name.length <= 14 ? [name] : wrapText(name, 14, 2);
}

/** Quebra o texto em linhas de até `max` caracteres, sem partir palavras (exceto as enormes). */
export function wrapText(text: string, max: number, maxLines = 3): string[] {
  const lines: string[] = [];
  let current = "";
  for (const raw of text.split(/\s+/).filter(Boolean)) {
    let word = raw;
    while (word.length > max) {
      if (current) {
        lines.push(current);
        current = "";
      }
      lines.push(word.slice(0, max));
      word = word.slice(max);
    }
    if (!current) current = word;
    else if ((current + " " + word).length <= max) current += " " + word;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  const last = kept[maxLines - 1];
  kept[maxLines - 1] =
    (last.length > max - 1 ? last.slice(0, max - 1) : last) + "…";
  return kept;
}
