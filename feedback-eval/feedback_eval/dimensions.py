"""Load dimension definitions from YAML/JSON and turn them into TypeSafe questions."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from typesafe_sdk import Choice, Noul, Score

KINDS = ("score", "noul", "choice")


class ConfigError(ValueError):
    pass


@dataclass(frozen=True)
class Dimension:
    name: str
    kind: str
    instructions: str
    levels: tuple[Any, ...] = ()  # score
    options: dict[str, Any] | None = None  # choice
    yes: Any = None  # noul (optional outcome descriptions)
    no: Any = None

    def question(self) -> Score | Noul | Choice:
        if self.kind == "score":
            return Score(instructions=self.instructions, criteria=list(self.levels))
        if self.kind == "choice":
            return Choice(instructions=self.instructions, criteria=dict(self.options or {}))
        criteria = {k: v for k, v in (("true", self.yes), ("false", self.no)) if v is not None}
        return Noul(instructions=self.instructions, criteria=criteria or None)

    @property
    def max_level(self) -> int:
        return len(self.levels) - 1


def _level(raw: Any) -> Any:
    # YAML parses "Name: description" list items as one-key dicts; flatten to text.
    if isinstance(raw, dict) and len(raw) == 1:
        (k, v), = raw.items()
        if isinstance(v, str):
            return f"{k}: {v}"
    return raw


def load_dimensions(path: Path) -> list[Dimension]:
    text = path.read_text(encoding="utf-8")
    if path.suffix.lower() == ".json":
        data = json.loads(text)
    else:
        import yaml

        data = yaml.safe_load(text)
    items = data.get("dimensions") if isinstance(data, dict) else data
    if not isinstance(items, list) or not items:
        raise ConfigError(f"{path}: expected a non-empty 'dimensions' list")

    dims: list[Dimension] = []
    seen: set[str] = set()
    for i, d in enumerate(items):
        where = f"{path}: dimension #{i + 1}"
        if not isinstance(d, dict):
            raise ConfigError(f"{where} must be a mapping")
        name, kind, instr = d.get("name"), d.get("type"), d.get("instructions")
        if not isinstance(name, str) or not name.strip():
            raise ConfigError(f"{where} needs a 'name'")
        if name in seen:
            raise ConfigError(f"{where}: duplicate name {name!r}")
        seen.add(name)
        where = f"{path}: dimension {name!r}"
        if kind not in KINDS:
            raise ConfigError(f"{where}: type must be one of {', '.join(KINDS)}")
        if not instr:
            raise ConfigError(f"{where} needs 'instructions' (Jev never sees the name)")
        if kind == "score":
            levels = d.get("levels")
            if not isinstance(levels, list) or len(levels) < 2:
                raise ConfigError(f"{where}: score needs a 'levels' list of at least 2 entries")
            dims.append(Dimension(name, kind, instr, levels=tuple(_level(x) for x in levels)))
        elif kind == "choice":
            options = d.get("options")
            if not isinstance(options, dict) or len(options) < 2:
                raise ConfigError(f"{where}: choice needs an 'options' mapping of at least 2 labels")
            dims.append(Dimension(name, kind, instr, options={str(k): v for k, v in options.items()}))
        else:
            dims.append(Dimension(name, kind, instr, yes=d.get("yes"), no=d.get("no")))
    return dims
