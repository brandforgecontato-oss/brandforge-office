"""Fluxo completo: o evento de subagente do Claude Code vira o agente do elenco no escritório."""

import asyncio
from datetime import UTC, datetime

from app.core.event_processor import event_processor
from app.models.events import EventAdapter, EventType


def _event(session_id: str, event_type: EventType, data: dict[str, object]):
    return EventAdapter.validate_python(
        {
            "event_type": event_type,
            "session_id": session_id,
            "timestamp": datetime.now(UTC),
            "data": data,
        }
    )


def test_subagent_start_do_critico_vira_o_agente_fixo() -> None:
    async def run() -> list[tuple[str | None, str | None, str]]:
        sid = "flow-critico-1"
        await event_processor.process_event(_event(sid, EventType.SESSION_START, {}))
        await event_processor.process_event(
            _event(
                sid,
                EventType.SUBAGENT_START,
                {
                    "agent_id": "subagent_toolu_c1",
                    "agent_name": "Critico rodada 1",
                    "task_description": "Ataque a proposta em saida/x/debate.md. Rodada 1.",
                    "agent_type": "critico",
                },
            )
        )
        await event_processor.process_event(
            _event(
                sid,
                EventType.SUBAGENT_START,
                {
                    "agent_id": "subagent_toolu_r1",
                    "agent_name": "Roteiro",
                    "task_description": "Escreva o roteiro.",
                    "agent_type": "roteirista",
                },
            )
        )
        state = await event_processor.get_current_state(sid)
        assert state is not None
        return [(a.name, a.agent_type, a.color) for a in state.agents]

    agentes = asyncio.run(run())
    assert agentes == [
        ("Crítico", "critico", "#EF4444"),
        ("Roteirista", "roteirista", "#A855F7"),
    ]
