"""Discover and execute explicitly registered agent skills."""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any


SKILL_ID = re.compile(r"^[a-z0-9][a-z0-9_-]{1,63}$")


@dataclass(frozen=True)
class Skill:
    skill_id: str
    name: str
    description: str
    entrypoint: Path
    timeout_seconds: int


class SkillRegistry:
    def __init__(self, root: str | Path = "skills") -> None:
        self.root = Path(root).resolve()
        self._skills: dict[str, Skill] = {}

    def refresh(self) -> list[Skill]:
        discovered: dict[str, Skill] = {}
        if self.root.is_dir():
            for manifest_path in sorted(self.root.glob("*/skill.json")):
                try:
                    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
                    skill = self._from_manifest(manifest_path, manifest)
                except (OSError, ValueError, TypeError, KeyError) as error:
                    print(f"[!] Ignoring invalid skill manifest {manifest_path}: {error}")
                    continue
                if skill.skill_id in discovered:
                    print(f"[!] Ignoring duplicate skill id: {skill.skill_id}")
                    continue
                discovered[skill.skill_id] = skill
        self._skills = discovered
        return list(discovered.values())

    def _from_manifest(self, path: Path, manifest: Any) -> Skill:
        if not isinstance(manifest, dict):
            raise ValueError("manifest must be an object")
        skill_id = manifest["id"]
        name = manifest["name"]
        description = manifest["description"]
        entrypoint = manifest["entrypoint"]
        timeout = manifest.get("timeout_seconds", 60)
        if not all(isinstance(value, str) for value in (skill_id, name, description, entrypoint)):
            raise TypeError("id, name, description and entrypoint must be strings")
        if not SKILL_ID.fullmatch(skill_id):
            raise ValueError("invalid skill id")
        if not isinstance(timeout, int) or not 1 <= timeout <= 300:
            raise ValueError("timeout_seconds must be between 1 and 300")
        resolved_entrypoint = (path.parent / entrypoint).resolve()
        if resolved_entrypoint.parent != path.parent.resolve() or not resolved_entrypoint.is_file():
            raise ValueError("entrypoint must be a file inside the skill directory")
        return Skill(skill_id, name, description, resolved_entrypoint, timeout)

    def catalog(self) -> str:
        if not self._skills:
            return "No registered skills are available."
        return "\n".join(
            f"- {skill.skill_id}: {skill.name} - {skill.description}"
            for skill in self._skills.values()
        )

    def get(self, skill_id: str) -> Skill | None:
        return self._skills.get(skill_id)

    def run(self, skill_id: str, instruction: str) -> dict[str, Any]:
        skill = self.get(skill_id)
        if skill is None:
            raise ValueError(f"Unknown skill: {skill_id}")
        payload = json.dumps({"instruction": instruction}, ensure_ascii=False)
        environment = {"PATH": os.environ.get("PATH", ""), "PYTHONUNBUFFERED": "1"}
        try:
            result = subprocess.run(
                [sys.executable, str(skill.entrypoint)],
                input=payload,
                cwd=skill.entrypoint.parent,
                env=environment,
                capture_output=True,
                text=True,
                timeout=skill.timeout_seconds,
                check=False,
            )
        except subprocess.TimeoutExpired:
            return {"status": "error", "stdout": "", "stderr": "Skill timed out", "exit_code": -1}
        return {
            "status": "success" if result.returncode == 0 else "error",
            "stdout": result.stdout[-20_000:],
            "stderr": result.stderr[-20_000:],
            "exit_code": result.returncode,
        }

    def save_verified(
        self,
        skill_id: str,
        name: str,
        description: str,
        code: str,
        test_instruction: str,
        timeout_seconds: int = 60,
    ) -> dict[str, Any]:
        """Validate a generated skill before making it discoverable."""
        if not SKILL_ID.fullmatch(skill_id):
            raise ValueError("invalid skill id")
        if self.get(skill_id) is not None:
            raise ValueError(f"skill already exists: {skill_id}")
        if not code.strip() or len(code) > 100_000:
            raise ValueError("skill code is empty or too large")
        compile(code, f"{skill_id}/main.py", "exec")
        self.root.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=self.root.parent) as temporary:
            temporary_root = Path(temporary) / "skills"
            skill_dir = temporary_root / skill_id
            skill_dir.mkdir(parents=True)
            (skill_dir / "main.py").write_text(code, encoding="utf-8")
            (skill_dir / "skill.json").write_text(json.dumps({
                "id": skill_id,
                "name": name[:160],
                "description": description[:500],
                "entrypoint": "main.py",
                "timeout_seconds": max(1, min(timeout_seconds, 300)),
            }), encoding="utf-8")
            candidate_registry = SkillRegistry(temporary_root)
            candidate_registry.refresh()
            result = candidate_registry.run(skill_id, test_instruction)
            if result["status"] != "success":
                raise RuntimeError(f"skill verification failed: {result['stderr']}")
        destination = self.root / skill_id
        destination.mkdir(parents=True)
        (destination / "main.py").write_text(code, encoding="utf-8")
        (destination / "skill.json").write_text(json.dumps({
            "id": skill_id,
            "name": name[:160],
            "description": description[:500],
            "entrypoint": "main.py",
            "timeout_seconds": max(1, min(timeout_seconds, 300)),
        }, indent=2), encoding="utf-8")
        self.refresh()
        return {"status": "saved", "skill_id": skill_id, "test_output": result["stdout"]}