#!/usr/bin/env bash
# Restore drill (restructure phase 10, docs/OPERATIONS.md §6): copy → restore into a new database →
# compare it with the source → start the app against it and check that it answers.
#
#   DATABASE_URL=postgres://…/app_dev scripts/restore-drill.sh [--app] [--keep]
#
# --app   also starts the production build (`pnpm build` first) on port 3170 against the
#         restored database: /api/ready, login of a demo user and the client list.
# --keep  keeps the restored database (dropped by default).
#
# Read-only on the source. Needs pg_dump, pg_restore and psql of the server's major version, and a
# user allowed to create databases. Prints the timings to record in the drill log.
set -euo pipefail

APP=0
KEEP=0
for a in "$@"; do
  case "$a" in
    --app) APP=1 ;;
    --keep) KEEP=1 ;;
    *) echo "Opción desconocida: $a" >&2; exit 2 ;;
  esac
done

SRC="${DATABASE_URL:?Falta DATABASE_URL (la base de origen)}"
NAME="restore_drill_$(date +%Y%m%d_%H%M%S)"
# Same server, another database: replace the database name at the end of the URL.
DST="${SRC%/*}/${NAME}"
ADMIN="${SRC%/*}/postgres"
WORK="$(mktemp -d)"
DUMP="$WORK/backup.dump"
PORT=3170
ok() { printf '  ✔ %s\n' "$*"; }
fail() { printf '  ✘ %s\n' "$*" >&2; exit 1; }
now() { date +%s.%N; }
secs() { awk -v a="$1" -v b="$2" 'BEGIN { printf "%.1f", b - a }'; }

cleanup() {
  # The app runs in its own process group (setsid): stop pnpm and next together.
  if [ -n "${APP_PID:-}" ]; then
    kill -- -"$APP_PID" 2>/dev/null || true
    wait "$APP_PID" 2>/dev/null || true
  fi
  rm -rf "$WORK"
  if [ "$KEEP" = 0 ]; then
    psql "$ADMIN" -qc "drop database if exists $NAME with (force)" >/dev/null 2>&1 ||
      echo "  ! No se pudo borrar la base $NAME: bórrala a mano" >&2
  fi
}
trap cleanup EXIT

echo "Simulacro de restauración — $(date -u +%FT%TZ)"

# The source may be live: the copy and the counts it is compared with use one exported snapshot.
coproc SNAPSHOT { psql "$SRC" -Atq; }
until_end() { while IFS= read -r line <&"${SNAPSHOT[0]}"; do [ "$line" = __END__ ] && break; echo "$line"; done; }
printf "begin isolation level repeatable read read only;\nselect pg_export_snapshot();\nselect '__END__';\n" >&"${SNAPSHOT[1]}"
SNAP=$(until_end)
t0=$(now)
pg_dump --format=custom --no-password --snapshot="$SNAP" --file="$DUMP" "$SRC"
t1=$(now)
ok "Copia (pg_dump -Fc): $(du -h "$DUMP" | cut -f1) en $(secs "$t0" "$t1") s"

psql "$ADMIN" -qc "create database $NAME" >/dev/null
pg_restore --no-password --exit-on-error --dbname="$DST" "$DUMP"
t2=$(now)
ok "Restaurada en la base nueva «$NAME» en $(secs "$t1" "$t2") s"

# Row counts of every table, RLS flags, policies and applied migrations must match the source.
STATE_SQL="
select 'rows ' || c.relname || ' ' ||
       (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from %I.%I', n.nspname, c.relname), false, true, '')))[1]::text
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r'
union all
select 'rls ' || c.relname || ' ' || c.relrowsecurity || ' ' || c.relforcerowsecurity
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r'
union all
select 'policies ' || count(*) from pg_policies where schemaname = 'public'
union all
select 'migrations ' || count(*) from drizzle.__drizzle_migrations
order by 1"
printf '%s;\nselect %s;\ncommit;\n' "$STATE_SQL" "'__END__'" >&"${SNAPSHOT[1]}"
until_end >"$WORK/src.txt"
eval "exec ${SNAPSHOT[1]}>&-"
psql "$DST" -Atc "$STATE_SQL" >"$WORK/dst.txt"
if ! diff -u "$WORK/src.txt" "$WORK/dst.txt"; then fail "La base restaurada no coincide con el origen"; fi
TABLES=$(grep -c '^rows ' "$WORK/dst.txt")
ROWS=$(awk '/^rows /{ s += $3 } END { print s }' "$WORK/dst.txt")
ok "Igual que el origen: $TABLES tablas, $ROWS filas, $(grep '^policies' "$WORK/dst.txt" | cut -d' ' -f2) políticas RLS, $(grep '^migrations' "$WORK/dst.txt" | cut -d' ' -f2) migraciones"

if [ "$APP" = 1 ]; then
  ROOT="$(cd "$(dirname "$0")/.." && pwd)"
  (cd "$ROOT/apps/web" && DATABASE_URL="$DST" APP_BASE_URL="http://localhost:$PORT" \
    exec setsid pnpm start -p "$PORT" >"$WORK/app.log" 2>&1) &
  APP_PID=$!
  for _ in $(seq 1 60); do
    curl -fs "http://localhost:$PORT/api/ready" >/dev/null 2>&1 && break
    sleep 1
  done
  READY=$(curl -s "http://localhost:$PORT/api/ready" || true)
  echo "$READY" | grep -q '"status":"ready"' || { cat "$WORK/app.log" >&2; fail "/api/ready: $READY"; }
  ok "La app arranca contra la base restaurada: /api/ready → ready"
  JAR="$WORK/cookies"
  ORIGIN="http://localhost:$PORT"
  CODE=$(curl -s -o /dev/null -w '%{http_code}' -c "$JAR" -H "Origin: $ORIGIN" -H 'Content-Type: application/json' \
    -d "{\"email\":\"${DRILL_EMAIL:-lucia.moreno@example.com}\",\"password\":\"${DEMO_PASSWORD:-demo-entrenamiento-2026}\"}" \
    "$ORIGIN/api/v1/auth/login")
  [ "$CODE" = 200 ] || fail "Login de prueba: HTTP $CODE (¿datos demo cargados en el origen?)"
  N=$(curl -s -b "$JAR" "$ORIGIN/api/v1/clients" | grep -o '"id"' | wc -l)
  [ "$N" -gt 0 ] || fail "La lista de clientes está vacía"
  ok "Login y lista de clientes con datos restaurados ($N ids en la respuesta)"
fi

t3=$(now)
echo "Total: $(secs "$t0" "$t3") s. $([ "$KEEP" = 1 ] && echo "Base conservada: $NAME" || echo 'Base restaurada eliminada.')"
echo "Recuerda: en una restauración real, reaplica después las supresiones RGPD (OPERATIONS.md §6)."
