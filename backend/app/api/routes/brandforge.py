"""Rotas do escritório BrandForge: elenco, debate, placar e chat com o Orquestrador."""

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, field_validator

from app.brandforge.chat import ChatBusyError, get_chat_service
from app.brandforge.debate import find_debates, load_debate
from app.brandforge.paths import office_dir
from app.brandforge.placar import STATUSES, collect_pieces
from app.brandforge.roster import ROSTER

router = APIRouter(prefix="/brandforge", tags=["brandforge"])


@router.get("/roster")
async def get_roster() -> dict[str, object]:
    """Elenco fixo do escritório, para os cartões dos agentes."""
    office = office_dir()
    return {
        "officeDir": str(office),
        "officeName": office.name,
        "agents": [
            {
                "slug": entry.slug,
                "name": entry.name,
                "role": entry.role,
                "inspiration": entry.inspiration,
                "model": entry.model,
                "color": entry.color,
            }
            for entry in ROSTER.values()
        ],
    }


class ChatRequest(BaseModel):
    message: str

    @field_validator("message")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("a mensagem não pode ser vazia")
        return value


@router.get("/chat")
async def get_chat(after: Annotated[int, Query(ge=0)] = 0) -> dict[str, object]:
    """Mensagens do chat com o Orquestrador depois do id ``after`` (0 = todas)."""
    service = get_chat_service()
    return {
        "busy": service.busy,
        "sessionId": service.session_id,
        "messages": [m.model_dump() for m in service.messages_after(after)],
    }


@router.post("/chat", status_code=202)
async def post_chat(body: ChatRequest) -> dict[str, object]:
    """Envia uma mensagem ao Orquestrador. A resposta chega pelo ``GET /chat``."""
    try:
        message = await get_chat_service().send(body.message)
    except ChatBusyError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return {"message": message.model_dump()}


@router.delete("/chat")
async def delete_chat() -> dict[str, str]:
    """Começa uma conversa nova com o Orquestrador."""
    get_chat_service().reset()
    return {"status": "ok"}


@router.get("/debate")
async def get_debate(
    piece: Annotated[
        str | None, Query(pattern=r"^[A-Za-z0-9][A-Za-z0-9_.-]*$", max_length=120)
    ] = None,
) -> dict[str, object]:
    """Debate Orquestrador × Crítico de uma peça (padrão: o mais recente) e a lista dos demais."""
    debates = find_debates()
    available = [
        {"piece": name, "title": d.title, "state": d.state, "updatedAt": d.updated_at}
        for name, path in debates
        for d in [load_debate(name, path)]
    ]
    if piece is not None:
        chosen = next(((n, p) for n, p in debates if n == piece), None)
        if chosen is None:
            raise HTTPException(status_code=404, detail="Debate não encontrado")
    elif debates:
        chosen = debates[0]
    else:
        return {"debate": None, "available": []}
    return {
        "debate": load_debate(*chosen).model_dump(by_alias=True),
        "available": available,
    }


@router.get("/placar")
async def get_placar() -> dict[str, object]:
    """Placar de aprovação: o status de cada peça, lido da pasta saida/ do escritório."""
    pieces = collect_pieces()
    counts = dict.fromkeys(STATUSES, 0)
    for piece in pieces:
        counts[piece["status"]] += 1
    return {
        "statuses": STATUSES,
        "counts": counts,
        "pieces": pieces,
        "locked": [p["id"] for p in pieces if p["status"] == "travado"],
    }
