import tempfile
import unittest
import zipfile
from pathlib import Path

from document_tools import extract_file


class DocumentToolsTests(unittest.TestCase):
    def test_extracts_json(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "data.json"
            path.write_text('{"ok":true}', encoding="utf-8")
            result = extract_file(path)
            self.assertIn('"ok": true', result["text"])

    def test_extracts_zip_entries(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "bundle.zip"
            with zipfile.ZipFile(path, "w") as archive:
                archive.writestr("note.txt", "hello")
            result = extract_file(path)
            self.assertEqual(result["entries"][0]["text"], "hello")


if __name__ == "__main__":
    unittest.main()