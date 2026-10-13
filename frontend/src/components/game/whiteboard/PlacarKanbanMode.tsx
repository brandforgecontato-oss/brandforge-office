"use client";

/**
 * PlacarKanbanMode - versão do quadro Kanban para o escritório BrandForge.
 *
 * No lugar das tarefas do Claude Code (TODO / IN PROGRESS / DONE), mostra o placar de
 * aprovação das peças: os seis status (pendente, em produção, entregue, aprovado, refazer,
 * travado) em duas fileiras de três colunas, lidos do backend (pasta saida/ do escritório).
 * Temas travados ficam com a borda vermelha.
 *
 * Hotkey: K
 */

import { Graphics } from "pixi.js";
import { type ReactNode, useMemo } from "react";
import {
  STATUS_COLORS,
  STATUS_LABELS,
  groupByStatus,
  usePlacarStore,
  type PlacarColumn,
} from "@/stores/placarStore";

// ============================================================================
// LAYOUT CONSTANTS
// ============================================================================

const BOARD_W = 310;
const COLS = 3;
const CELL_W = Math.floor(BOARD_W / COLS); // 103
const CELL_PAD = 3;
const HEADER_H = 14;
const NOTE_H = 17;
const NOTE_GAP = 2;
const MAX_NOTES = 2;
const CELL_H = HEADER_H + MAX_NOTES * (NOTE_H + NOTE_GAP) + 6; // 58
const ROW_GAP = 4;
const NOTE_CHARS = 17;

const hex = (color: string): number => parseInt(color.slice(1), 16);

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

// ============================================================================
// CELL
// ============================================================================

function PlacarCell({
  column,
  index,
}: {
  column: PlacarColumn;
  index: number;
}): ReactNode {
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  const x = col * CELL_W;
  const y = row * (CELL_H + ROW_GAP);
  const w = CELL_W - CELL_PAD;
  const headerColor = hex(STATUS_COLORS[column.status] ?? "#64748b");
  const locked = column.status === "travado" && column.pieces.length > 0;
  const visible = column.pieces.slice(0, MAX_NOTES);
  const extra = column.pieces.length - visible.length;

  return (
    <pixiContainer x={x} y={y}>
      <pixiGraphics
        draw={(g: Graphics) => {
          g.clear();
          g.roundRect(CELL_PAD / 2, 0, w, CELL_H, 2);
          g.fill({ color: locked ? 0xfee2e2 : 0xf8fafc, alpha: 0.9 });
          g.stroke({
            width: locked ? 2 : 1,
            color: locked ? 0xdc2626 : 0xcbd5e1,
          });
          g.roundRect(CELL_PAD / 2, 0, w, HEADER_H, 2);
          g.fill(headerColor);
        }}
      />

      <pixiContainer x={CELL_PAD / 2 + 4} y={HEADER_H / 2} scale={0.5}>
        <pixiText
          text={STATUS_LABELS[column.status] ?? column.status.toUpperCase()}
          anchor={{ x: 0, y: 0.5 }}
          style={{
            fontFamily: '"Courier New", monospace',
            fontSize: 15,
            fontWeight: "bold",
            fill: "#ffffff",
          }}
          resolution={2}
        />
      </pixiContainer>
      <pixiContainer x={CELL_PAD / 2 + w - 4} y={HEADER_H / 2} scale={0.5}>
        <pixiText
          text={String(column.pieces.length)}
          anchor={{ x: 1, y: 0.5 }}
          style={{
            fontFamily: '"Courier New", monospace',
            fontSize: 15,
            fontWeight: "bold",
            fill: "#ffffff",
          }}
          resolution={2}
        />
      </pixiContainer>

      {visible.map((piece, i) => (
        <pixiContainer
          key={piece.id}
          x={CELL_PAD / 2 + 3}
          y={HEADER_H + 3 + i * (NOTE_H + NOTE_GAP)}
        >
          <pixiGraphics
            draw={(g: Graphics) => {
              g.clear();
              g.roundRect(0, 0, w - 6, NOTE_H, 2);
              g.fill(locked ? 0xfecaca : 0xffffff);
              g.stroke({ width: 1, color: headerColor, alpha: 0.6 });
            }}
          />
          <pixiText
            text={truncate(piece.tema, NOTE_CHARS)}
            x={3}
            y={3}
            style={{
              fontFamily: '"Courier New", monospace',
              fontSize: 9,
              fontWeight: "bold",
              fill: locked ? "#7f1d1d" : "#1f2937",
            }}
            resolution={2}
          />
        </pixiContainer>
      ))}

      {extra > 0 && (
        <pixiContainer x={CELL_PAD / 2 + w / 2} y={CELL_H - 5} scale={0.5}>
          <pixiText
            text={`+${extra}`}
            anchor={0.5}
            style={{
              fontFamily: '"Courier New", monospace',
              fontSize: 14,
              fill: "#6b7280",
            }}
            resolution={2}
          />
        </pixiContainer>
      )}
    </pixiContainer>
  );
}

// ============================================================================
// MODE
// ============================================================================

export function PlacarKanbanMode(): ReactNode {
  const pieces = usePlacarStore((s) => s.pieces);
  const statuses = usePlacarStore((s) => s.statuses);
  const loaded = usePlacarStore((s) => s.loaded);
  const columns = useMemo(
    () => groupByStatus(pieces, statuses),
    [pieces, statuses],
  );

  return (
    <pixiContainer>
      {columns.map((column, i) => (
        <PlacarCell key={column.status} column={column} index={i} />
      ))}
      {loaded && pieces.length === 0 && (
        <pixiContainer x={BOARD_W / 2} y={CELL_H + ROW_GAP / 2} scale={0.5}>
          <pixiText
            text="Nenhuma peça ainda"
            anchor={0.5}
            style={{
              fontFamily: '"Courier New", monospace',
              fontSize: 18,
              fill: "#6b7280",
            }}
            resolution={2}
          />
        </pixiContainer>
      )}
    </pixiContainer>
  );
}
