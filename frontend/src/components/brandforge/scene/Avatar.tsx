"use client";

/**
 * Avatar plano do escritório BrandForge: círculo na cor do agente, com iniciais, nome e
 * a tarefa do momento. Parado fica apagado; trabalhando fica aceso, com um anel que pulsa.
 * Anda até a mesa de debate (e volta) em linhas retas pelas portas das salas.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTick } from "@pixi/react";
import type { Container, Graphics } from "pixi.js";
import { CANVAS_WIDTH } from "@/constants/canvas";
import { useAttentionStore } from "@/stores/attentionStore";
import type { BubbleContent } from "@/types";
import { truncateBubbleText } from "@/utils/bubbleText";
import { initials, type AvatarModel } from "./avatars";
import {
  FONT_UI,
  PALETTE,
  drawDesk,
  drawSpeechBubble,
  hexToNumber,
  nameToLines,
  wrapText,
} from "./draw";
import type { Point } from "./layout";
import { WALK_SPEED, advance, planRoute } from "./route";

const RADIUS = 30;
const NAME_SIZE = 13;
const NAME_LINE = 16;
const PILL_Y = 76;

/** Texto nítido: desenhado em dobro e reduzido à metade (mesma técnica do resto do jogo). */
export function SceneText({
  text,
  x = 0,
  y = 0,
  size,
  color,
  weight = "400",
  font = FONT_UI,
  anchorX = 0.5,
  anchorY = 0.5,
  letterSpacing = 0,
  align = "center",
}: {
  text: string;
  x?: number;
  y?: number;
  size: number;
  color: number | string;
  weight?: "400" | "600" | "700";
  font?: string;
  anchorX?: number;
  anchorY?: number;
  letterSpacing?: number;
  align?: "left" | "center";
}): ReactNode {
  return (
    <pixiContainer x={x} y={y} scale={0.5}>
      <pixiText
        text={text}
        anchor={{ x: anchorX, y: anchorY }}
        resolution={2}
        style={{
          fontFamily: font,
          fontSize: size * 2,
          fontWeight: weight,
          fill: color,
          letterSpacing: letterSpacing * 2,
          align,
          lineHeight: size * 2 * 1.3,
        }}
      />
    </pixiContainer>
  );
}

/** Mesa e notebook de um posto (fica parada; o avatar anda). */
export function StationDesk({
  home,
  lit,
}: {
  home: Point;
  lit: boolean;
}): ReactNode {
  const draw = useCallback((g: Graphics) => drawDesk(g, lit), [lit]);
  return (
    <pixiContainer x={home.x} y={home.y}>
      <pixiGraphics draw={draw} />
    </pixiContainer>
  );
}

/** Balão de fala acima do avatar. */
function SceneBubble({ content }: { content: BubbleContent }): ReactNode {
  const lines = wrapText(truncateBubbleText(content.text), 26);
  const longest = Math.max(...lines.map((l) => l.length), 8);
  const w = Math.max(96, longest * 8.2 + 28);
  const h = lines.length * 19 + 20;
  const draw = useCallback((g: Graphics) => drawSpeechBubble(g, w, h), [w, h]);

  return (
    <pixiContainer y={-RADIUS - 14}>
      <pixiGraphics draw={draw} />
      <SceneText
        text={lines.join("\n")}
        y={-h / 2}
        size={14}
        weight="600"
        color={PALETTE.canvas}
      />
    </pixiContainer>
  );
}

export function Avatar({ model }: { model: AvatarModel }): ReactNode {
  const openFocusPopup = useAttentionStore((s) => s.openFocusPopup);
  const groupRef = useRef<Container>(null);
  const ringRef = useRef<Graphics>(null);
  // Posição e trajeto vivem em refs: o avatar anda a 60 quadros por segundo sem re-renderizar.
  const [start] = useState(() => ({
    x: model.position.x,
    y: model.position.y,
  }));
  const motion = useRef<{ pos: Point; path: Point[] }>({
    pos: { x: 0, y: 0 },
    path: [],
  });
  // Na montagem o avatar já nasce no destino (só anda quando o destino muda depois).
  useEffect(() => {
    motion.current.pos = { x: start.x, y: start.y };
  }, [start]);

  const color = hexToNumber(model.color);
  const offline = model.activity === "offline";
  const active = model.activity === "active";
  const waiting = model.activity === "waiting";
  const lit = active || waiting;
  const ringColor = waiting ? PALETTE.waiting : PALETTE.gold;
  const nameLines = nameToLines(model.name);
  const longestLine = Math.max(...nameLines.map((l) => l.length));
  const pillH = nameLines.length * NAME_LINE + 8;

  // Novo destino (ex.: foi para a mesa de debate): traça o trajeto a partir de onde está.
  const targetX = model.position.x;
  const targetY = model.position.y;
  useEffect(() => {
    const m = motion.current;
    m.path = planRoute(m.pos, { x: targetX, y: targetY });
  }, [targetX, targetY, motion]);

  useTick((ticker) => {
    const group = groupRef.current;
    if (!group) return;
    const m = motion.current;
    if (m.path.length > 0) {
      const step = (WALK_SPEED * ticker.deltaMS) / 1000;
      const next = advance(m.pos, m.path, step);
      m.pos = next.position;
      m.path = next.path;
    }
    group.position.set(m.pos.x, m.pos.y);

    // Anel que pulsa enquanto o agente trabalha (ou espera uma permissão).
    const ring = ringRef.current;
    if (!ring) return;
    if (!lit) {
      ring.alpha = 0;
      return;
    }
    const t = ticker.lastTime / 1000;
    const wave = Math.sin(t * (waiting ? 7 : 3.2));
    ring.alpha = 0.55 + 0.45 * wave;
    ring.scale.set(1 + 0.05 * wave);
  });

  const drawBody = useCallback(
    (g: Graphics) => {
      g.clear();
      g.ellipse(0, RADIUS + 3, RADIUS * 0.95, 6);
      g.fill({ color: 0x000000, alpha: 0.3 });
      if (offline) {
        g.circle(0, 0, RADIUS);
        g.fill(PALETTE.roomFloor);
        g.circle(0, 0, RADIUS);
        g.stroke({ width: 1.5, color, alpha: 0.45 });
      } else {
        g.circle(0, 0, RADIUS);
        g.fill({ color, alpha: lit ? 1 : 0.6 });
        g.circle(-7, -8, 9);
        g.fill({ color: 0xffffff, alpha: lit ? 0.16 : 0.08 });
      }
    },
    [color, offline, lit],
  );

  const drawRing = useCallback(
    (g: Graphics) => {
      g.clear();
      g.circle(0, 0, RADIUS + 7);
      g.stroke({ width: 2.5, color: ringColor });
    },
    [ringColor],
  );

  const drawPill = useCallback(
    (g: Graphics) => {
      const w = Math.max(60, longestLine * 7.9 + 22);
      g.clear();
      g.roundRect(-w / 2, 0, w, pillH, Math.min(11, pillH / 2));
      g.fill({ color: PALETTE.canvas, alpha: 0.9 });
      g.roundRect(-w / 2, 0, w, pillH, Math.min(11, pillH / 2));
      g.stroke({ width: 1, color, alpha: offline ? 0.3 : 0.8 });
    },
    [longestLine, pillH, color, offline],
  );

  const handleTap = useCallback(() => {
    if (!model.focusId) return;
    const canvas = document.querySelector(".pixi-canvas-container canvas");
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scale = rect.width / CANVAS_WIDTH;
    const { pos } = motion.current;
    openFocusPopup(
      model.focusId,
      rect.left + pos.x * scale,
      rect.top + pos.y * scale,
    );
  }, [model.focusId, openFocusPopup, motion]);

  const task = model.task ? truncateBubbleText(model.task, 28) : null;

  return (
    <pixiContainer ref={groupRef} x={start.x} y={start.y}>
      <pixiGraphics ref={ringRef} draw={drawRing} alpha={0} />
      {/* O clique fica no corpo do avatar: um Container sem hitArea não recebe eventos no Pixi 8. */}
      <pixiGraphics
        draw={drawBody}
        eventMode={model.focusId ? "static" : "none"}
        cursor={model.focusId ? "pointer" : "default"}
        onPointerTap={handleTap}
      />
      <SceneText
        text={initials(model.name)}
        size={18}
        weight="700"
        color={offline ? PALETTE.inkDim : PALETTE.canvas}
      />
      <pixiContainer y={PILL_Y} alpha={offline ? 0.45 : 1}>
        <pixiGraphics draw={drawPill} />
        <SceneText
          text={nameLines.join("\n")}
          y={pillH / 2}
          size={NAME_SIZE}
          weight="600"
          color={PALETTE.cream}
        />
      </pixiContainer>
      {lit && task && (
        <SceneText
          text={task}
          y={PILL_Y + pillH + 14}
          size={12}
          color={waiting ? PALETTE.waiting : PALETTE.gold}
        />
      )}
      {model.bubble && <SceneBubble content={model.bubble} />}
    </pixiContainer>
  );
}
