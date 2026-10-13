"""Chat com o Orquestrador: comando do Claude Code, leitura do stream-json e sessão contínua."""

import asyncio
import json
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.brandforge import chat as chat_module
from app.brandforge.chat import ChatBusyError, ChatService, build_command, parse_stream_line
from app.config import get_settings
from app.main import app

# Programa que faz o papel do "claude": lê o prompt do stdin e escreve linhas stream-json.
FAKE_CLAUDE = r"""
import json, sys, time
prompt = sys.stdin.read()
args = sys.argv[1:]
mode = "ok"
if "FALHAR" in prompt:
    mode = "falha"
if "DEMORAR" in prompt:
    time.sleep(1.5)
def out(obj):
    print(json.dumps(obj), flush=True)
out({"type": "system", "subtype": "init", "session_id": "sessao-123"})
if mode == "falha":
    out({"type": "result", "subtype": "error_during_execution", "is_error": True,
         "result": "No conversation found", "session_id": "sessao-123"})
    sys.exit(1)
out({"type": "assistant", "parent_tool_use_id": None, "message": {"content": [
    {"type": "text", "text": "Pensando na proposta..."},
    {"type": "tool_use", "id": "t1", "name": "Agent", "input": {}}]}})
out({"type": "assistant", "parent_tool_use_id": "t1", "message": {"content": [
    {"type": "text", "text": "fala do subagente (não vai para o chat)"}]}})
out({"type": "assistant", "parent_tool_use_id": None, "message": {"content": [
    {"type": "text", "text": "Eco: " + prompt.strip() + " | args=" + " ".join(args)}]}})
out({"type": "result", "subtype": "success", "is_error": False,
     "result": "Eco: " + prompt.strip(), "session_id": "sessao-123"})
"""


@pytest.fixture
def fake_claude(tmp_path: Path) -> list[str]:
    script = tmp_path / "fake_claude.py"
    script.write_text(FAKE_CLAUDE, encoding="utf-8")
    return [sys.executable, str(script)]


@pytest.fixture
def service(tmp_path: Path, fake_claude: list[str]) -> ChatService:
    office = tmp_path / "escritorio"
    office.mkdir()
    return ChatService(
        claude_command=fake_claude,
        office_dir=lambda: office,
        state_file=tmp_path / "chat.json",
        permission_mode="acceptEdits",
    )


async def _wait_idle(svc: ChatService, timeout: float = 15.0) -> None:
    deadline = asyncio.get_event_loop().time() + timeout
    while svc.busy:
        assert asyncio.get_event_loop().time() < deadline, "o chat não terminou"
        await asyncio.sleep(0.05)


# --- comando -----------------------------------------------------------------------------------


def test_comando_inicial_usa_agente_orquestrador_sem_resume() -> None:
    cmd = build_command(["claude"], None, "acceptEdits")
    assert cmd[0] == "claude"
    assert "-p" in cmd
    assert cmd[cmd.index("--agent") + 1] == "orquestrador"
    assert cmd[cmd.index("--output-format") + 1] == "stream-json"
    assert "--verbose" in cmd
    assert cmd[cmd.index("--permission-mode") + 1] == "acceptEdits"
    assert "--resume" not in cmd


def test_comando_seguinte_retoma_a_mesma_sessao() -> None:
    cmd = build_command(["claude"], "abc-123", "acceptEdits")
    assert cmd[cmd.index("--resume") + 1] == "abc-123"
    assert cmd[cmd.index("--agent") + 1] == "orquestrador"


# --- leitura do stream-json --------------------------------------------------------------------


def test_parse_texto_do_assistente_principal() -> None:
    line = json.dumps(
        {
            "type": "assistant",
            "parent_tool_use_id": None,
            "message": {
                "content": [
                    {"type": "text", "text": "Olá, Silvestre."},
                    {"type": "tool_use", "id": "x", "name": "Read", "input": {}},
                ]
            },
        }
    )
    event = parse_stream_line(line)
    assert event is not None
    assert event.texts == ["Olá, Silvestre."]
    assert event.session_id is None
    assert event.final is False


def test_parse_ignora_fala_de_subagente() -> None:
    line = json.dumps(
        {
            "type": "assistant",
            "parent_tool_use_id": "toolu_1",
            "message": {"content": [{"type": "text", "text": "do subagente"}]},
        }
    )
    event = parse_stream_line(line)
    assert event is None or event.texts == []


def test_parse_init_e_result_trazem_o_id_da_sessao() -> None:
    init = parse_stream_line(json.dumps({"type": "system", "subtype": "init", "session_id": "s1"}))
    assert init is not None and init.session_id == "s1"
    result = parse_stream_line(
        json.dumps({"type": "result", "is_error": False, "result": "fim", "session_id": "s1"})
    )
    assert result is not None
    assert result.final is True
    assert result.is_error is False
    assert result.result_text == "fim"


def test_parse_linha_invalida_ou_vazia_e_ignorada() -> None:
    assert parse_stream_line("") is None
    assert parse_stream_line("isto não é json") is None
    assert parse_stream_line(json.dumps({"type": "user", "message": {}})) is None


# --- serviço -----------------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_enviar_registra_pergunta_e_respostas_sem_a_fala_do_subagente(
    service: ChatService,
) -> None:
    await service.send("oi chefe")
    await _wait_idle(service)
    textos = [(m.role, m.text) for m in service.messages]
    assert textos[0] == ("usuario", "oi chefe")
    respostas = [t for r, t in textos if r == "orquestrador"]
    assert respostas[0] == "Pensando na proposta..."
    assert respostas[1].startswith("Eco: oi chefe")
    assert not any("subagente" in t for _, t in textos)
    # a resposta final não é repetida quando o texto já veio do assistente
    assert len(respostas) == 2


@pytest.mark.asyncio
async def test_guarda_o_id_da_sessao_e_a_segunda_mensagem_retoma(service: ChatService) -> None:
    await service.send("primeira")
    await _wait_idle(service)
    assert service.session_id == "sessao-123"
    assert "--resume" not in service.messages[-1].text

    await service.send("segunda")
    await _wait_idle(service)
    ultima = service.messages[-1].text
    assert "--resume sessao-123" in ultima
    assert "--agent orquestrador" in ultima


@pytest.mark.asyncio
async def test_sessao_sobrevive_a_reinicio_do_backend(service: ChatService, tmp_path: Path) -> None:
    await service.send("primeira")
    await _wait_idle(service)
    novo = ChatService(
        claude_command=service.claude_command,
        office_dir=service.office_dir,
        state_file=tmp_path / "chat.json",
        permission_mode="acceptEdits",
    )
    assert novo.session_id == "sessao-123"
    assert [m.text for m in novo.messages][0] == "primeira"


@pytest.mark.asyncio
async def test_so_uma_mensagem_por_vez(service: ChatService) -> None:
    await service.send("DEMORAR um pouco")
    with pytest.raises(ChatBusyError):
        await service.send("outra")
    await _wait_idle(service)
    await service.send("agora pode")
    await _wait_idle(service)


@pytest.mark.asyncio
async def test_falha_vira_mensagem_do_sistema_e_limpa_a_sessao(service: ChatService) -> None:
    await service.send("primeira")
    await _wait_idle(service)
    assert service.session_id == "sessao-123"
    await service.send("FALHAR agora")
    await _wait_idle(service)
    ultima = service.messages[-1]
    assert ultima.role == "sistema"
    assert "No conversation found" in ultima.text
    assert service.session_id is None


@pytest.mark.asyncio
async def test_nova_conversa_zera_historico_e_sessao(service: ChatService) -> None:
    await service.send("primeira")
    await _wait_idle(service)
    service.reset()
    assert service.messages == []
    assert service.session_id is None


@pytest.mark.asyncio
async def test_mensagem_vazia_e_recusada(service: ChatService) -> None:
    with pytest.raises(ValueError):
        await service.send("   ")


@pytest.mark.asyncio
async def test_executavel_inexistente_vira_mensagem_do_sistema(tmp_path: Path) -> None:
    office = tmp_path / "e"
    office.mkdir()
    svc = ChatService(
        claude_command=[str(tmp_path / "nao-existe.exe")],
        office_dir=lambda: office,
        state_file=tmp_path / "chat.json",
        permission_mode="acceptEdits",
    )
    await svc.send("oi")
    await _wait_idle(svc)
    assert svc.messages[-1].role == "sistema"
    assert "Claude Code" in svc.messages[-1].text


@pytest.mark.asyncio
async def test_pasta_do_escritorio_inexistente_e_avisada(
    tmp_path: Path, fake_claude: list[str]
) -> None:
    svc = ChatService(
        claude_command=fake_claude,
        office_dir=lambda: tmp_path / "nao-existe",
        state_file=tmp_path / "chat.json",
        permission_mode="acceptEdits",
    )
    await svc.send("oi")
    await _wait_idle(svc)
    assert svc.messages[-1].role == "sistema"
    assert "escritório" in svc.messages[-1].text.lower()


# --- rotas -------------------------------------------------------------------------------------


def _headers() -> dict[str, str]:
    return {"X-API-Key": get_settings().effective_api_key}


@pytest.fixture
def api(service: ChatService, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setattr(chat_module, "_service", service)
    return TestClient(app)


def test_post_sem_chave_e_recusado(api: TestClient) -> None:
    resp = api.post("/api/v1/brandforge/chat", json={"message": "oi"})
    assert resp.status_code == 401


def test_post_e_get_incremental(api: TestClient) -> None:
    resp = api.post("/api/v1/brandforge/chat", json={"message": "oi chefe"}, headers=_headers())
    assert resp.status_code == 202
    assert resp.json()["message"]["text"] == "oi chefe"

    import time

    for _ in range(100):
        body = api.get("/api/v1/brandforge/chat").json()
        if not body["busy"] and len(body["messages"]) >= 3:
            break
        time.sleep(0.1)
    assert body["busy"] is False
    ids = [m["id"] for m in body["messages"]]
    assert ids == sorted(ids) and len(set(ids)) == len(ids)

    depois = api.get(f"/api/v1/brandforge/chat?after={ids[0]}").json()
    assert [m["id"] for m in depois["messages"]] == ids[1:]


def test_post_ocupado_devolve_409(api: TestClient) -> None:
    primeiro = api.post("/api/v1/brandforge/chat", json={"message": "DEMORAR"}, headers=_headers())
    assert primeiro.status_code == 202
    segundo = api.post("/api/v1/brandforge/chat", json={"message": "outra"}, headers=_headers())
    assert segundo.status_code == 409
    import time

    for _ in range(100):
        if not api.get("/api/v1/brandforge/chat").json()["busy"]:
            break
        time.sleep(0.1)


def test_post_vazio_devolve_422(api: TestClient) -> None:
    resp = api.post("/api/v1/brandforge/chat", json={"message": "  "}, headers=_headers())
    assert resp.status_code == 422


def test_delete_zera_a_conversa(api: TestClient) -> None:
    assert api.delete("/api/v1/brandforge/chat").status_code == 401
    resp = api.delete("/api/v1/brandforge/chat", headers=_headers())
    assert resp.status_code == 200
    assert api.get("/api/v1/brandforge/chat").json()["messages"] == []


@pytest.mark.asyncio
async def test_nova_conversa_interrompe_o_processo_em_andamento(service: ChatService) -> None:
    await service.send("DEMORAR bastante")
    await asyncio.sleep(0.5)  # o processo já subiu
    service.reset()
    await _wait_idle(service, timeout=1.2)  # bem antes dos 1,5 s do script
    # depois de interrompido, nada da conversa antiga volta (nem "O Claude Code falhou")
    assert service.messages == []
    assert service.session_id is None
    assert service.busy is False


@pytest.mark.asyncio
async def test_depois_de_interromper_o_chat_aceita_nova_mensagem(service: ChatService) -> None:
    await service.send("DEMORAR bastante")
    await asyncio.sleep(0.5)
    service.reset()
    await _wait_idle(service, timeout=3)
    await service.send("recomeçando")
    await _wait_idle(service)
    assert [m.role for m in service.messages][0] == "usuario"
    assert any(m.role == "orquestrador" for m in service.messages)
