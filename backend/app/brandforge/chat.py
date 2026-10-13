"""Chat com o Orquestrador.

O backend recebe a mensagem do Silvestre e a envia ao Claude Code da pasta do escritório
(``escritorio_marketingBF``) em modo não interativo, sempre com ``--agent orquestrador`` e
retomando a mesma sessão (``--resume <id>``). A saída ``stream-json`` é lida linha a linha:
cada fala do Orquestrador vira uma mensagem do chat assim que chega, sem esperar o fim do
trabalho (uma peça pode levar vários minutos).

Só uma mensagem é processada por vez; o frontend consulta ``GET /brandforge/chat`` para
buscar as mensagens novas.
"""

import json
import logging
import shlex
import subprocess
import sys
import threading
from collections import deque
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, cast

from pydantic import BaseModel

from app.brandforge.paths import office_dir
from app.config import get_settings

logger = logging.getLogger(__name__)

__all__ = [
    "ChatBusyError",
    "ChatMessage",
    "ChatService",
    "StreamEvent",
    "build_command",
    "get_chat_service",
    "parse_stream_line",
]

AGENT_NAME = "orquestrador"
MAX_MESSAGES = 200


class ChatBusyError(RuntimeError):
    """Já existe uma mensagem sendo processada pelo Orquestrador."""


class ChatMessage(BaseModel):
    id: int
    role: str  # "usuario" | "orquestrador" | "sistema"
    text: str
    timestamp: str


@dataclass
class StreamEvent:
    """O que interessa de uma linha do ``stream-json`` do Claude Code."""

    texts: list[str] = field(default_factory=lambda: [])
    session_id: str | None = None
    final: bool = False
    is_error: bool = False
    result_text: str = ""


def build_command(base: list[str], session_id: str | None, permission_mode: str) -> list[str]:
    """Monta o comando do Claude Code. O prompt segue pelo stdin."""
    command = [
        *base,
        "-p",
        "--agent",
        AGENT_NAME,
        "--output-format",
        "stream-json",
        "--verbose",
        "--permission-mode",
        permission_mode,
    ]
    if session_id:
        command += ["--resume", session_id]
    return command


def parse_stream_line(line: str) -> StreamEvent | None:
    """Interpreta uma linha do stream-json; ``None`` quando não há nada útil nela."""
    line = line.strip()
    if not line:
        return None
    try:
        raw: Any = json.loads(line)
    except json.JSONDecodeError:
        return None
    if not isinstance(raw, dict):
        return None
    obj = cast(dict[str, Any], raw)

    kind = obj.get("type")
    session_id = obj.get("session_id")
    if not isinstance(session_id, str):
        session_id = None

    if kind == "system":
        return StreamEvent(session_id=session_id) if session_id else None

    if kind == "assistant":
        # Falas de subagentes carregam o id da chamada que os criou: não vão para o chat.
        if obj.get("parent_tool_use_id"):
            return None
        message: Any = obj.get("message")
        content: Any = (
            cast(dict[str, Any], message).get("content") if isinstance(message, dict) else None
        )
        texts: list[str] = []
        if isinstance(content, list):
            for block in cast(list[Any], content):
                if isinstance(block, dict):
                    fields = cast(dict[str, Any], block)
                    if fields.get("type") == "text":
                        text = str(fields.get("text", "")).strip()
                        if text:
                            texts.append(text)
        return StreamEvent(texts=texts, session_id=session_id) if texts else None

    if kind == "result":
        return StreamEvent(
            session_id=session_id,
            final=True,
            is_error=bool(obj.get("is_error")),
            result_text=str(obj.get("result") or "").strip(),
        )
    return None


def _default_claude_command() -> list[str]:
    return shlex.split(get_settings().BRANDFORGE_CLAUDE_PATH, posix=False) or ["claude"]


class ChatService:
    """Conversa contínua com o Orquestrador, uma mensagem por vez."""

    def __init__(
        self,
        claude_command: list[str],
        office_dir: Callable[[], Path],
        state_file: Path,
        permission_mode: str,
    ) -> None:
        self.claude_command = claude_command
        self.office_dir = office_dir
        self.state_file = state_file
        self.permission_mode = permission_mode
        self._lock = threading.Lock()
        self._busy = False
        self._next_id = 1
        self.messages: list[ChatMessage] = []
        self.session_id: str | None = None
        self._load()

    # --- estado -------------------------------------------------------------------------------

    @property
    def busy(self) -> bool:
        return self._busy

    def _load(self) -> None:
        try:
            raw: Any = json.loads(self.state_file.read_text(encoding="utf-8"))
            self.session_id = raw.get("session_id")
            self.messages = [ChatMessage(**m) for m in raw.get("messages", [])]
            self._next_id = max((m.id for m in self.messages), default=0) + 1
        except (OSError, ValueError, TypeError):
            pass

    def _save(self) -> None:
        try:
            self.state_file.parent.mkdir(parents=True, exist_ok=True)
            payload = {
                "session_id": self.session_id,
                "messages": [m.model_dump() for m in self.messages[-MAX_MESSAGES:]],
            }
            self.state_file.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        except OSError as exc:
            logger.warning("Não foi possível salvar o chat: %s", exc)

    def _add(self, role: str, text: str) -> ChatMessage:
        with self._lock:
            message = ChatMessage(
                id=self._next_id,
                role=role,
                text=text,
                timestamp=datetime.now(UTC).isoformat(),
            )
            self._next_id += 1
            self.messages.append(message)
            if len(self.messages) > MAX_MESSAGES:
                self.messages = self.messages[-MAX_MESSAGES:]
            self._save()
        return message

    def messages_after(self, after: int) -> list[ChatMessage]:
        with self._lock:
            return [m for m in self.messages if m.id > after]

    def reset(self) -> None:
        """Começa uma conversa nova (esquece o histórico e a sessão do Claude Code)."""
        with self._lock:
            self.messages = []
            self.session_id = None
            self._save()

    # --- envio --------------------------------------------------------------------------------

    async def send(self, text: str) -> ChatMessage:
        text = text.strip()
        if not text:
            raise ValueError("mensagem vazia")
        with self._lock:
            if self._busy:
                raise ChatBusyError("O Orquestrador ainda está trabalhando na mensagem anterior.")
            self._busy = True
        message = self._add("usuario", text)
        threading.Thread(
            target=self._run, args=(text,), name="brandforge-chat", daemon=True
        ).start()
        return message

    def _run(self, prompt: str) -> None:
        try:
            self._run_claude(prompt)
        except Exception as exc:  # o chat nunca pode derrubar o backend
            logger.exception("Falha no chat com o Orquestrador")
            self._add("sistema", f"Erro inesperado no chat: {exc}")
        finally:
            self._busy = False

    def _run_claude(self, prompt: str) -> None:
        cwd = self.office_dir()
        if not cwd.is_dir():
            self._add(
                "sistema",
                f"Pasta do escritório não encontrada: {cwd}. "
                "Ajuste BRANDFORGE_OFFICE_DIR no backend.",
            )
            return

        command = build_command(self.claude_command, self.session_id, self.permission_mode)
        creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0) if sys.platform == "win32" else 0
        try:
            process = subprocess.Popen(
                command,
                cwd=str(cwd),
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
                creationflags=creationflags,
            )
        except OSError as exc:
            self._add(
                "sistema",
                f"Não consegui iniciar o Claude Code ({self.claude_command[0]}): {exc}",
            )
            return

        assert process.stdin is not None and process.stdout is not None
        try:
            process.stdin.write(prompt)
            process.stdin.close()
        except OSError:
            pass  # o processo pode ter morrido antes de ler; o código de saída explica

        spoke = False
        failure = ""
        noise: deque[str] = deque(maxlen=6)  # linhas que não são JSON (erros do próprio CLI)
        for line in process.stdout:
            event = parse_stream_line(line)
            if event is None:
                if line.strip():
                    noise.append(line.strip())
                continue
            if event.session_id:
                self.session_id = event.session_id
                self._save()
            for text in event.texts:
                spoke = True
                self._add("orquestrador", text)
            if event.final:
                if event.is_error:
                    failure = event.result_text or "O Claude Code terminou com erro."
                elif not spoke and event.result_text:
                    spoke = True
                    self._add("orquestrador", event.result_text)

        code = process.wait()
        if failure or code != 0:
            detail = failure or " ".join(noise) or f"código de saída {code}"
            # Uma sessão que não pode ser retomada precisa começar do zero na próxima vez.
            self.session_id = None
            self._save()
            self._add("sistema", f"O Claude Code falhou: {detail}")
        elif not spoke:
            self._add("sistema", "O Orquestrador terminou sem dizer nada.")


_service: ChatService | None = None


def get_chat_service() -> ChatService:
    """Serviço único do backend (o estado da conversa é global, de uso pessoal)."""
    global _service
    if _service is None:
        settings = get_settings()
        state_file = Path(__file__).resolve().parents[2] / "brandforge_chat.json"
        _service = ChatService(
            claude_command=_default_claude_command(),
            office_dir=office_dir,
            state_file=state_file,
            permission_mode=settings.BRANDFORGE_CHAT_PERMISSION_MODE,
        )
    return _service
