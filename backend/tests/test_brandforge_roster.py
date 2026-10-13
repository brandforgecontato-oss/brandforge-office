"""Elenco do escritório BrandForge: identidade fixa de cada agente."""

from pathlib import Path

import pytest

from app.brandforge.roster import ROSTER, apply_identity, lookup
from app.core.state_machine import StateMachine
from app.models.agents import Agent, AgentState
from app.models.events import AgentEventData

# Os 11 agentes da especificação (seção 2); o Entregador é script e não aparece.
ESPERADOS = {
    "orquestrador",
    "critico",
    "cacador-de-tendencias",
    "estrategista",
    "roteirista",
    "copywriter",
    "diretor-de-motion",
    "designer-de-posts",
    "editor-de-video",
    "revisor",
    "analista",
}


def test_roster_tem_os_11_agentes() -> None:
    assert set(ROSTER) == ESPERADOS


def test_cada_agente_tem_nome_funcao_inspiracao_e_cor() -> None:
    for entry in ROSTER.values():
        assert entry.name and entry.role and entry.inspiration
        assert entry.color.startswith("#") and len(entry.color) == 7


def test_cores_sao_unicas() -> None:
    cores = [e.color.lower() for e in ROSTER.values()]
    assert len(cores) == len(set(cores))


def test_inspiracoes_conferem_com_a_especificacao() -> None:
    assert ROSTER["orquestrador"].inspiration == "Walt Disney"
    assert ROSTER["critico"].inspiration == "Steve Jobs (fase exigente)"
    assert ROSTER["revisor"].inspiration == "Dieter Rams"


def test_lookup_aceita_variacoes_do_tipo() -> None:
    assert lookup("critico") is ROSTER["critico"]
    assert lookup("Critico") is ROSTER["critico"]
    assert lookup(" plugin:critico ") is ROSTER["critico"]
    assert lookup("general-purpose") is None
    assert lookup(None) is None
    assert lookup("") is None


def test_apply_identity_define_nome_cor_e_tipo() -> None:
    agent = Agent(id="a", name="Qualquer", color="#000000", number=1, state=AgentState.WORKING)
    assert apply_identity(agent, "critico") is True
    assert agent.name == "Crítico"
    assert agent.color == ROSTER["critico"].color
    assert agent.agent_type == "critico"


def test_apply_identity_ignora_tipo_desconhecido() -> None:
    agent = Agent(id="a", name="Qualquer", color="#123456", number=1, state=AgentState.WORKING)
    assert apply_identity(agent, "general-purpose") is False
    assert agent.name == "Qualquer"
    assert agent.color == "#123456"
    assert agent.agent_type is None


def test_create_agent_usa_identidade_do_elenco() -> None:
    sm = StateMachine()
    agent = sm.create_agent(
        AgentEventData(agent_id="subagent_1", agent_type="roteirista", task_description="roteiro")
    )
    assert agent.name == "Roteirista"
    assert agent.color == ROSTER["roteirista"].color
    assert agent.agent_type == "roteirista"


def test_create_agent_fora_do_elenco_mantem_comportamento_original() -> None:
    sm = StateMachine()
    agent = sm.create_agent(
        AgentEventData(agent_id="subagent_2", agent_type="general-purpose", task_description="x")
    )
    assert agent.name  # nome gerado como sempre
    assert agent.color in {
        "#3B82F6", "#22C55E", "#A855F7", "#F97316",
        "#EC4899", "#06B6D4", "#EAB308", "#EF4444",
    }  # fmt: skip


def test_dois_subagentes_do_mesmo_tipo_nao_perdem_o_nome_fixo() -> None:
    sm = StateMachine()
    primeiro = sm.create_agent(AgentEventData(agent_id="s1", agent_type="critico"))
    sm.agents["s1"] = primeiro
    segundo = sm.create_agent(AgentEventData(agent_id="s2", agent_type="critico"))
    assert segundo.name == "Crítico"


def test_nomes_do_elenco_existem_como_arquivos_de_agente_quando_o_escritorio_esta_ao_lado() -> None:
    """Se a pasta irmã existir, cada slug do elenco é um agente real de lá."""
    agentes = Path(__file__).resolve().parents[3] / "escritorio_marketingBF" / ".claude" / "agents"
    if not agentes.is_dir():
        pytest.skip("pasta do escritório não encontrada")
    arquivos = {p.stem for p in agentes.glob("*.md")}
    assert set(ROSTER) <= arquivos


@pytest.mark.asyncio
async def test_enriquecimento_nao_troca_o_nome_fixo_do_elenco() -> None:
    from app.core.handlers.agent_handler import enrich_agent_with_summaries

    agent = Agent(id="a", name="Crítico", color="#EF4444", number=1, state=AgentState.WORKING)
    data = AgentEventData(
        agent_id="a", agent_type="revisor", agent_name="conferir peça", task_description="confira"
    )
    await enrich_agent_with_summaries(agent, data, set())
    assert agent.name == "Revisor"
    assert agent.agent_type == "revisor"
    assert agent.color == ROSTER["revisor"].color


@pytest.mark.asyncio
async def test_enriquecimento_de_tipo_fora_do_elenco_nao_altera_cor() -> None:
    from app.core.handlers.agent_handler import enrich_agent_with_summaries

    agent = Agent(id="a", name="X", color="#123456", number=1, state=AgentState.WORKING)
    data = AgentEventData(agent_id="a", agent_type="general-purpose", task_description="faz algo")
    await enrich_agent_with_summaries(agent, data, set())
    assert agent.color == "#123456"
    assert agent.agent_type is None
