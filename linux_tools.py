"""Read-only Linux tools exposed to the worker."""

from __future__ import annotations

import os
import platform
import shutil
import subprocess
from typing import Any


TOOLS: dict[str, tuple[str, ...]] = {
    "pwd": ("pwd",),
    "ls": ("ls", "-la"),
    "uname": ("uname", "-a"),
    "python_version": ("python", "--version"),
    "git_status": ("git", "status", "--short"),
    "disk_usage": ("df", "-h", "."),
}


def execute_linux_tool(tool_name: str) -> dict[str, Any]:
    command = TOOLS.get(tool_name)
    if command is None:
        raise ValueError(f"Unsupported Linux tool: {tool_name}")
    if shutil.which(command[0]) is None:
        raise RuntimeError(f"Linux executable is unavailable: {command[0]}")
    result = subprocess.run(
        command,
        cwd=os.getcwd(),
        capture_output=True,
        text=True,
        timeout=15,
        check=False,
    )
    return {
        "tool": tool_name,
        "status": "success" if result.returncode == 0 else "error",
        "stdout": result.stdout[-10_000:],
        "stderr": result.stderr[-10_000:],
        "exit_code": result.returncode,
        "platform": platform.system(),
    }


def execute_linux_command(command: str) -> dict[str, Any]:
    """Run a shell command only when explicitly enabled inside the Linux VM."""
    if os.environ.get("AGENT_ALLOW_SHELL") != "true":
        raise PermissionError("Set AGENT_ALLOW_SHELL=true only inside the isolated Linux VM")
    result = subprocess.run(
        command,
        cwd=os.getcwd(),
        shell=True,
        capture_output=True,
        text=True,
        timeout=120,
        check=False,
    )
    return {
        "status": "success" if result.returncode == 0 else "error",
        "stdout": result.stdout[-20_000:],
        "stderr": result.stderr[-20_000:],
        "exit_code": result.returncode,
    }