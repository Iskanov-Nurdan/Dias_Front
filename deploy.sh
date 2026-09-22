#!/usr/bin/env bash
# Сборка фронта и заливка на сервер одной командой (запускать локально, в Git Bash):
#   ./deploy.sh                      (Git Bash)
#   bash deploy.sh                   (PowerShell, если Git Bash в PATH)
#   SERVER=root@1.2.3.4 ./deploy.sh   — другой сервер
set -euo pipefail

cd "$(dirname "$0")"

SERVER="${SERVER:-root@5.42.98.29}"
REMOTE_DIR="${REMOTE_DIR:-/root/DIas_ERP/frontend-dist}"

log() { echo -e "\033[1;34m[deploy]\033[0m $*"; }

log "npm ci"
npm ci

log "npm run build"
npm run build

log "заливка на $SERVER:$REMOTE_DIR"
# Сначала в соседнюю папку, потом подмена — пользователи не увидят полузалитый билд.
ssh "$SERVER" "rm -rf '$REMOTE_DIR.new' && mkdir -p '$REMOTE_DIR.new'"
scp -r build/* "$SERVER:$REMOTE_DIR.new/"
ssh "$SERVER" "mkdir -p '$REMOTE_DIR' && rm -rf '$REMOTE_DIR'/* && mv '$REMOTE_DIR.new'/* '$REMOTE_DIR'/ && rmdir '$REMOTE_DIR.new'"

log "готово: https://diass.tw1.ru"
