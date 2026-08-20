"""Download, reputation-check and install Python wheels in the worker VM."""

from __future__ import annotations

import hashlib
import os
import re
import subprocess
import tempfile
from pathlib import Path
from typing import Any

import requests


PACKAGE_NAME = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_.+@/-]{0,127}$")


def _validate_package(package: str) -> str:
    package = package.strip()
    if not PACKAGE_NAME.fullmatch(package) or any(token in package for token in ("://", "..", "\n", "\r")):
        raise ValueError("package must be a repository package name, not a URL or path")
    return package


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _virustotal_verdict(path: Path) -> str:
    api_key = os.environ.get("VIRUSTOTAL_API_KEY")
    if not api_key:
        raise PermissionError("VIRUSTOTAL_API_KEY is required for package installation")
    response = requests.get(
        f"https://www.virustotal.com/api/v3/files/{_sha256(path)}",
        headers={"x-apikey": api_key},
        timeout=30,
    )
    if response.status_code == 404:
        return "unknown"
    response.raise_for_status()
    stats = response.json().get("data", {}).get("attributes", {}).get("last_analysis_stats", {})
    return "malicious" if stats.get("malicious", 0) > 0 else "clean"


def install_python_package(package: str) -> dict[str, Any]:
    """Install a public binary wheel only after reputation checks."""
    package = _validate_package(package)
    with tempfile.TemporaryDirectory(prefix="agent-package-") as directory:
        download = subprocess.run(
            ["python", "-m", "pip", "download", "--only-binary=:all:", "--no-deps", "--dest", directory, package],
            capture_output=True,
            text=True,
            timeout=180,
            check=False,
        )
        if download.returncode != 0:
            return {"status": "error", "stage": "download", "stderr": download.stderr[-10_000:]}
        artifacts = sorted(Path(directory).glob("*.whl"))
        if not artifacts:
            return {"status": "error", "stage": "policy", "stderr": "Only binary wheels are allowed"}
        verdicts = {artifact.name: _virustotal_verdict(artifact) for artifact in artifacts}
        if any(verdict == "malicious" for verdict in verdicts.values()):
            return {"status": "blocked", "stage": "virustotal", "verdicts": verdicts}
        if any(verdict == "unknown" for verdict in verdicts.values()) and os.environ.get("ALLOW_UNKNOWN_PACKAGE_SCAN") != "true":
            return {"status": "blocked", "stage": "virustotal", "verdicts": verdicts, "reason": "unknown verdict"}
        install = subprocess.run(
            ["python", "-m", "pip", "install", "--no-deps", *[str(artifact) for artifact in artifacts]],
            capture_output=True,
            text=True,
            timeout=180,
            check=False,
        )
        return {
            "status": "success" if install.returncode == 0 else "error",
            "verdicts": verdicts,
            "stdout": install.stdout[-10_000:],
            "stderr": install.stderr[-10_000:],
        }


def install_apt_package(package: str) -> dict[str, Any]:
    """Install a package from the VM's configured Debian/Kali repositories."""
    package = _validate_package(package)
    if shutil.which("apt-get") is None:
        raise RuntimeError("apt-get is unavailable in this worker image")
    available = subprocess.run(["apt-cache", "show", package], capture_output=True, text=True, timeout=30, check=False)
    if available.returncode != 0 or not available.stdout.strip():
        return {"status": "unavailable", "manager": "apt", "package": package}
    result = subprocess.run(["apt-get", "install", "-y", package], capture_output=True, text=True, timeout=600, check=False)
    return {
        "status": "success" if result.returncode == 0 else "error",
        "manager": "apt",
        "package": package,
        "stdout": result.stdout[-10_000:],
        "stderr": result.stderr[-10_000:],
    }


def install_node_package(package: str) -> dict[str, Any]:
    """Install a package from the configured npm registry in the worker VM."""
    package = _validate_package(package)
    if shutil.which("npm") is None:
        raise RuntimeError("npm is unavailable in this worker image")
    result = subprocess.run(
        ["npm", "install", "--global", "--ignore-scripts", package],
        capture_output=True,
        text=True,
        timeout=600,
        check=False,
    )
    return {
        "status": "success" if result.returncode == 0 else "error",
        "manager": "npm",
        "package": package,
        "stdout": result.stdout[-10_000:],
        "stderr": result.stderr[-10_000:],
    }


def install_package(manager: str, package: str) -> dict[str, Any]:
    """Install a repository package using an explicitly selected manager."""
    if manager == "apt":
        return install_apt_package(package)
    if manager == "pip":
        return install_python_package(package)
    if manager == "npm":
        return install_node_package(package)
    raise ValueError("manager must be one of: apt, pip, npm")