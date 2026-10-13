"""feedback-eval: score customer feedback on configurable dimensions with Jev."""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from typesafe_sdk import TypeSafeClient, TypeSafeError

from . import render
from .dimensions import ConfigError, load_dimensions
from .evaluate import evaluate_all
from .inputs import collect

DEFAULT_CONFIG = Path(__file__).resolve().parent.parent / "dimensions.yaml"


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="feedback-eval", description=__doc__)
    p.add_argument("inputs", nargs="+", help="text files, directories of .txt/.md files, or '-' for stdin")
    p.add_argument("-d", "--dimensions", type=Path, default=DEFAULT_CONFIG, help="dimensions YAML/JSON (default: bundled dimensions.yaml)")
    p.add_argument("--lines", action="store_true", help="treat every non-empty line of each input as a separate text")
    p.add_argument("--json", action="store_true", help="print full JSON (incl. probabilities) instead of a table")
    p.add_argument("-o", "--output", type=Path, help="also write the full JSON results to this file")
    p.add_argument("-j", "--workers", type=int, default=8, help="parallel requests (default: 8)")
    p.add_argument("--model", help="TypeSafe model name (default: account default)")
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        dims = load_dimensions(args.dimensions)
        items = collect(args.inputs, args.lines)
    except (ConfigError, FileNotFoundError, OSError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    if not items:
        print("error: no texts found", file=sys.stderr)
        return 2
    if not os.environ.get("TYPESAFE_API_KEY"):
        print("error: set TYPESAFE_API_KEY", file=sys.stderr)
        return 2

    try:
        with TypeSafeClient(model=args.model) as client:
            results = evaluate_all(client, dims, items, args.workers)
    except TypeSafeError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    js = render.as_json(results)
    if args.output:
        args.output.write_text(js + "\n", encoding="utf-8")
    print(js if args.json else render.table(dims, results))
    return 1 if any(r.error for r in results) else 0


if __name__ == "__main__":
    raise SystemExit(main())
