"""Rotas /api/v1/brandforge."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_roster_lista_os_11_agentes_com_cartao_completo() -> None:
    resp = client.get("/api/v1/brandforge/roster")
    assert resp.status_code == 200
    body = resp.json()
    agentes = {a["slug"]: a for a in body["agents"]}
    assert len(agentes) == 11
    critico = agentes["critico"]
    assert critico["name"] == "Crítico"
    assert critico["inspiration"] == "Steve Jobs (fase exigente)"
    assert critico["role"]
    assert critico["color"].startswith("#")
    assert body["officeName"]
