#!/usr/bin/env bash
# Il creatore toglie un membro mentre quel membro esce da sé (#196).
#
# remove_list_member() e leave_list() tolgono la stessa riga e creano tutte e
# due la lista personale della stessa persona. Prendono lo stesso lock sulla
# lista, quindi si mettono in fila: chi arriva dopo trova il lavoro fatto. Come
# in leave_list_race.sh le sessioni sono due psql che si sovrappongono per
# costruzione: la prima tiene aperta la transazione dopo la chiamata, la
# seconda chiama mentre la prima non ha ancora committato. Si prova nei due
# ordini.
#
# A ogni giro si controlla: tutte e due le chiamate rispondono senza errori
# imprevisti, la persona ha una riga sola in list_members e non nella lista
# condivisa, ha una lista personale sola, e nessuna lista resta senza membri.
#
#   bash supabase/tests/concurrency/remove_list_member_race.sh [giri]
#
# Scrive solo sul Supabase locale: l'indirizzo è fisso e non si cambia da
# fuori. Crea due utenti suoi, e li toglie alla fine anche su errore.
set -Eeuo pipefail

DB_URL='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
ROUNDS="${1:-10}"
CREATOR='00000000-0000-0000-0000-000000196e01'
MEMBER='00000000-0000-0000-0000-000000196e02'
WORK="$(mktemp -d "${TMPDIR:-/tmp}/remove-list-member-race.XXXXXX")"

sql() { psql "$DB_URL" -X -q -At -v ON_ERROR_STOP=1 "$@"; }

remove_users() {
  sql -c "delete from public.lists where created_by in ('${CREATOR}', '${MEMBER}');
          delete from auth.users where id in ('${CREATOR}', '${MEMBER}');" >/dev/null || true
}
trap 'remove_users; rm -rf "$WORK"' EXIT

# La chiamata come la fa PostgREST: ruolo authenticated e claims della sessione.
call() {
  local user_id="$1" statement="$2" hold="$3"
  sql <<SQL
begin;
select set_config('request.jwt.claims', '{"sub":"${user_id}","role":"authenticated"}', true) \g /dev/null
set local role authenticated;
select coalesce(error_message, 'ok') from ${statement};
select pg_sleep(${hold}) \g /dev/null
commit;
SQL
}

remove_users
sql -c "insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
        ('${CREATOR}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'remove-race-1@example.test', now(), now()),
        ('${MEMBER}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'remove-race-2@example.test', now(), now());" >/dev/null

REMOVE="public.remove_list_member('${MEMBER}')"
LEAVE='public.leave_list()'

failures=0
for round in $(seq 1 "$ROUNDS"); do
  # I due utenti in una lista di due, creata dal primo.
  sql -c "delete from public.lists where created_by in ('${CREATOR}', '${MEMBER}');" >/dev/null
  shared="$(sql -c "insert into public.lists (name, created_by) values ('Lista condivisa', '${CREATOR}') returning id;" | head -1)"
  sql -c "insert into public.list_members (list_id, user_id) values ('${shared}', '${CREATOR}'), ('${shared}', '${MEMBER}');" >/dev/null

  # Giri dispari: parte prima la rimozione. Giri pari: prima l'uscita.
  if (( round % 2 == 1 )); then
    order='rimozione, poi uscita'
    call "$CREATOR" "$REMOVE" 0.5 >"$WORK/first" 2>"$WORK/first.err" &
    first_pid=$!
    sleep 0.2
    call "$MEMBER" "$LEAVE" 0 >"$WORK/second" 2>"$WORK/second.err" &
    expected_first=ok expected_second=ok
  else
    order='uscita, poi rimozione'
    call "$MEMBER" "$LEAVE" 0.5 >"$WORK/first" 2>"$WORK/first.err" &
    first_pid=$!
    sleep 0.2
    call "$CREATOR" "$REMOVE" 0 >"$WORK/second" 2>"$WORK/second.err" &
    expected_first=ok expected_second=not_a_member
  fi
  second_pid=$!
  wait "$first_pid" "$second_pid" || true

  first="$(cat "$WORK/first")"
  second="$(cat "$WORK/second")"
  rows="$(sql -c "select count(*) from public.list_members where user_id = '${MEMBER}';")"
  in_shared="$(sql -c "select count(*) from public.list_members where user_id = '${MEMBER}' and list_id = '${shared}';")"
  personal="$(sql -c "select count(*) from public.lists where created_by = '${MEMBER}';")"
  orphans="$(sql -c "select count(*) from public.lists l
                     where l.created_by in ('${CREATOR}', '${MEMBER}')
                       and not exists (select 1 from public.list_members m where m.list_id = l.id);")"

  if [[ "$first" == "$expected_first" && "$second" == "$expected_second" \
        && "$rows" == 1 && "$in_shared" == 0 && "$personal" == 1 && "$orphans" == 0 ]]; then
    echo "giro ${round} (${order}): ok"
  else
    failures=$((failures + 1))
    echo "giro ${round} (${order}): KO — prima «${first}», seconda «${second}», righe ${rows}, nella condivisa ${in_shared}, liste personali ${personal}, liste senza membri ${orphans}"
    cat "$WORK/first.err" "$WORK/second.err"
  fi
done

if (( failures > 0 )); then
  echo "${failures} giri su ${ROUNDS} falliti"
  exit 1
fi
echo "${ROUNDS} giri su ${ROUNDS}: una lista sola per chi viene tolto, e nessuna lista senza membri"
