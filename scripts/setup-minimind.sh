#!/usr/bin/env bash
# Sets up jingyaogong/minimind outside this repo, downloads the minimind-3
# weights and runs eval_llm.py in auto-test mode. Safe to re-run.
#
#   bash scripts/setup-minimind.sh            # setup + download + eval
#   SKIP_EVAL=1 bash scripts/setup-minimind.sh
#
# Env: MINIMIND_DIR (default /home/user/minimind), MAX_NEW_TOKENS (default 256).
# Needs huggingface.co (or www.modelscope.cn) allowed in the network policy.
set -euo pipefail

DIR="${MINIMIND_DIR:-/home/user/minimind}"
MAX_NEW_TOKENS="${MAX_NEW_TOKENS:-256}"

if [ ! -d "$DIR/.git" ]; then
  git clone --depth 1 https://github.com/jingyaogong/minimind "$DIR"
fi
cd "$DIR"

# Pinned deps (numpy 1.26.4, scikit-learn 1.5.1) have no Python 3.13 wheels.
if [ ! -x .venv/bin/python ]; then
  if command -v uv >/dev/null; then
    uv venv -q --python python3.11 .venv
  else
    python3.11 -m venv .venv
  fi
fi
PY="$DIR/.venv/bin/python"
pip_install() {
  if command -v uv >/dev/null; then uv pip install -q --python "$PY" "$@"
  else "$PY" -m pip install -q "$@"; fi
}

# Default PyPI: the Aliyun mirror from the README is blocked here.
# pyarrow is unpinned upstream; >=21 requires NumPy 2 and breaks `datasets`.
pip_install -r requirements.txt
pip_install "pyarrow<21" numpy==1.26.4

if [ ! -f minimind-3/config.json ]; then
  rm -rf minimind-3
  if ! "$PY" -c "from huggingface_hub import snapshot_download; snapshot_download('jingyaogong/minimind-3', local_dir='minimind-3')"; then
    echo "Hugging Face download failed; trying ModelScope..." >&2
    rm -rf minimind-3
    if ! .venv/bin/modelscope download --model gongjy/minimind-3 --local_dir ./minimind-3; then
      echo "Could not download minimind-3. Allow huggingface.co in the environment's network access settings and start a new session." >&2
      exit 1
    fi
  fi
fi

"$PY" -c "import transformers, datasets, torch; print('torch', torch.__version__, '| cuda', torch.cuda.is_available())"

if [ -z "${SKIP_EVAL:-}" ]; then
  # "0" selects the built-in auto-test prompts instead of interactive input.
  echo 0 | "$PY" eval_llm.py --load_from ./minimind-3 --max_new_tokens "$MAX_NEW_TOKENS"
fi
