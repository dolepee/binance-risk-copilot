#!/usr/bin/env bash
set -euo pipefail

VPS_HOST="${VPS_HOST:-16.16.120.1}"
VPS_USER="${VPS_USER:-ubuntu}"
KEY_PATH="${KEY_PATH:-$HOME/.ssh/key.pem}"
REMOTE_DIR="${REMOTE_DIR:-/home/ubuntu/apps/binance-risk-copilot}"
BASE_PATH="${BASE_PATH:-/binance-risk-copilot}"
SERVICE_NAME="${SERVICE_NAME:-binance-risk-copilot}"

rsync -az --delete \
  -e "ssh -i $KEY_PATH" \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.next' \
  ./ "${VPS_USER}@${VPS_HOST}:${REMOTE_DIR}/"

ssh -i "$KEY_PATH" "${VPS_USER}@${VPS_HOST}" "bash -s" <<EOF
set -euo pipefail

mkdir -p "${REMOTE_DIR}"
cd "${REMOTE_DIR}"

NEXT_PUBLIC_BASE_PATH="${BASE_PATH}" npm ci
NEXT_PUBLIC_BASE_PATH="${BASE_PATH}" npm run build

sudo cp ops/binance-risk-copilot.service /etc/systemd/system/${SERVICE_NAME}.service

sudo systemctl daemon-reload
sudo systemctl enable "${SERVICE_NAME}" >/dev/null
sudo systemctl restart "${SERVICE_NAME}"
sudo systemctl is-active "${SERVICE_NAME}" >/dev/null

for attempt in \$(seq 1 20); do
  if curl -fsS "http://127.0.0.1:3002${BASE_PATH}" >/dev/null; then
    break
  fi
  sleep 1
done

curl -fsS "http://127.0.0.1:3002${BASE_PATH}" >/dev/null

echo "deploy_ok internal_service_ready http://127.0.0.1:3002${BASE_PATH}"
EOF
