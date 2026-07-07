#!/usr/bin/env bash
set -euo pipefail

CONF="/home/dev_taup/nginx/sites-available/landings.sistemataup.online.conf"
HTTP_SNIP="/home/dev_taup/archivo-gateway-http-snippet.conf"

cat > "$HTTP_SNIP" <<'EOF'

    # Archivo-GO gateway IA — HTTP para Win7 (sin TLS)
    location /archivo-gateway/ {
        proxy_pass http://127.0.0.1:8091/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
        client_max_body_size 2m;
    }

EOF

python3 - "$CONF" "$HTTP_SNIP" <<'PY'
import sys
from pathlib import Path

conf_path = Path(sys.argv[1])
http_snip_path = Path(sys.argv[2])
text = conf_path.read_text()
http_snip = http_snip_path.read_text()

if "archivo-gateway" in text.split("listen 443")[0]:
    print("http_snippet_already_present")
else:
    needle = "    include /etc/nginx/snippets/security-hardening-http.conf;\n\n    location / {\n        return 301 https://$host$request_uri;"
    if needle not in text:
        raise SystemExit("http needle not found")
    conf_path.write_text(text.replace(needle, "    include /etc/nginx/snippets/security-hardening-http.conf;\n" + http_snip + "\n    location / {\n        return 301 https://$host$request_uri;", 1))
    print("http_snippet_added")
PY

nginx -t
systemctl reload nginx
echo "nginx_reloaded"

curl -s http://127.0.0.1/archivo-gateway/health -H "Host: sistemataup.online"
