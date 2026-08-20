import tempfile
import unittest
from pathlib import Path

from skill_registry import SkillRegistry


class SkillRegistryTests(unittest.TestCase):
    def test_discovers_and_runs_skill(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "skills"
            skill_dir = root / "echo"
            skill_dir.mkdir(parents=True)
            (skill_dir / "skill.json").write_text(
                '{"id":"echo","name":"Echo","description":"Echo input","entrypoint":"main.py"}',
                encoding="utf-8",
            )
            (skill_dir / "main.py").write_text("import sys\nprint(sys.stdin.read())\n", encoding="utf-8")
            registry = SkillRegistry(root)
            skills = registry.refresh()
            result = registry.run(skills[0].skill_id, "hello")
            self.assertEqual([skill.skill_id for skill in skills], ["echo"])
            self.assertEqual(result["status"], "success")
            self.assertIn("hello", result["stdout"])

    def test_rejects_entrypoint_outside_skill_directory(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "skills"
            skill_dir = root / "bad"
            skill_dir.mkdir(parents=True)
            (skill_dir / "skill.json").write_text(
                '{"id":"bad","name":"Bad","description":"Bad","entrypoint":"../main.py"}',
                encoding="utf-8",
            )
            self.assertEqual(SkillRegistry(root).refresh(), [])

    def test_saves_only_verified_skill(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "skills"
            registry = SkillRegistry(root)
            result = registry.save_verified(
                "saved-skill",
                "Saved skill",
                "A verified test skill",
                "import sys\nprint(sys.stdin.read())\n",
                "test input",
            )
            self.assertEqual(result["status"], "saved")
            self.assertIsNotNone(registry.get("saved-skill"))


if __name__ == "__main__":
    unittest.main()