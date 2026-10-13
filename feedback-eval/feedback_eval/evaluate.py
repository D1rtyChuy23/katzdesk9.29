"""Run all dimensions over each text. One request per text; its questions run in parallel server-side."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from typing import Any

from typesafe_sdk import TypeSafeClient, TypeSafeError

from .dimensions import Dimension

STATE_KEY = "customer_feedback"


@dataclass
class Result:
    label: str
    text: str
    values: dict[str, dict[str, Any]] = field(default_factory=dict)  # dimension -> raw result
    error: str | None = None


def _extract(dim: Dimension, response: Any) -> dict[str, Any]:
    if dim.kind == "score":
        a = response.scores[dim.name]
        return {"type": "score", "score": a.score, "max": dim.max_level, "confidence": a.confidence,
                "probabilities": {str(k): v for k, v in sorted(a.probabilities.items())}}
    if dim.kind == "choice":
        a = response.choices[dim.name]
        return {"type": "choice", "choice": a.choice, "confidence": a.confidence, "probabilities": a.probabilities}
    return {"type": "noul", "probability": response.nouls[dim.name].noul}


def evaluate_one(client: TypeSafeClient, dims: list[Dimension], label: str, text: str) -> Result:
    questions = {d.name: d.question() for d in dims}
    try:
        response = client.system_one(state={STATE_KEY: text}, questions=questions)
        return Result(label, text, {d.name: _extract(d, response) for d in dims})
    except (TypeSafeError, KeyError) as exc:
        return Result(label, text, error=f"{type(exc).__name__}: {exc}")


def evaluate_all(client: TypeSafeClient, dims: list[Dimension], items: list[tuple[str, str]], workers: int = 8) -> list[Result]:
    with ThreadPoolExecutor(max_workers=max(1, workers)) as pool:
        return list(pool.map(lambda it: evaluate_one(client, dims, *it), items))
