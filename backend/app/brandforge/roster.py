"""Elenco do escritório BrandForge.

Fonte: ``docs/spec/escritorio-brandforge.md`` (seção 2) do repositório do escritório.
A chave de cada entrada é o nome do arquivo do agente em ``.claude/agents/`` e é também
o ``subagent_type`` que o Claude Code envia nos hooks. O Entregador é um script, não
um agente, e por isso não aparece aqui.
"""

from dataclasses import dataclass

from app.models.agents import Agent

__all__ = ["ROSTER", "RosterEntry", "apply_identity", "lookup"]


@dataclass(frozen=True)
class RosterEntry:
    slug: str
    name: str
    role: str
    inspiration: str
    model: str
    color: str


_ENTRIES = (
    RosterEntry(
        "orquestrador",
        "Orquestrador",
        "Conversa com o usuário, monta as propostas e coordena todos os agentes",
        "Walt Disney",
        "Opus",
        "#F59E0B",
    ),
    RosterEntry(
        "critico",
        "Crítico",
        "Ataca propostas e cronogramas em 3 rodadas e dá o veredito",
        "Steve Jobs (fase exigente)",
        "Opus",
        "#EF4444",
    ),
    RosterEntry(
        "cacador-de-tendencias",
        "Caçador de Tendências",
        "Pesquisa formatos, áudios e assuntos em alta no nicho, com evidência",
        "Paddy Galloway",
        "Sonnet",
        "#14B8A6",
    ),
    RosterEntry(
        "estrategista",
        "Estrategista",
        "Cria o cronograma de temas com variedade de formatos e pilares",
        "Gary Vaynerchuk",
        "Sonnet",
        "#3B82F6",
    ),
    RosterEntry(
        "roteirista",
        "Roteirista",
        "Escreve promessa, gancho, retenção e roteiro cena a cena",
        "MrBeast",
        "Sonnet",
        "#A855F7",
    ),
    RosterEntry(
        "copywriter",
        "Copywriter",
        "Escreve legendas, CTA e hashtags para Instagram e TikTok",
        "Flávio Augusto",
        "Sonnet",
        "#EC4899",
    ),
    RosterEntry(
        "diretor-de-motion",
        "Diretor de Motion",
        "Transforma o roteiro em motion graphics no HyperFrames",
        "Saul Bass",
        "Sonnet",
        "#F97316",
    ),
    RosterEntry(
        "designer-de-posts",
        "Designer de Posts",
        "Cria posts estáticos e carrosséis como composições HyperFrames",
        "Massimo Vignelli",
        "Sonnet",
        "#84CC16",
    ),
    RosterEntry(
        "editor-de-video",
        "Editor de Vídeo",
        "Edita os vídeos gravados pelos sócios: cortes em J, layouts e legendas",
        "Walter Murch",
        "Sonnet",
        "#06B6D4",
    ),
    RosterEntry(
        "revisor",
        "Revisor",
        "Última barreira de qualidade: confere quadros, marca, ortografia e fidelidade",
        "Dieter Rams",
        "Sonnet",
        "#E2E8F0",
    ),
    RosterEntry(
        "analista",
        "Analista",
        "Registra feedback e estatísticas na memória de aprendizado",
        "Billy Beane",
        "Haiku",
        "#22C55E",
    ),
)

ROSTER: dict[str, RosterEntry] = {entry.slug: entry for entry in _ENTRIES}


def lookup(agent_type: str | None) -> RosterEntry | None:
    """Acha o agente do elenco pelo tipo recebido do Claude Code, ou ``None``.

    Aceita variações de caixa, espaços e prefixo de plugin (``plugin:critico``).
    """
    if not agent_type:
        return None
    slug = agent_type.strip().rsplit(":", 1)[-1].strip().lower()
    return ROSTER.get(slug)


def apply_identity(agent: Agent, agent_type: str | None) -> bool:
    """Dá ao ``agent`` o nome, a cor e o tipo fixos do elenco.

    Retorna ``False`` (sem mexer em nada) quando o tipo não é do escritório.
    """
    entry = lookup(agent_type)
    if entry is None:
        return False
    agent.name = entry.name
    agent.color = entry.color
    agent.agent_type = entry.slug
    return True
