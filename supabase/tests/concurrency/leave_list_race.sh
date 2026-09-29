#!/usr/bin/env bash
# Due membri di una lista di due chiamano leave_list() insieme (#184).
#
# Senza il lock sulla lista tutti e due vedono l'altro, escono tutti e due, e
# la lista resta senza membri: provato togliendo il lock, tre giri su tre.
# Come in create_personal_list_race.sh le sessioni sono due psql che si
# sovrappongono per costruzione: la prima tiene aperta la transazione dopo la
# chiamata, la seconda chiama mentre la prima non ha ancora committato.
#
# A ogni giro si controlla: una uscita riuscita, l'altra rifiutata con
# only_member, un membro rimasto, nessuna lista senza membri.
#
#   bash supabase/tests/concurrency/leave_list_race.sh [giri]
#
# Scrive solo sul Supabase locale: l'indirizzo è fisso e non si cambia da
# fuori. Crea due utenti suoi, e li toglie alla fine anche su errore.
set -Eeuo pipefail

DB_URL='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
ROUNDS="${1:-10}"
FIRST='00000000-0000-0000-0000-000000184e01'
SECOND='00000000-0000-0000-0000-000000184e02'
WORK="$(mktemp -d "${TMPDIR:-/tmp}/leave-list-race.XXXXXX")"

sql() { psql "$DB_URL" -X -q -At -v ON_ERROR_STOP=1 "$@"; }

remove_users() {
  sql -c "delete from public.lists where created_by in ('${FIRST}', '${SECOND}');
          delete from auth.users where id in ('${FIRST}', '${SECOND}');" >/dev/null || true
}
trap 'remove_users; rm -rf "$WORK"' EXIT

# La chiamata come la fa PostgREST: ruolo authenticated e claims della sessione.
call() {
  local user_id="$1" hold="$2"
  sql <<SQL
begin;
select set_config('request.jwt.claims', '{"sub":"${user_id}","role":"authenticated"}', true) \g /dev/null
set local role authenticated;
select coalesce(error_message, 'ok') from public.leave_list();
select pg_sleep(${hold}) \g /dev/null
commit;
SQL
}

remove_users
sql -c "insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
        ('${FIRST}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'leave-race-1@example.test', now(), now()),
        ('${SECOND}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'leave-race-2@example.test', now(), now());" >/dev/null

failures=0
for round in $(seq 1 "$ROUNDS"); do
  # I due utenti in una lista di due, creata dal primo.
  sql -c "delete from public.lists where created_by in ('${FIRST}', '${SECOND}');" >/dev/null
  shared="$(sql -c "insert into public.lists (name, created_by) values ('Lista condivisa', '${FIRST}') returning id;" | head -1)"
  sql -c "insert into public.list_members (list_id, user_id) values ('${shared}', '${FIRST}'), ('${shared}', '${SECOND}');" >/dev/null

  call "$FIRST" 0.5 >"$WORK/first" 2>"$WORK/first.err" &
  first_pid=$!
  sleep 0.2
  call "$SECOND" 0 >"$WORK/second" 2>"$WORK/second.err" &
  second_pid=$!
  wait "$first_pid" "$second_pid" || true

  first="$(cat "$WORK/first")"
  second="$(cat "$WORK/second")"
  members="$(sql -c "select count(*) from public.list_members where list_id = '${shared}';")"
  orphans="$(sql -c "select count(*) from public.lists l
                     where l.created_by in ('${FIRST}', '${SECOND}')
                       and not exists (select 1 from public.list_members m where m.list_id = l.id);")"

  if [[ "$first" == ok && "$second" == only_member && "$members" == 1 && "$orphans" == 0 ]]; then
    echo "giro ${round}: ok"
  else
    failures=$((failures + 1))
    echo "giro ${round}: KO — prima «${first}», seconda «${second}», membri ${members}, liste senza membri ${orphans}"
    cat "$WORK/first.err" "$WORK/second.err"
  fi
done

if (( failures > 0 )); then
  echo "${failures} giri su ${ROUNDS} falliti"
  exit 1
fi
echo "${ROUNDS} giri su ${ROUNDS}: un'uscita sola, e nessuna lista senza membri"
