#!/usr/bin/env bash
# Install Docker (if needed) and start the shared SaaS stack on an Ubuntu droplet.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

if [[ ! -f deploy/digitalocean/.env ]]; then
  echo "Missing deploy/digitalocean/.env — copy deploy/digitalocean/.env.example and set DOMAIN, PUBLIC_APP_URL, and secrets."
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi

docker compose -f deploy/digitalocean/docker-compose.yml --env-file deploy/digitalocean/.env up -d --build
docker compose -f deploy/digitalocean/docker-compose.yml --env-file deploy/digitalocean/.env ps
