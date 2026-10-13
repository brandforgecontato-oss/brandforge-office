"use client";

/**
 * Cartão de um agente do escritório BrandForge: nome, função e inspiração.
 * A cor de cada agente é fixa (vem do elenco do backend).
 */

import type { ReactNode } from "react";
import type { RosterEntry } from "@/stores/brandforgeStore";
import { formatStateLabel } from "@/utils/stateLabels";
import { cleanTask } from "./scene/avatars";

interface AgentCardProps {
  entry: RosterEntry;
  /** Estado atual, em palavras do Claude Office (ex.: "working"). */
  state?: string | null;
  /** O que o agente está fazendo agora. */
  task?: string | null;
}

export default function AgentCard({
  entry,
  state,
  task,
}: AgentCardProps): ReactNode {
  return (
    <div data-testid="agent-card">
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-3 h-3 rounded-full shrink-0"
          style={{ backgroundColor: entry.color }}
        />
        <span className="text-white font-bold text-sm truncate flex-1">
          {entry.name}
        </span>
        <span className="text-neutral-500 text-[11px]">{entry.model}</span>
      </div>

      <p className="text-[12px] text-neutral-300 mb-2 leading-snug">
        {entry.role}
      </p>

      <div className="text-[12px] text-neutral-400 space-y-1 mb-3">
        <div>
          <span className="text-neutral-600">Inspiração:</span>{" "}
          {entry.inspiration}
        </div>
        {state && (
          <div>
            <span className="text-neutral-600">Estado:</span>{" "}
            {formatStateLabel(state, "pt-BR")}
          </div>
        )}
        {cleanTask(task) && (
          <div className="line-clamp-3">
            <span className="text-neutral-600">Tarefa:</span> {cleanTask(task)}
          </div>
        )}
      </div>
    </div>
  );
}
