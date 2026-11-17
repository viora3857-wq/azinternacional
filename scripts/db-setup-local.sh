#!/usr/bin/env bash
# Recria um banco Postgres LOCAL com o shim do Supabase + migrações + seed.
# Uso: DATABASE_URL=postgres://postgres:postgres@localhost:5432/az_dev npm run db:setup
# Recusa rodar contra hosts que não sejam locais, para não apagar um banco real por engano.
set -euo pipefail

: "${DATABASE_URL:?defina DATABASE_URL}"
host=$(node -e 'console.log(new URL(process.argv[1]).hostname)' "$DATABASE_URL")
case "$host" in
  localhost|127.0.0.1|::1|postgres) ;;
  *) echo "Recusado: host '$host' não é local. Para o Supabase use 'supabase db push'." >&2; exit 1 ;;
esac

db=$(node -e 'console.log(new URL(process.argv[1]).pathname.slice(1))' "$DATABASE_URL")
admin_url=$(node -e 'const u=new URL(process.argv[1]);u.pathname="/postgres";console.log(u.toString())' "$DATABASE_URL")

psql "$admin_url" -v ON_ERROR_STOP=1 -q -c "drop database if exists \"$db\" with (force);" -c "create database \"$db\";"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f supabase/test/supabase-shim.sql
for f in supabase/migrations/*.sql; do
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done
if [ "${SKIP_SEED:-0}" != "1" ]; then
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f supabase/seed.sql
fi
echo "Banco '$db' pronto."
