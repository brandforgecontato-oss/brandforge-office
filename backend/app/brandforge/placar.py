"""Placar de aprovação: o status de cada peça do escritório, lido da pasta ``saida/``.

Não existe um banco de status: os arquivos que o pipeline já mantém dizem tudo, e o placar
só os lê. Fontes, da mais fraca para a mais forte:

1. ``saida/cronograma.md`` — a tabela de temas (colunas ``Tema`` e ``Status``; formato opcional).
2. ``saida/<peça>/debate.md`` — veredito do Crítico: em debate, aprovado (a produzir) ou
   travado (3 tentativas reprovadas). Uma linha ``Status: ...`` escrita pelo Orquestrador vale.
3. ``saida/<peça>/resumo.md`` — a linha ``Status: entregue`` do protocolo.
4. ``saida/status.json`` — sobrescreve tudo, para o pipeline e o Entregador (Fase 6) registrarem
   ``aprovado``, ``refazer`` e o motivo. Formato:

       {"pecas": [{"id": "2026-10-07_tema", "status": "refazer", "motivo": "...",
                   "tema": "...", "formato": "..."}]}

   (``pecas`` também pode ser um dicionário ``{"<id>": {...}}``.)
"""

import json
import re
import unicodedata
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, TypedDict, cast

from app.brandforge.debate import parse_debate
from app.brandforge.paths import saida_dir

__all__ = ["STATUSES", "Piece", "collect_pieces", "normalize_status", "slugify"]

STATUSES = ["pendente", "em produção", "entregue", "aprovado", "refazer", "travado"]

# Arquivos que mostram que a produção já começou (depois do debate aprovado).
_PRODUCTION_MARKERS = ("roteiro.md", "legendas.md", "relatorio.md", "proposta.md", "projeto")
_FINAL_SUFFIXES = (".mp4", ".png")


class Piece(TypedDict):
    id: str
    tema: str
    formato: str
    status: str
    motivo: str
    origem: str  # pasta | cronograma | status.json
    atualizadoEm: str


def _fold(text: str) -> str:
    """Minúsculas, sem acento e sem marcação."""
    decomposed = unicodedata.normalize("NFD", text)
    plain = "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn")
    return plain.lower()


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", _fold(text)).strip("-")


def normalize_status(raw: str | None) -> str | None:
    """Um dos seis status do protocolo, ou ``None`` se o texto não for um deles."""
    if not raw:
        return None
    cleaned = re.sub(r"[^a-z ]+", "", _fold(raw)).strip()
    for status in STATUSES:
        if cleaned.startswith(_fold(status)):
            return status
    return None


# --- leitura de arquivos --------------------------------------------------------------------------


def _read(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""


def _mtime_iso(*paths: Path) -> str:
    times: list[float] = []
    for path in paths:
        try:
            times.append(path.stat().st_mtime)
        except OSError:
            continue
    when = max(times) if times else 0.0
    return datetime.fromtimestamp(when, UTC).isoformat()


_RE_STATUS_LINE = re.compile(r"Status:\s*\**\s*([A-Za-zÀ-ÿ ]+)")
_RE_FORMAT = re.compile(r"Formato:\s*([^\n·|]+)")
_RE_SUMMARY_TITLE = re.compile(r"^#\s+(.+?)\s*(?:[—–-]\s*\d{4}-\d{2}-\d{2})?\s*$", re.MULTILINE)


def _last_status(text: str) -> str | None:
    found: str | None = None
    for match in _RE_STATUS_LINE.finditer(text):
        status = normalize_status(match.group(1))
        if status:
            found = status
    return found


def _humanize(folder: str) -> str:
    name = re.sub(r"^\d{4}-\d{2}-\d{2}_", "", folder).replace("-", " ").replace("_", " ")
    return name[:1].upper() + name[1:]


def _derive_status(folder: Path, has_debate: bool, debate_state: str, has_summary: bool) -> str:
    names = {child.name for child in folder.iterdir()}
    delivered_file = any(name.lower().endswith(_FINAL_SUFFIXES) for name in names)
    started = delivered_file or any(marker in names for marker in _PRODUCTION_MARKERS)

    if debate_state == "travado":
        return "travado"
    if delivered_file and has_summary:
        return "entregue"
    if not has_debate:
        return "em produção"
    if debate_state in ("aprovada", "aprovada com ressalvas"):
        return "em produção" if started else "pendente"
    return "em produção"  # em debate, ou reprovada ainda com tentativas sobrando


def _piece_from_folder(folder: Path) -> Piece | None:
    debate_file = folder / "debate.md"
    summary_file = folder / "resumo.md"
    has_debate, has_summary = debate_file.is_file(), summary_file.is_file()
    if not (has_debate or has_summary or any(folder.glob("final.*"))):
        return None

    debate_text = _read(debate_file) if has_debate else ""
    summary_text = _read(summary_file) if has_summary else ""
    debate = parse_debate(debate_text, folder.name) if has_debate else None

    title = ""
    if summary_text and (m := _RE_SUMMARY_TITLE.search(summary_text)):
        title = re.sub(r"^Resumo:\s*", "", m.group(1).strip())
    if not title and debate and debate.title != folder.name:
        title = debate.title
    formato = ""
    for text in (summary_text, debate_text):
        if text and (m := _RE_FORMAT.search(text)):
            formato = m.group(1).strip()
            break

    explicit = _last_status(summary_text) or _last_status(debate_text)
    status = explicit or _derive_status(
        folder, has_debate, debate.state if debate else "", has_summary
    )
    # O debate trava o tema mesmo que um "Status:" antigo diga outra coisa.
    if debate and debate.state == "travado":
        status = "travado"

    return Piece(
        id=folder.name,
        tema=title or _humanize(folder.name),
        formato=formato,
        status=status,
        motivo="",
        origem="pasta",
        atualizadoEm=_mtime_iso(debate_file, summary_file, folder),
    )


# --- status.json ----------------------------------------------------------------------------------


def _load_status_json(path: Path) -> list[dict[str, Any]]:
    try:
        raw: Any = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []
    if not isinstance(raw, dict):
        return []
    pecas: Any = cast(dict[str, Any], raw).get("pecas")
    entries: list[dict[str, Any]] = []
    if isinstance(pecas, list):
        for item in cast(list[Any], pecas):
            if isinstance(item, dict):
                entries.append(cast(dict[str, Any], item))
    elif isinstance(pecas, dict):
        for key, item in cast(dict[str, Any], pecas).items():
            if isinstance(item, dict):
                entries.append({"id": key, **cast(dict[str, Any], item)})
    return entries


def _apply_status_json(pieces: dict[str, Piece], root: Path) -> None:
    status_file = root / "status.json"
    stamp = _mtime_iso(status_file)
    for entry in _load_status_json(status_file):
        piece_id = str(entry.get("id") or "").strip()
        if not piece_id:
            continue
        status = normalize_status(str(entry.get("status") or ""))
        existing = pieces.get(piece_id)
        if existing is None:
            if status is None:
                continue
            existing = Piece(
                id=piece_id,
                tema=str(entry.get("tema") or _humanize(piece_id)),
                formato="",
                status=status,
                motivo="",
                origem="status.json",
                atualizadoEm=stamp,
            )
            pieces[piece_id] = existing
        elif status is not None:
            existing["status"] = status
            existing["origem"] = "status.json"
            existing["atualizadoEm"] = stamp
        if entry.get("tema"):
            existing["tema"] = str(entry["tema"])
        if entry.get("formato"):
            existing["formato"] = str(entry["formato"])
        if entry.get("motivo"):
            existing["motivo"] = str(entry["motivo"])


# --- cronograma.md --------------------------------------------------------------------------------


def _split_row(line: str) -> list[str]:
    return [cell.strip() for cell in line.strip().strip("|").split("|")]


def _cronograma_rows(text: str) -> list[dict[str, str]]:
    """Linhas das tabelas que têm as colunas Tema e Status."""
    rows: list[dict[str, str]] = []
    header: list[str] | None = None
    for line in text.splitlines():
        if not line.strip().startswith("|"):
            header = None
            continue
        cells = _split_row(line)
        if all(re.fullmatch(r":?-{2,}:?", c) for c in cells if c):
            continue  # linha separadora
        if header is None:
            names = [_fold(c).strip("* ") for c in cells]
            header = names if "tema" in names and "status" in names else []
            continue
        if not header:
            continue
        rows.append({name: cells[i] if i < len(cells) else "" for i, name in enumerate(header)})
    return rows


def _apply_cronograma(pieces: dict[str, Piece], root: Path) -> None:
    file = root / "cronograma.md"
    if not file.is_file():
        return
    taken = [slugify(p["id"]) for p in pieces.values()] + [
        slugify(p["tema"]) for p in pieces.values()
    ]
    stamp = _mtime_iso(file)
    for row in _cronograma_rows(_read(file)):
        tema = row.get("tema", "").strip("* ").strip()
        if not tema:
            continue
        slug = slugify(tema)
        if any(slug and (slug in other or other in slug) for other in taken if other):
            continue  # já existe pasta (ou registro) para esse tema
        pieces[f"cronograma:{slug}"] = Piece(
            id=f"cronograma:{slug}",
            tema=tema,
            formato=row.get("formato", "").strip("* ").strip(),
            status=normalize_status(row.get("status")) or "pendente",
            motivo="",
            origem="cronograma",
            atualizadoEm=stamp,
        )


# --- API ------------------------------------------------------------------------------------------


def collect_pieces() -> list[Piece]:
    """Todas as peças conhecidas do escritório, da mais recente para a mais antiga."""
    root = saida_dir()
    if not root.is_dir():
        return []
    pieces: dict[str, Piece] = {}
    for folder in sorted(root.iterdir()):
        if not folder.is_dir() or folder.name.startswith(("_", ".", "cronograma")):
            continue
        piece = _piece_from_folder(folder)
        if piece:
            pieces[piece["id"]] = piece
    _apply_status_json(pieces, root)
    _apply_cronograma(pieces, root)
    return sorted(pieces.values(), key=lambda p: p["id"], reverse=True)
