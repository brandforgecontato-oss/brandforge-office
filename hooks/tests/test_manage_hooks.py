"""Fail-safe tests for the hooks config installer (ARC-008).

Covers the three behaviors added in the hardening:
- malformed ``settings.json`` aborts installation instead of wiping it,
- writes are atomic (temp file + ``os.replace``) with no ``.tmp`` left behind,
- the first mutation of an existing file is backed up to ``settings.json.bak``.
"""

import json
from pathlib import Path

import pytest

import manage_hooks


def _settings_path(tmp_path: Path) -> Path:
    return tmp_path / "settings.json"


def test_load_settings_aborts_on_invalid_json(tmp_path: Path) -> None:
    """A malformed settings.json must raise SystemExit, not return {}."""
    path = _settings_path(tmp_path)
    path.write_text("{ not json ", encoding="utf-8")

    with pytest.raises(SystemExit) as exc:
        manage_hooks.load_settings(path)

    assert "not valid JSON" in str(exc.value)
    # The corrupt original must be left byte-for-byte intact.
    assert path.read_text(encoding="utf-8") == "{ not json "


def test_install_aborts_on_invalid_json_without_touching_file(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """End-to-end: install into a malformed settings.json aborts before any write."""
    monkeypatch.setenv("CLAUDE_CONFIG_DIR", str(tmp_path))
    path = _settings_path(tmp_path)
    original = "{ broken"
    path.write_text(original, encoding="utf-8")

    with pytest.raises(SystemExit):
        manage_hooks.install_hooks("/usr/local/bin/claude-office-hook")

    # File untouched, no backup or temp artifacts created.
    assert path.read_text(encoding="utf-8") == original
    assert not (tmp_path / "settings.json.bak").exists()
    assert not (tmp_path / "settings.json.tmp").exists()


def test_save_settings_is_atomic_and_creates_backup(tmp_path: Path) -> None:
    """Saving over an existing file: backup created once, unrelated keys preserved."""
    path = _settings_path(tmp_path)
    path.write_text(json.dumps({"model": "opus", "permissions": {}}), encoding="utf-8")

    manage_hooks.save_settings(path, {"model": "opus", "permissions": {}, "hooks": {}})

    # New content written and parseable; unrelated key preserved.
    saved = json.loads(path.read_text(encoding="utf-8"))
    assert saved["model"] == "opus"
    # First-mutation backup captured the pre-write original.
    backup = tmp_path / "settings.json.bak"
    assert backup.exists()
    assert json.loads(backup.read_text(encoding="utf-8"))["model"] == "opus"
    # No temp file left behind.
    assert not (tmp_path / "settings.json.tmp").exists()


def test_save_settings_preserves_oldest_backup_across_runs(tmp_path: Path) -> None:
    """A second run must not overwrite the first-run ``.bak`` snapshot."""
    path = _settings_path(tmp_path)
    backup = tmp_path / "settings.json.bak"

    path.write_text(json.dumps({"v": 1}), encoding="utf-8")
    manage_hooks.save_settings(path, {"v": 2})
    first_backup = backup.read_text(encoding="utf-8")
    assert json.loads(first_backup)["v"] == 1

    path.write_text(json.dumps({"v": 999}), encoding="utf-8")
    manage_hooks.save_settings(path, {"v": 3})
    # Backup still holds the original v=1 snapshot, not v=999.
    assert json.loads(backup.read_text(encoding="utf-8"))["v"] == 1


def test_load_settings_returns_empty_for_missing_file(tmp_path: Path) -> None:
    """A fresh install (no settings.json) is still allowed: returns {}."""
    assert manage_hooks.load_settings(_settings_path(tmp_path)) == {}


def test_install_into_explicit_settings_path_keeps_other_keys(tmp_path: Path) -> None:
    """--settings grava os hooks num settings.json de projeto sem tocar no resto."""
    project_settings = tmp_path / "projeto" / ".claude" / "settings.json"
    project_settings.parent.mkdir(parents=True)
    project_settings.write_text(
        json.dumps(
            {"env": {"X": "1"}, "hooks": {"PreToolUse": [{"matcher": "Bash", "hooks": []}]}}
        ),
        encoding="utf-8",
    )

    manage_hooks.install_hooks(
        '"D:/Pc User/hooks/.venv/Scripts/claude-office-hook.exe"',
        settings_path=project_settings,
    )

    saved = json.loads(project_settings.read_text(encoding="utf-8"))
    assert saved["env"] == {"X": "1"}
    pre = saved["hooks"]["PreToolUse"]
    assert pre[0] == {"matcher": "Bash", "hooks": []}  # hook existente preservado
    commands = [h["hooks"][0]["command"] for h in pre[1:]]
    assert commands == ['"D:/Pc User/hooks/.venv/Scripts/claude-office-hook.exe" pre_tool_use']


def test_uninstall_from_explicit_settings_path(tmp_path: Path) -> None:
    project_settings = tmp_path / "settings.json"
    manage_hooks.install_hooks("claude-office-hook", settings_path=project_settings)
    manage_hooks.uninstall_hooks("claude-office-hook", settings_path=project_settings)
    saved = json.loads(project_settings.read_text(encoding="utf-8"))
    assert saved["hooks"] == {}


def test_install_sets_env_vars_in_settings(tmp_path: Path) -> None:
    """--set-env grava variáveis em settings["env"] preservando as existentes."""
    settings = tmp_path / "settings.json"
    settings.write_text(json.dumps({"env": {"KEEP": "1"}}), encoding="utf-8")

    manage_hooks.install_hooks(
        "claude-office-hook", settings_path=settings, env={"CLAUDE_OFFICE_STRIP_PREFIXES": "a-,b-"}
    )

    saved = json.loads(settings.read_text(encoding="utf-8"))
    assert saved["env"] == {"KEEP": "1", "CLAUDE_OFFICE_STRIP_PREFIXES": "a-,b-"}


def test_install_env_is_idempotent(tmp_path: Path) -> None:
    settings = tmp_path / "settings.json"
    for _ in range(2):
        manage_hooks.install_hooks("claude-office-hook", settings_path=settings, env={"A": "1"})
    saved = json.loads(settings.read_text(encoding="utf-8"))
    assert saved["env"] == {"A": "1"}
    assert len(saved["hooks"]["Stop"]) == 1


def test_hook_cmd_with_spaces_is_quoted_automatically(tmp_path: Path) -> None:
    """Caminho com espaço (ex.: 'Pc User') precisa de aspas no comando do hook."""
    settings = tmp_path / "settings.json"
    manage_hooks.install_hooks("D:/Pc User/hooks/claude-office-hook.exe", settings_path=settings)
    saved = json.loads(settings.read_text(encoding="utf-8"))
    command = saved["hooks"]["Stop"][0]["hooks"][0]["command"]
    assert command == '"D:/Pc User/hooks/claude-office-hook.exe" stop'


def test_hook_cmd_already_quoted_is_kept(tmp_path: Path) -> None:
    settings = tmp_path / "settings.json"
    manage_hooks.install_hooks('"D:/Pc User/x.exe"', settings_path=settings)
    saved = json.loads(settings.read_text(encoding="utf-8"))
    assert saved["hooks"]["Stop"][0]["hooks"][0]["command"] == '"D:/Pc User/x.exe" stop'
