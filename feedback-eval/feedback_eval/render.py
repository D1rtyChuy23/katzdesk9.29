"""Terminal table and JSON output."""

from __future__ import annotations

import json
import shutil

from .dimensions import Dimension
from .evaluate import Result


def _cell(v: dict) -> str:
    if v["type"] == "score":
        return f"{v['score']:.1f}/{v['max']}"
    if v["type"] == "choice":
        return f"{v['choice']} ({v['confidence']:.0%})"
    return f"{v['probability']:.0%}"


def _clip(s: str, n: int) -> str:
    s = " ".join(s.split())
    return s if len(s) <= n else s[: n - 1] + "…"


def table(dims: list[Dimension], results: list[Result], text_width: int | None = None) -> str:
    cols = shutil.get_terminal_size((120, 20)).columns
    text_width = text_width or max(16, min(40, cols // 4))
    header = ["input", "text"] + [d.name for d in dims]
    rows = [header]
    for r in results:
        if r.error:
            rows.append([_clip(r.label, 28), _clip(r.text, text_width), f"ERROR {_clip(r.error, 60)}"] + [""] * (len(dims) - 1))
        else:
            rows.append([_clip(r.label, 28), _clip(r.text, text_width)] + [_cell(r.values[d.name]) for d in dims])
    widths = [max(len(row[i]) for row in rows) for i in range(len(header))]
    line = lambda row: "  ".join(c.ljust(w) for c, w in zip(row, widths)).rstrip()
    out = [line(rows[0]), "  ".join("-" * w for w in widths)] + [line(r) for r in rows[1:]]
    legend = ["", "score = expected level (0..max) · percent = probability the condition holds · choice (confidence)"]
    return "\n".join(out + legend)


def as_json(results: list[Result]) -> str:
    return json.dumps(
        [{"input": r.label, "text": r.text, "error": r.error, "dimensions": r.values} for r in results],
        indent=2, ensure_ascii=False,
    )
