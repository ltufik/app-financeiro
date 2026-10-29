#!/bin/sh
# Runs the schema twice (must be re-runnable) and the access tests on a throwaway local Postgres.
# Usage: sh tests/db/run.sh   (needs Postgres server binaries; PG_BIN defaults to /usr/lib/postgresql/16/bin)
set -e
B=${PG_BIN:-/usr/lib/postgresql/16/bin}; D=${PG_DIR:-/var/tmp/pgtest}; PORT=54329
cd "$(dirname "$0")/../.."
if ! psql -h $D -p $PORT -U postgres -c 'select 1' >/dev/null 2>&1; then
  [ -d $D/data ] || { mkdir -p $D; chown postgres $D 2>/dev/null || true; su postgres -c "$B/initdb -D $D/data -A trust -U postgres >/dev/null"; }
  rm -f $D/data/postmaster.pid
  su postgres -c "$B/pg_ctl -D $D/data -o '-p $PORT -k $D' -l $D/log start" >/dev/null; sleep 2
fi
P="psql -h $D -p $PORT -U postgres -q -v ON_ERROR_STOP=1"
$P -c "drop database if exists t" 2>/dev/null; $P -c "create database t"
$P -d t -f tests/db/supabase_shim.sql
$P -d t -f supabase/schema.sql 2>/tmp/schema_err.txt; grep -v NOTICE /tmp/schema_err.txt || true
$P -d t -f supabase/schema.sql 2>/tmp/schema_err.txt; grep -v NOTICE /tmp/schema_err.txt || true
echo "schema ok (rodado 2x)"
$P -d t -f tests/db/test_rls.sql 2>&1 | grep -v "^ *$\|learn_rule\|delete_my_account\|------\|(1 row)\|^ *$"
