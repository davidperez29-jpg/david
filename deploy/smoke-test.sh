#!/bin/sh
# Deployment smoke test (CI, docs/DEPLOY_RENDER.md): the all-in-one image against an empty
# PostgreSQL whose owner is NOT a superuser (like a managed database), started twice.
# Usage: deploy/smoke-test.sh <image>
set -eu
IMAGE=$1
NET=tp-smoke-$$
KEY=$(openssl rand -base64 32)
cleanup() { docker rm -f tp-smoke-db tp-smoke-app >/dev/null 2>&1 || true; docker network rm "$NET" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker network create "$NET" >/dev/null
docker run -d --name tp-smoke-db --network "$NET" -e POSTGRES_USER=root -e POSTGRES_PASSWORD=pw \
  -e POSTGRES_DB=plataforma postgres:16 >/dev/null
for i in $(seq 1 60); do docker exec tp-smoke-db pg_isready -U root -d plataforma >/dev/null 2>&1 && break; sleep 2; done
sleep 3
docker exec tp-smoke-db psql -U root -d plataforma -c \
  "CREATE ROLE owner LOGIN PASSWORD 'ownerpw' CREATEROLE; ALTER DATABASE plataforma OWNER TO owner; ALTER SCHEMA public OWNER TO owner;" >/dev/null

start() {
  docker run -d --name tp-smoke-app --network "$NET" -p 3190:3000 \
    -e DATABASE_URL=postgres://owner:ownerpw@tp-smoke-db:5432/plataforma -e APP_ENCRYPTION_KEY="$KEY" \
    -e ADMIN_EMAIL=admin@example.com -e ADMIN_PASSWORD=clave-de-prueba-larga -e DAILY_JOBS=in-app \
    "$IMAGE" >/dev/null
  for i in $(seq 1 150); do curl -sf localhost:3190/api/ready >/dev/null && return 0; sleep 3; done
  docker logs tp-smoke-app; echo "App not ready"; exit 1
}
login() {
  curl -s -o /dev/null -w '%{http_code}' -X POST localhost:3190/api/v1/auth/login \
    -H 'content-type: application/json' -H 'Origin: http://localhost:3190' \
    -d '{"email":"admin@example.com","password":"clave-de-prueba-larga"}'
}
start
[ "$(login)" = 200 ] || { docker logs tp-smoke-app; echo "Login failed"; exit 1; }
docker rm -f tp-smoke-app >/dev/null
start
[ "$(login)" = 200 ] || { echo "Login failed after restart"; exit 1; }
ORGS=$(docker exec tp-smoke-db psql -U root -d plataforma -tAc 'select count(*) from organizations')
[ "$ORGS" = 1 ] || { echo "Expected 1 organization after two starts, got $ORGS"; exit 1; }
echo "Deployment smoke test passed: ready, admin login, idempotent restart."
