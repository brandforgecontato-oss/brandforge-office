"""Rotas do escritório BrandForge: elenco, debate, placar e chat com o Orquestrador."""

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, field_validator

from app.brandforge.chat import ChatBusyError, get_chat_service
from app.brandforge.paths import office_dir
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
