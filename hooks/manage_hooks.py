#!/usr/bin/env python3
import argparse
import json
import os
import shutil
from pathlib import Path
from typing import Any

# Constants
HOOK_TYPES = [
    "SessionStart",
    "SessionEnd",
    "PreToolUse",
    "PostToolUse",
    "UserPromptSubmit",
    "PermissionRequest",
    "Notification",
    "Stop",
    "SubagentStart",
    "SubagentStop",
    "PreCompact",
]


def get_settings_path() -> Path:
    """Get the path to the Claude settings file."""
    # Priority: Env var -> ~/.claude/settings.json
    if os.environ.get("CLAUDE_CONFIG_DIR"):
        return Path(os.environ["CLAUDE_CONFIG_DIR"]) / "settings.json"
    return Path.home() / ".claude" / "settings.json"


def load_settings(path: Path) -> dict[str, Any]:
    """Load settings from JSON file.

    A missing file returns ``{}`` (fresh install). A file that exists but
    fails to parse is a hard stop: returning ``{}`` here would cause the
    caller to write a near-empty dict back over the user's real config and
    silently wipe unrelated settings (permissions, env, model, statusline).
    """
    if not path.exists():
        return {}
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        raise SystemExit(
            f"ERROR: {path} exists but is not valid JSON ({e}).\n"
            "Refusing to continue: proceeding would overwrite your settings.\n"
            "Fix or move the file, then re-run install."
        ) from e


def save_settings(path: Path, settings: dict[str, Any]) -> None:
    """Save settings atomically, backing up the original once per run.

    Writes a temp file in the same directory then ``os.replace``s it into
    place, so a crash mid-write cannot leave a truncated ``settings.json``.
    The first mutation of an existing file is snapshotted to
    ``settings.json.bak``; the ``if not backup.exists()`` guard preserves
    the oldest known-good copy across repeated runs.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        backup = path.with_suffix(".json.bak")
        if not backup.exists():
            shutil.copy2(path, backup)
    tmp = path.with_suffix(".json.tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(settings, f, indent=2)
        f.write("\n")
    os.replace(tmp, path)


def create_hook_config(hook_cmd: str, hook_type: str, shell: str | None = None) -> dict[str, Any]:
    """Create the hook configuration dictionary.

    Args:
        hook_cmd: Path to the claude-office-hook command
        hook_type: The hook type in PascalCase (e.g., "PreToolUse")
        shell: Shell Claude Code runs the hook with (``"powershell"`` on Windows
            machines without Git Bash); ``None`` keeps Claude Code's default (bash)
    """
    # Convert PascalCase to snake_case for the event type argument
    event_type = convert_camel_to_snake(hook_type)
    if " " in hook_cmd and not hook_cmd.startswith(('"', "'")):
        hook_cmd = f'"{hook_cmd}"'  # path with spaces (e.g. "Pc User") needs shell quoting

    command = f"{hook_cmd} {event_type}"
    if shell == "powershell":
        command = f"& {command}"  # call operator: a quoted path is a string in PowerShell
    config: dict[str, Any] = {
        "type": "command",
        "command": command,
        "timeout": 2,  # Seconds
    }
    if shell:
        config["shell"] = shell

    # Wrap in the structure expected by Claude Code
    # Structure:
    # "HookName": [
    #   {
    #     "matcher": ".*" (optional),
    #     "hooks": [ { "type": "command", ... } ]
    #   }
    # ]

    hook_entry: dict[str, Any] = {"hooks": [config]}

    # Hooks that support matchers (match all with ".*")
    if hook_type in [
        "PreToolUse",
        "PostToolUse",
        "PermissionRequest",
        "Notification",
        "SubagentStart",
        "SubagentStop",
    ]:
        hook_entry["matcher"] = ".*"

    return hook_entry


def is_same_hook(entry1: dict[str, Any], entry2: dict[str, Any]) -> bool:
    """Check if two hook entries are effectively the same."""
    # Simple comparison of command path
    try:
        cmd1 = entry1.get("hooks", [])[0].get("command")
        cmd2 = entry2.get("hooks", [])[0].get("command")
        return cmd1 == cmd2
    except (IndexError, AttributeError):
        return False


def _is_office_hook(entry: dict[str, Any]) -> bool:
    """True when the entry runs the ``claude-office-hook`` command."""
    try:
        return "claude-office-hook" in entry.get("hooks", [])[0].get("command", "")
    except (IndexError, AttributeError):
        return False


def install_hooks(
    hook_cmd: str,
    dry_run: bool = False,
    settings_path: Path | None = None,
    env: dict[str, str] | None = None,
    shell: str | None = None,
):
    """Install hooks into settings.

    Args:
        hook_cmd: Path to the claude-office-hook command
        dry_run: If True, don't actually save changes
        settings_path: settings.json to edit instead of the user-level one
            (e.g. a project's ``.claude/settings.json``)
        env: variables to merge into the settings ``env`` block
        shell: shell for the hook commands (see ``create_hook_config``)
    """
    settings_path = settings_path or get_settings_path()
    print(f"Installing hooks to {settings_path}...")

    settings = load_settings(settings_path)
    hooks_config = settings.get("hooks", {})

    changes_made = False

    if env:
        env_config = settings.get("env", {})
        for key, value in env.items():
            if env_config.get(key) != value:
                print(f"  [Env]  {key}={value}")
                env_config[key] = value
                changes_made = True
        if changes_made:
            settings["env"] = env_config

    for hook_type in HOOK_TYPES:
        new_entry = create_hook_config(hook_cmd, hook_type, shell)
        event_type = convert_camel_to_snake(hook_type)

        current_list = hooks_config.get(hook_type, [])

        # Check for duplicates
        if any(is_same_hook(existing, new_entry) for existing in current_list):
            print(f"  [Skip] {hook_type}: Hook already exists.")
            continue

        # Same tool installed in another format (e.g. bash -> powershell): replace, not duplicate.
        stale = [e for e in current_list if _is_office_hook(e)]
        if stale:
            current_list = [e for e in current_list if e not in stale]
            print(f"  [Replace] {hook_type}: {len(stale)} old Claude Office hook(s)")

        print(f"  [Add]  {hook_type}: {hook_cmd} {event_type}")
        current_list.append(new_entry)
        hooks_config[hook_type] = current_list
        changes_made = True

    if changes_made:
        settings["hooks"] = hooks_config
        if not dry_run:
            save_settings(settings_path, settings)
            print("Settings saved.")
        else:
            print("Dry run: No changes saved.")
    else:
        print("No changes needed.")


def uninstall_hooks(
    _hook_cmd: str, dry_run: bool = False, settings_path: Path | None = None
) -> None:
    """Remove hooks from settings.

    Args:
        _hook_cmd: Path to the claude-office-hook command (unused, hooks identified by pattern)
        dry_run: If True, don't actually save changes
        settings_path: settings.json to edit instead of the user-level one
    """
    del _hook_cmd  # Unused - hooks identified by pattern match
    settings_path = settings_path or get_settings_path()
    print(f"Uninstalling hooks from {settings_path}...")

    settings = load_settings(settings_path)
    hooks_config = settings.get("hooks", {})

    changes_made = False

    for hook_type in list(hooks_config.keys()):
        current_list = hooks_config[hook_type]
        original_len = len(current_list)

        # Filter out hooks that use our command (both new direct and old .sh wrappers)
        new_list: list[Any] = []
        for entry in current_list:
            try:
                cmd = entry.get("hooks", [])[0].get("command", "")
                # Match both "claude-office-hook" (new) and "claude-office/hooks/*.sh" (old)
                if "claude-office-hook" in cmd or "claude-office/hooks/" in cmd:
                    print(f"  [Remove] {hook_type}: {cmd}")
                    continue
            except (IndexError, AttributeError):
                pass
            new_list.append(entry)

        if len(new_list) < original_len:
            hooks_config[hook_type] = new_list
            changes_made = True

        # Clean up empty lists
        if not hooks_config[hook_type]:
            del hooks_config[hook_type]

    if changes_made:
        settings["hooks"] = hooks_config
        if not dry_run:
            save_settings(settings_path, settings)
            print("Settings saved.")
        else:
            print("Dry run: No changes saved.")
    else:
        print("No hooks found to remove.")


def convert_camel_to_snake(name: str) -> str:
    import re

    s1 = re.sub("(.)([A-Z][a-z]+)", r"\1_\2", name)
    return re.sub("([a-z0-9])([A-Z])", r"\1_\2", s1).lower()


def main():
    parser = argparse.ArgumentParser(description="Manage Claude Office hooks.")
    parser.add_argument("action", choices=["install", "uninstall"], help="Action to perform")
    parser.add_argument("--dry-run", action="store_true", help="Don't save changes")
    parser.add_argument("--hook-cmd", help="Path to claude-office-hook command", required=True)
    parser.add_argument(
        "--settings",
        type=Path,
        default=None,
        help="settings.json to edit (default: user-level ~/.claude/settings.json)",
    )

    parser.add_argument(
        "--shell",
        choices=["powershell"],
        default=None,
        help="shell Claude Code uses to run the hooks (default: Claude Code's own default, bash)",
    )
    parser.add_argument(
        "--set-env",
        action="append",
        default=[],
        metavar="KEY=VALUE",
        help="variable to merge into the settings env block (repeatable; install only)",
    )

    args = parser.parse_args()

    if args.action == "install":
        env = dict(item.split("=", 1) for item in args.set_env)
        install_hooks(args.hook_cmd, args.dry_run, args.settings, env, args.shell)
    elif args.action == "uninstall":
        uninstall_hooks(args.hook_cmd, args.dry_run, args.settings)


if __name__ == "__main__":
    main()
