#!/bin/sh
set -eu
cd /workspace
# Any HTTP answer, even an error page, means the dev server is already running. Starting a second copy
# would open the same local database folder twice, which can corrupt it.
if curl -s -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
  exit 0
fi
npm run dev >>/tmp/app-startup.log 2>&1 &
