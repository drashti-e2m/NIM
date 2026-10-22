#!/bin/zsh
set -euo pipefail

export PATH="/opt/homebrew/bin:$PATH"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is still not available. Open a new Terminal window, then run:"
  echo "  brew install node"
  exit 1
fi

cd "$(dirname "$0")"
npm install
npm run dev -- --host 127.0.0.1 --port 5173
