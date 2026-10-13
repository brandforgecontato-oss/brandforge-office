"use client";

/**
 * Cena do escritório BrandForge: planta com salas, postos fixos e avatares planos.
 * Renderizada dentro do <Application> do OfficeGame quando a sessão é a do escritório.
 */

import { useCallback, useMemo, type ReactNode } from "react";
import { extend } from "@pixi/react";
import { Container, Graphics, Text } from "pixi.js";
import { useShallow } from "zustand/react/shallow";
import { useGameStore, selectAgents, selectBoss } from "@/stores/gameStore";
import { useBrandforgeStore } from "@/stores/brandforgeStore";
import { PlacarKanbanMode } from "@/components/game/whiteboard/PlacarKanbanMode";
import { Avatar, SceneBubble, SceneText } from "./Avatar";
import { buildAvatars } from "./avatars";
import {
  FONT_DISPLAY,
  PALETTE,
  drawBackground,
  drawBoardFrame,
  drawDebateTable,
  drawDeliveryTray,
  drawPlantInto,
  drawRoom,
} from "./draw";
import {
  CORRIDOR,
  DEBATE_TABLE,
  PLACAR_BOARD,
  ROOMS,
  VISITOR_AREA,
  roomById,
} from "./layout";

extend({ Container, Graphics, Text });

const LEGEND_ITEMS: { color: number; label: string; ring?: boolean }[] = [
  { color: PALETTE.gold, label: "trabalhando" },
  { color: PALETTE.waiting, label: "espera permissão" },
  { color: PALETTE.inkDim, label: "parado", ring: true },
];

function drawLegendDots(g: Graphics): void {
  g.clear();
  LEGEND_ITEMS.forEach((item, i) => {
    g.circle(-48, i * 18, 4.5);
    if (item.ring) g.stroke({ width: 1.5, color: item.color, alpha: 0.7 });
    else g.fill(item.color);
  });
}

function Legend(): ReactNode {
  return (
    <pixiContainer x={CORRIDOR.x + CORRIDOR.w / 2} y={CORRIDOR.y + 520}>
      <pixiGraphics draw={drawLegendDots} />
      {LEGEND_ITEMS.map((item, i) => (
        <SceneText
          key={item.label}
          text={item.label}
          x={-38}
          y={i * 18}
          size={12}
          color={PALETTE.inkDim}
          anchorX={0}
        />
      ))}
    </pixiContainer>
  );
}

function Wordmark(): ReactNode {
  const x = CORRIDOR.x + CORRIDOR.w / 2;
  return (
    <>
      <SceneText
        text="BrandForge"
        x={x}
        y={CORRIDOR.y + 52}
        size={27}
        weight="600"
        font={FONT_DISPLAY}
        color={PALETTE.gold}
      />
      <SceneText
        text="ESCRITÓRIO DE AGENTES"
        x={x}
        y={CORRIDOR.y + 84}
        size={9.5}
        weight="600"
        color={PALETTE.inkDim}
        letterSpacing={1.6}
      />
    </>
  );
}

function drawVisitorRule(g: Graphics): void {
  g.clear();
  g.rect(VISITOR_AREA.x + 24, VISITOR_AREA.y, VISITOR_AREA.w - 48, 1);
  g.fill({ color: PALETTE.gold, alpha: 0.2 });
}

function VisitorsLabel(): ReactNode {
  return (
    <>
      <pixiGraphics draw={drawVisitorRule} />
      <SceneText
        text="VISITANTES"
        x={VISITOR_AREA.x + VISITOR_AREA.w / 2}
        y={VISITOR_AREA.y + 20}
        size={11}
        weight="600"
        color={PALETTE.inkDim}
        letterSpacing={1.6}
      />
    </>
  );
}

export function BrandforgeScene(): ReactNode {
  const roster = useBrandforgeStore((s) => s.roster);
  const agents = useGameStore(useShallow(selectAgents));
  const boss = useGameStore(selectBoss);

  const models = useMemo(
    () => buildAvatars(roster, agents.values(), boss),
    [roster, agents, boss],
  );

  const tray = roomById("revisao");
  const orqRoom = roomById("orquestrador");
  const prodRoom = roomById("producao");
  const roteiroRoom = roomById("roteiro");

  const drawPlants = useCallback(
    (g: Graphics) => {
      g.clear();
      drawPlantInto(g, orqRoom.x + 30, orqRoom.y + orqRoom.h - 24);
      drawPlantInto(g, prodRoom.x + prodRoom.w - 30, prodRoom.y + 70);
      drawPlantInto(
        g,
        roteiroRoom.x + roteiroRoom.w - 30,
        roteiroRoom.y + roteiroRoom.h - 24,
      );
    },
    [orqRoom, prodRoom, roteiroRoom],
  );
  const drawTray = useCallback(
    (g: Graphics) => drawDeliveryTray(g, tray.x + tray.w - 190, tray.y + 150),
    [tray],
  );
  const drawBoard = useCallback(
    (g: Graphics) => drawBoardFrame(g, PLACAR_BOARD.w, PLACAR_BOARD.h),
    [],
  );

  return (
    <>
      <pixiGraphics draw={drawBackground} />
      <Wordmark />
      <Legend />
      <VisitorsLabel />

      {ROOMS.map((room) => (
        <pixiContainer key={room.id}>
          <pixiGraphics draw={(g: Graphics) => drawRoom(g, room)} />
          <SceneText
            text={room.label}
            x={room.x + 32}
            y={room.y + 30}
            size={21}
            weight="600"
            font={FONT_DISPLAY}
            color={PALETTE.cream}
            anchorX={0}
          />
        </pixiContainer>
      ))}

      <pixiGraphics draw={drawDebateTable} />
      <SceneText
        text="DEBATE"
        x={DEBATE_TABLE.x}
        y={DEBATE_TABLE.y}
        size={12}
        weight="600"
        color={PALETTE.gold}
        letterSpacing={2}
      />
      <pixiGraphics draw={drawPlants} />
      <pixiGraphics draw={drawTray} />
      <SceneText
        text="ENTREGA"
        x={tray.x + tray.w - 115}
        y={tray.y + 240}
        size={11}
        weight="600"
        color={PALETTE.inkDim}
        letterSpacing={1.6}
      />

      {/* Quadro do placar na parede da sala do Orquestrador */}
      <pixiContainer x={PLACAR_BOARD.x} y={PLACAR_BOARD.y}>
        <pixiGraphics draw={drawBoard} />
        <SceneText
          text="PLACAR DE APROVAÇÃO"
          x={16}
          y={14}
          size={11}
          weight="600"
          color={PALETTE.gold}
          letterSpacing={1.4}
          anchorX={0}
        />
        <pixiContainer x={14} y={28}>
          <PlacarKanbanMode />
        </pixiContainer>
      </pixiContainer>

      {models.map((model) => (
        <Avatar key={model.key} model={model} />
      ))}

      {/* Balões por cima de tudo */}
      {models
        .filter((m) => m.bubble)
        .map((m) => (
          <SceneBubble
            key={`bolha-${m.key}`}
            content={m.bubble!}
            x={m.position.x}
            y={m.position.y}
          />
        ))}
    </>
  );
}
