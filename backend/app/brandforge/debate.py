"""Leitura do ``debate.md`` das peças: objeções do Crítico e respostas do Orquestrador.

O formato é o do protocolo de debate do escritório (skill ``protocolo-debate``):

    # Tentativa 1
    ## Proposta v1 — tema
    ## Crítica — rodada 1
    ### Objeções
    R1.1 [séria] (Critério) — a objeção.
       Motivo concreto: ...
       O que resolveria: ...
    ### Resposta do Orquestrador — rodada 1
    R1.1 — ACEITAR: o que mudou.
    ...
    ## Crítica — rodada 3
    ### Veredito
    APROVADA COM RESSALVAS

O parser é tolerante: linhas que não reconhece são ignoradas, nunca quebram a leitura.
"""

import re
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from app.brandforge.paths import saida_dir

__all__ = ["Debate", "find_debates", "parse_debate"]

MAX_TEXT = 1500
MAX_ATTEMPTS_BEFORE_LOCK = 3


class _Model(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class Objection(_Model):
    id: str
    gravity: str
    criterion: str
    text: str
    reason: str = ""
    fix: str = ""


class Answer(_Model):
    ids: list[str]
    action: str  # ACEITAR | REBATER | ASSUMIR RISCO
    text: str


class Status(_Model):
    id: str
    status: str
    note: str = ""


class Round(_Model):
    round: int
    objections: list[Objection] = Field(default_factory=lambda: [])
    answers: list[Answer] = Field(default_factory=lambda: [])
    statuses: list[Status] = Field(default_factory=lambda: [])


class Proposal(_Model):
    version: int
    title: str


class Attempt(_Model):
    number: int
    proposals: list[Proposal] = Field(default_factory=lambda: [])
    rounds: list[Round] = Field(default_factory=lambda: [])
    verdict: str | None = None
    verdict_notes: list[str] = Field(default_factory=lambda: [])


class Debate(_Model):
    piece: str
    title: str
    kind: str  # "peca" | "cronograma"
    attempts: list[Attempt] = Field(default_factory=lambda: [])
    verdict: str | None = None
    state: str = "em debate"
    current_round: int = 0
    updated_at: str | None = None


# --- expressões ---------------------------------------------------------------------------------

_DASH = r"[—–-]"
_RE_TITLE = re.compile(rf"^#\s+Debate\s*{_DASH}\s*(.+)$")
_RE_ATTEMPT = re.compile(r"^#\s+Tentativa\s+(\d+)")
_RE_PROPOSAL = re.compile(rf"^##\s+Proposta\s+v(\d+)\s*(?:{_DASH}\s*(.*))?$")
_RE_CRITIQUE = re.compile(r"^##\s+Cr[ií]tica\b.*?rodada\s+(\d+)", re.IGNORECASE)
_RE_ANSWER_HEAD = re.compile(r"^###\s+Resposta do Orquestrador\b.*?rodada\s+(\d+)", re.IGNORECASE)
_RE_STATUS_HEAD = re.compile(r"^###\s+Status das obje", re.IGNORECASE)
_RE_OBJECTIONS_HEAD = re.compile(r"^###\s+Obje[cç][õo]es", re.IGNORECASE)
_RE_VERDICT_HEAD = re.compile(r"^#{2,3}\s+Veredito", re.IGNORECASE)
_RE_ANY_HEAD = re.compile(r"^#{1,3}\s")
_RE_OBJECTION = re.compile(rf"^(R\d+\.\d+)\s*\[([^\]]+)\]\s*\(([^)]*)\)\s*{_DASH}\s*(.*)$")
_RE_ANSWER = re.compile(
    rf"^(R\d+\.\d+(?:\s*\+\s*R\d+\.\d+)*)\s*{_DASH}\s*(ACEITAR|REBATER|ASSUMIR RISCO)\s*:?\s*(.*)$"
)
_RE_STATUS = re.compile(
    rf"^[-*]\s*(R\d+\.\d+)\s*{_DASH}\s*(resolvida|mantida|risco aceito|risco recusado)\b(.*)$",
    re.IGNORECASE,
)
_RE_VERDICT = re.compile(r"(REPROVADA|APROVADA COM RESSALVAS|APROVADA)")
_RE_REASON = re.compile(r"^\s+Motivo concreto:\s*(.*)$")
_RE_FIX = re.compile(r"^\s+O que resolveria:\s*(.*)$")


def _cap(text: str) -> str:
    text = text.strip()
    return text if len(text) <= MAX_TEXT else text[: MAX_TEXT - 1].rstrip() + "…"


def _join(current: str, extra: str) -> str:
    return f"{current} {extra.strip()}".strip()


def _gravity(raw: str) -> str:
    value = raw.strip().lower()
    return "séria" if value == "seria" else value


@dataclass
class _Cursor:
    attempt: Attempt | None = None
    round: Round | None = None
    section: str | None = None  # objecoes | resposta | status | veredito | None
    objection: Objection | None = None
    field: str = "text"
    answer: Answer | None = None
    verdict_lines_seen: int = 0


def _ensure_attempt(debate: Debate, cursor: _Cursor) -> Attempt:
    if cursor.attempt is None:
        cursor.attempt = Attempt(number=1)
        debate.attempts.append(cursor.attempt)
    return cursor.attempt


def _get_round(attempt: Attempt, number: int) -> Round:
    for existing in attempt.rounds:
        if existing.round == number:
            return existing
    created = Round(round=number)
    attempt.rounds.append(created)
    return created


def parse_debate(text: str, piece: str) -> Debate:
    """Interpreta o conteúdo de um ``debate.md``."""
    kind = "cronograma" if piece.startswith("cronograma") else "peca"
    debate = Debate(piece=piece, title=piece, kind=kind)
    cursor = _Cursor()

    for raw_line in text.splitlines():
        line = raw_line.rstrip()

        if m := _RE_TITLE.match(line):
            debate.title = m.group(1).strip()
            continue
        if m := _RE_ATTEMPT.match(line):
            cursor = _Cursor(attempt=Attempt(number=int(m.group(1))))
            debate.attempts.append(cursor.attempt)  # type: ignore[arg-type]
            continue
        if m := _RE_PROPOSAL.match(line):
            attempt = _ensure_attempt(debate, cursor)
            attempt.proposals.append(
                Proposal(version=int(m.group(1)), title=(m.group(2) or "").strip())
            )
            cursor.section = None
            continue
        if m := _RE_CRITIQUE.match(line):
            attempt = _ensure_attempt(debate, cursor)
            cursor.round = _get_round(attempt, int(m.group(1)))
            cursor.section = None
            cursor.objection = cursor.answer = None
            continue
        if m := _RE_ANSWER_HEAD.match(line):
            attempt = _ensure_attempt(debate, cursor)
            cursor.round = _get_round(attempt, int(m.group(1)))
            cursor.section = "resposta"
            cursor.objection = cursor.answer = None
            continue
        if _RE_STATUS_HEAD.match(line):
            cursor.section, cursor.objection, cursor.answer = "status", None, None
            continue
        if _RE_OBJECTIONS_HEAD.match(line):
            cursor.section, cursor.objection, cursor.answer = "objecoes", None, None
            continue
        if _RE_VERDICT_HEAD.match(line):
            cursor.section, cursor.objection, cursor.answer = "veredito", None, None
            cursor.verdict_lines_seen = 0
            continue
        if _RE_ANY_HEAD.match(line):
            # Qualquer outro título (Critérios, Nota do Orquestrador, ...) encerra a seção.
            cursor.section, cursor.objection, cursor.answer = None, None, None
            continue

        if not line.strip():
            continue

        attempt = cursor.attempt
        if cursor.section == "objecoes" and cursor.round is not None:
            if m := _RE_OBJECTION.match(line):
                objection = Objection(
                    id=m.group(1),
                    gravity=_gravity(m.group(2)),
                    criterion=m.group(3).strip(),
                    text=m.group(4).strip(),
                )
                cursor.round.objections.append(objection)
                cursor.objection, cursor.field = objection, "text"
            elif cursor.objection is not None and raw_line[:1] in (" ", "\t"):
                objection = cursor.objection
                if m := _RE_REASON.match(raw_line):
                    cursor.field = "reason"
                    objection.reason = _cap(m.group(1))
                elif m := _RE_FIX.match(raw_line):
                    cursor.field = "fix"
                    objection.fix = _cap(m.group(1))
                else:
                    setattr(
                        objection, cursor.field, _cap(_join(getattr(objection, cursor.field), line))
                    )
            continue

        if cursor.section == "resposta" and cursor.round is not None:
            if m := _RE_ANSWER.match(line):
                ids = [part.strip() for part in m.group(1).split("+")]
                answer = Answer(ids=ids, action=m.group(2), text=m.group(3).strip())
                cursor.round.answers.append(answer)
                cursor.answer = answer
            elif cursor.answer is not None:
                cursor.answer.text = _cap(_join(cursor.answer.text, line))
            continue

        if cursor.section == "status" and cursor.round is not None:
            if m := _RE_STATUS.match(line):
                cursor.round.statuses.append(
                    Status(id=m.group(1), status=m.group(2).lower(), note=_cap(m.group(3)))
                )
            continue

        if cursor.section == "veredito" and attempt is not None:
            stripped = line.strip()
            if stripped.startswith(("- ", "* ")):
                attempt.verdict_notes.append(_cap(stripped[2:]))
            elif attempt.verdict is None and cursor.verdict_lines_seen < 3:
                cursor.verdict_lines_seen += 1
                if m := _RE_VERDICT.search(stripped.upper()):
                    attempt.verdict = m.group(1)
            continue

    _finish(debate)
    return debate


def _finish(debate: Debate) -> None:
    if not debate.attempts:
        return
    last = debate.attempts[-1]
    debate.verdict = last.verdict
    debate.current_round = max((r.round for r in last.rounds), default=0)
    if last.verdict is None:
        debate.state = "em debate"
    elif last.verdict == "APROVADA":
        debate.state = "aprovada"
    elif last.verdict == "APROVADA COM RESSALVAS":
        debate.state = "aprovada com ressalvas"
    else:
        rejected = sum(1 for a in debate.attempts if a.verdict == "REPROVADA")
        debate.state = "travado" if rejected >= MAX_ATTEMPTS_BEFORE_LOCK else "reprovada"


def find_debates() -> list[tuple[str, Path]]:
    """Todos os ``saida/*/debate.md``, do modificado mais recentemente para o mais antigo."""
    root = saida_dir()
    if not root.is_dir():
        return []
    found: list[tuple[float, str, Path]] = []
    for folder in root.iterdir():
        arquivo = folder / "debate.md"
        if folder.is_dir() and arquivo.is_file():
            try:
                found.append((arquivo.stat().st_mtime, folder.name, arquivo))
            except OSError:
                continue
    found.sort(key=lambda item: (item[0], item[1]), reverse=True)
    return [(name, path) for _, name, path in found]


def load_debate(piece: str, path: Path) -> Debate:
    """Lê e interpreta o arquivo, anotando a data da última alteração."""
    text = path.read_text(encoding="utf-8", errors="replace")
    debate = parse_debate(text, piece)
    debate.updated_at = datetime.fromtimestamp(path.stat().st_mtime, UTC).isoformat()
    return debate
