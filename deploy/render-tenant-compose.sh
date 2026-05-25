#!/usr/bin/env bash
# Render a per-tenant docker-compose file from the template.
# Usage: ./deploy/render-tenant-compose.sh acme acme.yourapp.com
set -euo pipefail

SLUG="${1:?tenant slug required (e.g. acme)}"
GATEWAY_HOST="${2:-${SLUG}.localhost}"
DB_PREFIX="${SLUG}_"
OUT="${3:-deploy/generated/docker-compose.${SLUG}.yml}"

mkdir -p "$(dirname "$OUT")"
sed \
  -e "s/__TENANT_SLUG__/${SLUG}/g" \
  -e "s/__TENANT_DB_PREFIX__/${DB_PREFIX}/g" \
  -e "s/__TENANT_GATEWAY_HOST__/${GATEWAY_HOST}/g" \
  deploy/docker-compose.tenant.yml.template > "$OUT"

echo "Wrote ${OUT}"
echo "Start with: docker compose -f ${OUT} up -d"
