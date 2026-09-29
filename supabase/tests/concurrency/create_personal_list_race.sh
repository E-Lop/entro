#!/usr/bin/env bash
# Due create_personal_list concorrenti per un utente senza lista (#195).
#
# È la gara che fra febbraio e marzo 2026 ha dato due liste a due utenti in
# produzione. pgTAP non la può provare, perché un test gira in una
# transazione sola: qui le sessioni sono due psql separati, e si sovrappongono
# per costruzione. La prima chiama la RPC dentro una transazione che resta
# aperta per un attimo dopo l'insert; la seconda chiama mentre la prima non ha
# ancora committato. Il caso peggiore capita così a ogni giro, non per caso.
#
# A ogni giro si controlla: tutte e due le risposte con success, lo stesso
# list_id, una riga sola in list_members, nessuna lista senza membri.
#
#   bash supabase/tests/concurrency/create_personal_list_race.sh [giri]
#
# Scrive solo sul Supabase locale: l'indirizzo è fisso e non si cambia da
# fuori. Crea un utente suo, e lo toglie alla fine anche su errore.
set -Eeuo pipefail

DB_URL='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
ROUNDS="${1:-20}"
USER_ID='00000000-0000-0000-0000-000000195e01'
CLAIMS="{\"sub\":\"${USER_ID}\",\"role\":\"authenticated\"}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/create-personal-list-race.XXXXXX")"

sql() { psql "$DB_URL" -X -q -At -v ON_ERROR_STOP=1 "$@"; }

remove_user() {
  sql -c "delete from public.lists where created_by = '${USER_ID}';
          delete from auth.users where id = '${USER_ID}';" >/dev/null || true
}
trap 'remove_user; rm -rf "$WORK"' EXIT

# La chiamata come la fa PostgREST: ruolo authenticated e claims della sessione.
call() {
  local hold="$1"
  sql <<SQL
begin;
select set_config('request.jwt.claims', '${CLAIMS}', true) \g /dev/null
set local role authenticated;
select list_id || '|' || success || '|' || coalesce(error_message, '') from public.create_personal_list();
select pg_sleep(${hold}) \g /dev/null
commit;
SQL
}

remove_user
sql -c "insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
        values ('${USER_ID}', '00000000-0000-0000-0000-000000000000', 'authenticated',
                'authenticated', 'race195@example.test', now(), now());" >/dev/null

failures=0
for round in $(seq 1 "$ROUNDS"); do
  # Senza lista, come quando il trigger di registrazione non l'ha creata.
  sql -c "delete from public.lists where created_by = '${USER_ID}';" >/dev/null

  call 0.5 >"$WORK/first" 2>"$WORK/first.err" &
  first_pid=$!
  sleep 0.2
  call 0 >"$WORK/second" 2>"$WORK/second.err" &
  second_pid=$!
  wait "$first_pid" "$second_pid" || true

  first="$(cat "$WORK/first")"
  second="$(cat "$WORK/second")"
  members="$(sql -c "select count(*) from public.list_members where user_id = '${USER_ID}';")"
  lists="$(sql -c "select count(*) from public.lists where created_by = '${USER_ID}';")"

  if [[ "$first" == *'|true|' && "$first" == "$second" && "$members" == 1 && "$lists" == 1 ]]; then
    echo "giro ${round}: ok"
  else
    failures=$((failures + 1))
    echo "giro ${round}: KO — prima «${first}», seconda «${second}», righe ${members}, liste ${lists}"
    cat "$WORK/first.err" "$WORK/second.err"
  fi
done

if (( failures > 0 )); then
  echo "${failures} giri su ${ROUNDS} falliti"
  exit 1
fi
echo "${ROUNDS} giri su ${ROUNDS}: una lista sola, la stessa per le due chiamate"
