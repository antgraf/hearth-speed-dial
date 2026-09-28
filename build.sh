#!/usr/bin/env bash
# Build the Chrome extension into dist/ (load-unpacked from that folder).
set -euo pipefail

cd "$(dirname "$0")"

if [[ ! -d node_modules ]]; then
  echo "node_modules missing; running npm install…"
  npm install
fi

npm run build
