"use client";

/**
 * Placar de aprovação: quadro Kanban com os seis status das peças. Temas travados (3
 * reprovações do Crítico) ficam em destaque: o Silvestre decide se dá nova ideia, edita o
 * tema ou descarta.
 */

import { useEffect, useMemo, type ReactNode } from "react";
import {
  STATUS_COLORS,
  STATUS_LABELS,
  groupByStatus,
  usePlacarStore,
  type PlacarPiece,
} from "@/stores/placarStore";

const POLL_MS = 4000;

/** Consulta o placar em intervalo enquanto o escritório está aberto. */
export function usePlacarSync(): void {
  const fetchPlacar = usePlacarStore((s) => s.fetchPlacar);
  useEffect(() => {
    void fetchPlacar();
    const timer = setInterval(() => void fetchPlacar(), POLL_MS);
    return () => clearInterval(timer);
  }, [fetchPlacar]);
}

function PieceCard({
  piece,
  locked,
}: {
  piece: PlacarPiece;
  locked: boolean;
}): ReactNode {
  return (
    <div
      data-testid={locked ? "piece-locked" : "piece"}
      className={`rounded-lg border px-2 py-1.5 text-[12px] leading-snug ${
        locked
          ? "border-red-500 bg-red-950/60 text-red-50 ring-1 ring-red-500/60"
          : "border-neutral-700 bg-neutral-800 text-neutral-100"
      }`}
    >
      <div className="font-semibold">{piece.tema}</div>
      {piece.formato && (
        <div className="text-[10px] uppercase tracking-wide opacity-60">
          {piece.formato}
        </div>
      )}
      {piece.motivo && (
        <div className="mt-1 text-[11px] text-amber-200/90">
          Motivo: {piece.motivo}
        </div>
      )}
      {locked && (
        <div className="mt-1 text-[11px] text-red-200">
          3 reprovações. Decida: nova ideia, editar o tema ou descartar.
        </div>
      )}
    </div>
  );
}

export default function PlacarBoard({
  onClose,
}: {
  onClose: () => void;
}): ReactNode {
  const pieces = usePlacarStore((s) => s.pieces);
  const statuses = usePlacarStore((s) => s.statuses);
  const loaded = usePlacarStore((s) => s.loaded);
  const columns = useMemo(
    () => groupByStatus(pieces, statuses),
    [pieces, statuses],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex max-h-full w-full max-w-[84rem] flex-col rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl"
        data-testid="placar-board"
      >
        <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
          <div>
            <h2 className="text-base font-bold text-white">
              Placar de aprovação
            </h2>
            <p className="text-[11px] text-neutral-500">
              Atualiza sozinho a partir da pasta saida/ do escritório.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg bg-neutral-800 px-3 py-1 text-xs font-bold text-neutral-300 hover:bg-neutral-700"
          >
            Fechar
          </button>
        </div>

        <div className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto p-4 md:grid-cols-3 xl:grid-cols-6">
          {columns.map((column) => {
            const locked = column.status === "travado";
            return (
              <section
                key={column.status}
                data-testid={`column-${column.status}`}
                className={`rounded-lg border p-2 ${
                  locked && column.pieces.length > 0
                    ? "border-red-600 bg-red-950/30"
                    : "border-neutral-800 bg-neutral-950/60"
                }`}
              >
                <header
                  className="mb-2 flex items-center justify-between rounded px-2 py-1 text-[11px] font-bold text-white"
                  style={{ backgroundColor: STATUS_COLORS[column.status] }}
                >
                  <span>
                    {STATUS_LABELS[column.status] ??
                      column.status.toUpperCase()}
                  </span>
                  <span>{column.pieces.length}</span>
                </header>
                <div className="space-y-2">
                  {column.pieces.length === 0 ? (
                    <p className="px-1 text-[11px] text-neutral-600">—</p>
                  ) : (
                    column.pieces.map((piece) => (
                      <PieceCard key={piece.id} piece={piece} locked={locked} />
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>

        {loaded && pieces.length === 0 && (
          <p className="px-4 pb-4 text-xs text-neutral-500">
            Nenhuma peça ainda. Peça uma ideia ao Orquestrador no chat.
          </p>
        )}
      </div>
    </div>
  );
}
