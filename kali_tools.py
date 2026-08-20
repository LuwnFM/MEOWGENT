"""Discover the Kali tool universe available in the Linux VM."""

from __future__ import annotations

import json
import re
import shutil
import subprocess
from typing import Any


PACKAGE_NAME = re.compile(r"^[a-z0-9][a-z0-9+.-]{0,99}$")


def discover_kali_tools() -> dict[str, Any]:
    packages: list[str] = []
    apt = shutil.which("apt-cache")
    if apt:
        result = subprocess.run([apt, "pkgnames"], capture_output=True, text=True, timeout=30, check=False)
        packages = sorted(line for line in result.stdout.splitlines() if line.startswith("kali-tools-"))
    executables: dict[str, str] = {}
    for package in packages:
        binary_name = package.removeprefix("kali-tools-")
        path = shutil.which(binary_name)
        if path:
            executables[binary_name] = path
    return {"kali_packages": packages, "installed_executables": executables}


def catalog_json() -> str:
    return json.dumps(discover_kali_tools(), ensure_ascii=False)


def install_kali_package(tool_id: str) -> dict[str, Any]:
    """Install any package exposed by the configured Kali APT repositories."""
    package = tool_id.strip()
    if not PACKAGE_NAME.fullmatch(package):
        raise ValueError("invalid APT package name")
    if shutil.which("apt-get") is None:
        raise RuntimeError("apt-get is unavailable; run this worker in Kali Linux")
    availability = subprocess.run(
        ["apt-cache", "show", package],
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )
    if availability.returncode != 0 or not availability.stdout.strip():
        return {"tool": package, "status": "unavailable", "stderr": "Package is not present in configured APT repositories"}
    result = subprocess.run(
        ["apt-get", "install", "-y", package],
        capture_output=True,
        text=True,
        timeout=600,
        check=False,
    )
    return {
        "tool": tool_id,
        "package": package,
        "status": "success" if result.returncode == 0 else "error",
        "stdout": result.stdout[-10_000:],
        "stderr": result.stderr[-10_000:],
        "exit_code": result.returncode,
    }