#!/bin/sh
# Restore test of the weekly copy (.github/workflows/copia.yml), also runnable here:
#   sh scripts/copia-restaura.sh <copy.dump> <empty test db url>
# Builds the test database the same way as tests/db (Supabase shim + supabase/schema.sql), loads the copy's data
# (public schema; foreign keys to auth.users are not checked: the shim has no real users) and checks that every table
# got exactly the rows the copy has, and that families and entries are there. Prints only table names and counts,
# never data. Exit 1 if anything is off.
set -e
DUMP=$1; DST=$2
cd "$(dirname "$0")/.."
P="psql -X -q -v ON_ERROR_STOP=1"
W=${TMPDIR:-/tmp}/copia.$$; mkdir -p "$W"; trap 'rm -rf "$W"' EXIT
$P "$DST" -f tests/db/supabase_shim.sql >/dev/null
$P "$DST" -f supabase/schema.sql >/dev/null 2>"$W/schema.txt" || { grep -v NOTICE "$W/schema.txt"; exit 1; }
# Tables the schema fills on its own (seeds) start empty, so the counts compare the copy only.
TABLES=$($P -At "$DST" -c "select tablename from pg_tables where schemaname = 'public' order by 1")
for t in $TABLES; do $P "$DST" -c "truncate public.\"$t\" cascade" >/dev/null; done
pg_restore --data-only --schema=public --no-owner --no-privileges -f "$W/data.sql" "$DUMP"
# Rows per table inside the copy (COPY blocks).
awk '/^COPY public\./ { split($2, a, "."); t = a[2]; gsub(/"/, "", t); n[t] = 0; on = 1; next } on && /^\\\.$/ { on = 0; next } on { n[t]++ } END { for (t in n) print t, n[t] }' "$W/data.sql" > "$W/counts.txt"
{ echo "set session_replication_role = replica;"; grep -v '^SET transaction_timeout' "$W/data.sql"; } | $P "$DST" >/dev/null
fail=0; printf '%-22s %10s %10s\n' tabela na_copia restaurado
while read -r t n; do
  b=$($P -At "$DST" -c "select count(*) from public.\"$t\"" 2>/dev/null || echo 'sem tabela')
  mark=''; [ "$n" = "$b" ] || { mark=' <- diferente'; fail=1; }
  printf '%-22s %10s %10s%s\n' "$t" "$n" "$b" "$mark"
done < "$W/counts.txt"
for t in households transactions; do
  c=$($P -At "$DST" -c "select count(*) from public.$t"); [ "$c" -gt 0 ] || { echo "$t vazia na cópia"; fail=1; }
done
[ $fail = 0 ] && echo "restauração ok: cada tabela voltou com as mesmas linhas da cópia" || { echo "restauração com problema"; exit 1; }
