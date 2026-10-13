"""Localização do repositório do escritório (``escritorio_marketingBF``)."""

from pathlib import Path

from app.config import get_settings

# backend/app/brandforge/paths.py -> raiz do fork (brandforge-office)
_FORK_ROOT = Path(__file__).resolve().parents[3]


def office_dir() -> Path:
    """Pasta do escritório: ``BRANDFORGE_OFFICE_DIR`` ou a pasta irmã do fork."""
    configured = get_settings().BRANDFORGE_OFFICE_DIR.strip()
    if configured:
        return Path(configured).expanduser().resolve()
    return (_FORK_ROOT.parent / "escritorio_marketingBF").resolve()


def saida_dir() -> Path:
    """Pasta ``saida/`` do escritório, onde ficam as peças e os debates."""
    return office_dir() / "saida"
