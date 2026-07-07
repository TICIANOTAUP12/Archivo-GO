#!/usr/bin/env bash
set -euo pipefail

CONF="/home/dev_taup/nginx/sites-available/landings.sistemataup.online.conf"
SNIP="/home/dev_taup/archivo-gateway-snippet.conf"

if grep -q 'archivo-gateway' "$CONF"; then
  echo "already_configured"
  exit 0
fi

python3 - "$CONF" "$SNIP" <<'PY'
import sys
from pathlib import Path

conf_path = Path(sys.argv[1])
snippet_path = Path(sys.argv[2])
text = conf_path.read_text()
snippet = snippet_path.read_text()
needle = "    location / {\n        proxy_pass http://127.0.0.1:3023;"
if needle not in text:
    raise SystemExit("needle not found in nginx config")
conf_path.write_text(text.replace(needle, snippet + needle, 1))
print("snippet_added")
PY

if sudo -n nginx -t; then
  sudo -n systemctl reload nginx
  echo "nginx_reloaded"
else
  echo "run_manually: sudo nginx -t && sudo systemctl reload nginx"
fi
