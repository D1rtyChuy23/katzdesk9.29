---
name: minimind
description: Set up, download and run jingyaogong/minimind's minimind-3 (a 64M-parameter Chinese/English chat LLM) from Hugging Face in a cloud session, then evaluate it with the built-in test prompts or custom prompts. Use when asked to run, rerun, test or chat with MiniMind / minimind-3, or when a Hugging Face model download stalls at 0 bytes in this environment.
---

# MiniMind (minimind-3)

Runs [jingyaogong/minimind](https://github.com/jingyaogong/minimind) with the
[`jingyaogong/minimind-3`](https://huggingface.co/jingyaogong/minimind-3)
weights. Everything lives outside the repo in `MINIMIND_DIR`
(default `/home/user/minimind`): the clone, a Python 3.11 venv, and the
weights in `minimind-3/`.

## Run it

```bash
bash .claude/skills/minimind/scripts/setup-minimind.sh
```

The script is safe to re-run. It skips the clone, venv and download when
they already exist, then runs `eval_llm.py` on its 8 built-in prompts.
Run it in the background: the first run installs torch and takes several
minutes.

| Env var | Default | Effect |
| --- | --- | --- |
| `MINIMIND_DIR` | `/home/user/minimind` | Where the clone, venv and weights go |
| `MAX_NEW_TOKENS` | `256` | Answer length cap; 256 cuts most answers off mid-sentence, so use 1024 for full answers |
| `SKIP_EVAL` | unset | Set to `1` for setup and download only |

## Custom prompts

Mode `1` reads prompts from stdin, one per line, and an empty line ends it:

```bash
cd /home/user/minimind
printf '1\nWhat is the capital of France?\nExplain gravity simply.\n\n' \
  | .venv/bin/python eval_llm.py --load_from ./minimind-3 --max_new_tokens 512
```

Other `eval_llm.py` flags: `--temperature` (0.85), `--top_p` (0.95),
`--historys N` (carry N past turns, must be even), `--open_thinking 1`.

## Network requirements

`huggingface.co` alone is not enough. It serves the small files, but the
weights come from other hosts. When those are blocked, `model.safetensors`
sits at 0 bytes in `minimind-3/.cache/huggingface/download/*.incomplete`
and the download hangs. Allow these hosts in the environment's network
access settings:

- `huggingface.co`
- `cas-server.xethub.hf.co` (Xet transfers, used by `huggingface_hub` by default)
- `us.aws.cdn.hf.co` (plain HTTP redirect target)

The fallback is ModelScope (`www.modelscope.cn`). To diagnose, run
`curl -sS "$HTTPS_PROXY/__agentproxy/status"`: blocked hosts appear under
`recentRelayFailures` as `connect_rejected`.

If a download was interrupted, delete `minimind-3/` before rerunning. The
script checks for the weights file, so a partial folder that has only
`config.json` is fetched again.

## What to expect

- CPU-only session: about 46–54 tokens/s.
- The model answers fluently in Chinese, with markdown structure. It is
  64M parameters, so expect factual slips; report them as model quality,
  not a setup failure.
- Pinned deps (`numpy==1.26.4`, `scikit-learn==1.5.1`) have no Python 3.13
  wheels, so the venv uses Python 3.11. `pyarrow` is held below 21 to stay
  on NumPy 1.
