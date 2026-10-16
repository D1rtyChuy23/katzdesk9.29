---
name: cli-anything-gimp
description: Create and edit raster images from the command line with cli-anything-gimp, a stateful GIMP/Pillow CLI. Use when asked to make or modify an image, poster, banner, thumbnail or composite without a GUI, including layers, text, shapes, filters, crop/resize and PNG/JPEG export.
---

# cli-anything-gimp

Stateful image editing from the command line. A project is a JSON file
(`*.gimp-cli.json`) holding the canvas, layers, filters and deferred draw ops;
`export render` turns it into an image.

## Setup (check first)

```bash
cli-anything-gimp --help >/dev/null 2>&1 && echo ok || echo missing
gimp --version   # optional; without it rendering falls back to Pillow
```

If missing, install. `cli-hub install gimp` can fail with a `setup.py` README
error, so install from the repo instead:

```bash
git clone --depth 1 https://github.com/HKUDS/CLI-Anything
pip install --use-pep517 CLI-Anything/gimp/agent-harness
```

`--use-pep517` avoids `AttributeError: install_layout` on Debian/Ubuntu pip.
For native GIMP rendering: `apt install gimp` / `brew install --cask gimp` /
`winget install GIMP.GIMP`.

## Usage

The project file goes in the **global** `--project` option, before the
subcommand. Add `--json` for machine-readable output. Use absolute paths.

```bash
P=/abs/path/poster.gimp-cli.json

# New project
cli-anything-gimp project new -w 1200 -h 630 -bg "#1e1e2e" -n poster -o $P

# Layers (a new project has none; add one before drawing)
cli-anything-gimp --project $P layer new -n bg --fill "#1e1e2e"
cli-anything-gimp --project $P layer add-from-file /abs/path/photo.jpg
cli-anything-gimp --project $P layer list
cli-anything-gimp --project $P layer set 0 opacity 0.8
cli-anything-gimp --project $P layer set 0 offset_x -48   # negatives OK

# Text and shapes (applied at render time)
cli-anything-gimp --project $P draw text -l 0 -t "Launch Night" --x 96 --y 120 --size 72 --color "#f6f1e8"
cli-anything-gimp --project $P draw rect --help

# Filters
cli-anything-gimp filter list-available
cli-anything-gimp --project $P filter add --help

# Render
cli-anything-gimp --project $P export render /abs/path/out.png --overwrite
```

Run `cli-anything-gimp <group> <command> --help` for exact flags. Groups:
`project`, `layer`, `canvas` (resize/scale/crop/mode/dpi), `filter`, `draw`,
`media` (probe/histogram/check), `export` (presets/render), `session`
(undo/redo/history). Running with no subcommand opens an interactive REPL.

## Rules

1. Check the exit code; on failure read stderr.
2. `draw` ops and offsets only show up in the render. Always check the
   exported image (open/view it), not just the project JSON.
3. Confirm the output file exists and has the expected size after rendering.
