import json

import httpx2
from typesafe_sdk import TypeSafeClient

from feedback_eval import render
from feedback_eval.dimensions import ConfigError, load_dimensions
from feedback_eval.evaluate import evaluate_all

import pathlib
import pytest

CONFIG = pathlib.Path(__file__).resolve().parent.parent / "dimensions.yaml"


def fake_answers(request: httpx2.Request) -> httpx2.Response:
    body = json.loads(request.content)
    answers = {}
    for name, q in body["questions"].items():
        if q["type"] == "score":
            n = len(q["criteria"])
            probs = {str(i): (0.7 if i == n - 1 else 0.3 / (n - 1)) for i in range(n)}
            answers[name] = {"type": "score", "score": 3.5, "confidence": 0.7, "legend": {str(i): "x" for i in range(n)}, "probabilities": probs}
        elif q["type"] == "choice":
            first = next(iter(q["criteria"]))
            answers[name] = {"type": "choice", "choice": first, "confidence": 0.9, "probabilities": {k: 1 / len(q["criteria"]) for k in q["criteria"]}}
        else:
            answers[name] = {"type": "noul", "noul": 0.82}
    return httpx2.Response(200, json={"model": "jev", "usage": {}, "answers": answers})


def test_end_to_end_with_mock_transport():
    dims = load_dimensions(CONFIG)
    client = TypeSafeClient(api_key="k", transport=httpx2.MockTransport(fake_answers))
    results = evaluate_all(client, dims, [("a", "text one"), ("b", "text two")])
    assert all(r.error is None for r in results)
    assert results[0].values["is_complaint"]["probability"] == 0.82
    out = render.table(dims, results)
    assert "sentiment" in out and "3.5/4" in out and "82%" in out
    json.loads(render.as_json(results))


def test_bad_config(tmp_path):
    p = tmp_path / "d.yaml"
    p.write_text("dimensions:\n  - {name: x, type: score, instructions: hi, levels: [a]}\n")
    with pytest.raises(ConfigError):
        load_dimensions(p)
