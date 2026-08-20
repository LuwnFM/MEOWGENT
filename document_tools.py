"""Extract safe, bounded text from common files and archives."""

from __future__ import annotations

import json
import mimetypes
import zipfile
from pathlib import Path
from typing import Any


MAX_FILE_BYTES = 25 * 1024 * 1024
MAX_TEXT_CHARS = 200_000
MAX_ARCHIVE_ENTRIES = 200


def extract_file(path: str | Path) -> dict[str, Any]:
    file_path = Path(path).resolve()
    if not file_path.is_file():
        raise FileNotFoundError(file_path)
    if file_path.stat().st_size > MAX_FILE_BYTES:
        raise ValueError("file exceeds the configured size limit")
    if zipfile.is_zipfile(file_path):
        return _extract_zip(file_path)
    content = _read_text(file_path)
    return {
        "name": file_path.name,
        "mime": mimetypes.guess_type(file_path.name)[0] or "application/octet-stream",
        "text": content[:MAX_TEXT_CHARS],
        "truncated": len(content) > MAX_TEXT_CHARS,
    }


def _read_text(path: Path) -> str:
    raw = path.read_bytes()
    if path.suffix.lower() == ".json":
        return json.dumps(json.loads(raw.decode("utf-8")), ensure_ascii=False, indent=2)
    return raw.decode("utf-8", errors="replace")


def _extract_zip(path: Path) -> dict[str, Any]:
    entries: list[dict[str, Any]] = []
    with zipfile.ZipFile(path) as archive:
        for info in archive.infolist()[:MAX_ARCHIVE_ENTRIES]:
            if info.is_dir() or info.file_size > MAX_FILE_BYTES:
                continue
            name = Path(info.filename).name
            try:
                text = archive.read(info).decode("utf-8", errors="replace")
            except (KeyError, RuntimeError, UnicodeError):
                continue
            entries.append({"name": name, "text": text[:MAX_TEXT_CHARS]})
    return {"name": path.name, "mime": "application/zip", "entries": entries}