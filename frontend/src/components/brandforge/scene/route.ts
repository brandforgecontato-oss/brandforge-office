/**
 * Trajetos dos avatares entre as salas: sem A*, só linhas retas pelas portas e pelo corredor.
 */

import { CORRIDOR, ROOMS, type Point, type Room } from "./layout";

/** Velocidade de caminhada, em pixels por segundo. */
export const WALK_SPEED = 300;

/** Sala que contém o ponto (ou null, se estiver no corredor ou fora de qualquer sala). */
export function roomAt(point: Point): Room | null {
  return (
    ROOMS.find(
      (r) =>
        point.x > r.x &&
        point.x < r.x + r.w &&
        point.y > r.y &&
        point.y < r.y + r.h,
    ) ?? null
  );
}

function same(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5;
}

/**
 * Pontos pelos quais o avatar passa para ir de `from` até `to` (o último ponto é `to`).
 * Na mesma sala vai direto; entre salas sai pela porta, atravessa o corredor e entra pela
 * porta da sala de destino.
 */
export function planRoute(from: Point, to: Point): Point[] {
  const fromRoom = roomAt(from);
  const toRoom = roomAt(to);
  if (fromRoom && toRoom && fromRoom.id === toRoom.id) return [to];

  const laneX = CORRIDOR.x + CORRIDOR.w / 2;
  const points: Point[] = [];
  if (fromRoom) {
    points.push(fromRoom.door, { x: laneX, y: fromRoom.door.y });
  }
  if (toRoom) {
    points.push({ x: laneX, y: toRoom.door.y }, toRoom.door);
  }
  points.push(to);

  // Tira pontos repetidos em sequência (ex.: portas no mesmo andar, corredor reto).
  const route: Point[] = [];
  let last = from;
  for (const p of points) {
    if (!same(p, last)) {
      route.push(p);
      last = p;
    }
  }
  return route;
}

/**
 * Avança `distance` pixels ao longo do trajeto. Devolve a nova posição e o trajeto que sobrou.
 */
export function advance(
  position: Point,
  path: Point[],
  distance: number,
): { position: Point; path: Point[] } {
  let { x, y } = position;
  let left = distance;
  let index = 0;
  while (index < path.length && left > 0) {
    const next = path[index];
    const dx = next.x - x;
    const dy = next.y - y;
    const dist = Math.hypot(dx, dy);
    if (dist <= left) {
      x = next.x;
      y = next.y;
      left -= dist;
      index++;
    } else {
      x += (dx / dist) * left;
      y += (dy / dist) * left;
      left = 0;
    }
  }
  return { position: { x, y }, path: path.slice(index) };
}
