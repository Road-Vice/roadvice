#!/usr/bin/env bash
# ROAD VICE - lance le jeu sur Windows/Mac/Linux (alt. simple sans Electron)
cd "$(dirname "$0")"
PORT="${1:-8000}"
echo "ROAD VICE -> http://127.0.0.1:$PORT"
python3 -m http.server "$PORT"
