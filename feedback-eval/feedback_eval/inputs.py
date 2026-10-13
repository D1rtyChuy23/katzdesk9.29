"""Collect (label, text) pairs from files, directories, stdin, or one-text-per-line files."""

from __future__ import annotations

import sys
from pathlib import Path


def collect(paths: list[str], lines: bool) -> list[tuple[str, str]]:
    items: list[tuple[str, str]] = []
    for p in paths:
        if p == "-":
            _add(items, "stdin", sys.stdin.read(), lines)
            continue
        path = Path(p)
        if path.is_dir():
            for f in sorted(x for x in path.rglob("*") if x.is_file() and x.suffix.lower() in {".txt", ".md"}):
                _add(items, str(f), f.read_text(encoding="utf-8"), lines)
        elif path.is_file():
            _add(items, str(path), path.read_text(encoding="utf-8"), lines)
        else:
            raise FileNotFoundError(p)
    return items


def _add(items: list[tuple[str, str]], label: str, content: str, lines: bool) -> None:
    if lines:
        for n, line in enumerate(content.splitlines(), 1):
            if line.strip():
                items.append((f"{label}:{n}", line.strip()))
    elif content.strip():
        items.append((label, content.strip()))
