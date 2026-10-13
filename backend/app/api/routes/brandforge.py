"""Rotas do escritório BrandForge: elenco, debate, placar e chat com o Orquestrador."""

from fastapi import APIRouter

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
