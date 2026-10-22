#!/usr/bin/env bash
# Il ramo con conferma di join_list_via_invite() in gara con gli altri modi di
# uscire da una lista (#239).
#
# Con la conferma (p_force) la funzione toglie la propria riga da
# list_members, conta chi resta e cancella la lista se è vuota: è il lavoro di
# leave_list() e remove_list_member(), che però prendono prima il lock sulla
# lista. Senza, due uscite insieme si contano a vicenda ancora dentro, e la
# lista resta senza membri. Tre casi, con le sessioni sovrapposte come in
# remove_list_member_race.sh (la prima tiene aperta la transazione dopo la
# chiamata, la seconda chiama prima che la prima abbia committato), nei due
# ordini:
#
#   1. gli ultimi due membri di una lista accettano insieme, con conferma, un
#      invito ciascuno verso un'altra lista;
#   2. uno dei due esce con leave_list() mentre l'altro accetta con conferma;
#   3. due join incrociati: X da L1 a L2 mentre Y da L2 a L1. Con il lock sulla
#      sola lista di partenza andrebbero in deadlock, e il blocco «exception
#      when others» della funzione lo renderebbe un 'unexpected'.
#
# A ogni giro: le due chiamate rispondono 'ok', ognuno ha una riga sola in
# list_members ed è nella lista giusta, e nessuna lista resta senza membri.
#
#   bash supabase/tests/concurrency/join_list_via_invite_race.sh [giri]
#
# Scrive solo sul Supabase locale: l'indirizzo è fisso e non si cambia da
# fuori. Crea quattro utenti suoi, e li toglie alla fine anche su errore.
set -Eeuo pipefail

DB_URL='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
ROUNDS="${1:-6}"
U1='00000000-0000-0000-0000-000000239e01'
U2='00000000-0000-0000-0000-000000239e02'
U3='00000000-0000-0000-0000-000000239e03'
U4='00000000-0000-0000-0000-000000239e04'
USERS="'${U1}', '${U2}', '${U3}', '${U4}'"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/join-list-race.XXXXXX")"

sql() { psql "$DB_URL" -X -q -At -v ON_ERROR_STOP=1 "$@"; }

remove_users() {
  sql -c "delete from public.lists where created_by in (${USERS});
          delete from auth.users where id in (${USERS});" >/dev/null || true
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

# Due chiamate sovrapposte: la prima tiene aperta la transazione, la seconda
# parte prima che la prima abbia committato.
race() {
  local first_user="$1" first_statement="$2" second_user="$3" second_statement="$4"
  call "$first_user" "$first_statement" 0.5 >"$WORK/first" 2>"$WORK/first.err" &
  local first_pid=$!
  sleep 0.2
  call "$second_user" "$second_statement" 0 >"$WORK/second" 2>"$WORK/second.err" &
  local second_pid=$!
  wait "$first_pid" "$second_pid" || true
  FIRST="$(cat "$WORK/first")"
  SECOND="$(cat "$WORK/second")"
}

# Due chiamate che si intrecciano: un cancello tiene in FOR UPDATE le righe di
# list_members di tutti e due, quindi ognuno prende quello che prende prima
# del delete della propria riga e lì si ferma. Quando il cancello si apre, le
# due proseguono insieme. Senza il cancello la prima finirebbe tutto prima che
# la seconda cominci, e un deadlock non potrebbe mai succedere.
race_gated() {
  local first_user="$1" first_statement="$2" second_user="$3" second_statement="$4"
  sql >/dev/null <<SQL &
begin;
select 1 from public.list_members where user_id in ('${first_user}', '${second_user}') for update \g /dev/null
select pg_sleep(0.6) \g /dev/null
commit;
SQL
  local gate_pid=$!
  sleep 0.2
  call "$first_user" "$first_statement" 0 >"$WORK/first" 2>"$WORK/first.err" &
  local first_pid=$!
  call "$second_user" "$second_statement" 0 >"$WORK/second" 2>"$WORK/second.err" &
  local second_pid=$!
  wait "$gate_pid" "$first_pid" "$second_pid" || true
  FIRST="$(cat "$WORK/first")"
  SECOND="$(cat "$WORK/second")"
}

# Una lista nuova, creata da $1, con i membri che seguono.
new_list() {
  local creator="$1"; shift
  local list
  list="$(sql -c "insert into public.lists (name, created_by) values ('Gara 239', '${creator}') returning id;" | head -1)"
  for member in "$@"; do
    sql -c "insert into public.list_members (list_id, user_id) values ('${list}', '${member}');" >/dev/null
  done
  echo "$list"
}

# Un invito pendente verso la lista $1, con il codice $2.
new_invite() {
  sql -c "insert into public.invites (list_id, created_by, token, short_code, expires_at)
          select '$1', l.created_by, gen_random_uuid()::text, '$2', now() + interval '1 day'
          from public.lists l where l.id = '$1';" >/dev/null
}

reset() {
  sql -c "delete from public.lists where created_by in (${USERS});" >/dev/null
}

lists_of() { sql -c "select coalesce(string_agg(list_id::text, ',' order by list_id), '') from public.list_members where user_id = '$1';"; }

orphans() {
  sql -c "select count(*) from public.lists l
          where l.created_by in (${USERS})
            and not exists (select 1 from public.list_members m where m.list_id = l.id);"
}

remove_users
sql -c "insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at) values
        ('${U1}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'join-race-1@example.test', now(), now()),
        ('${U2}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'join-race-2@example.test', now(), now()),
        ('${U3}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'join-race-3@example.test', now(), now()),
        ('${U4}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'join-race-4@example.test', now(), now());" >/dev/null

failures=0
report() {
  local name="$1" ok="$2" detail="$3"
  if [[ "$ok" == yes ]]; then
    echo "${name}: ok"
  else
    failures=$((failures + 1))
    echo "${name}: KO — ${detail}"
    cat "$WORK/first.err" "$WORK/second.err"
  fi
}

for round in $(seq 1 "$ROUNDS"); do
  # 1. U1 e U2, ultimi membri di S, accettano con conferma un invito ciascuno:
  #    U1 verso la lista di U3, U2 verso quella di U4.
  reset
  shared="$(new_list "$U1" "$U1" "$U2")"
  dest1="$(new_list "$U3" "$U3")"; new_invite "$dest1" "G239A${round}"
  dest2="$(new_list "$U4" "$U4")"; new_invite "$dest2" "G239B${round}"
  if (( round % 2 == 1 )); then
    race "$U1" "public.join_list_via_invite('G239A${round}', true)" "$U2" "public.join_list_via_invite('G239B${round}', true)"
  else
    race "$U2" "public.join_list_via_invite('G239B${round}', true)" "$U1" "public.join_list_via_invite('G239A${round}', true)"
  fi
  in1="$(lists_of "$U1")"; in2="$(lists_of "$U2")"; o="$(orphans)"
  [[ "$FIRST" == ok && "$SECOND" == ok && "$in1" == "$dest1" && "$in2" == "$dest2" && "$o" == 0 ]] && ok=yes || ok=no
  report "giro ${round}, due accettazioni con conferma" "$ok" \
    "prima «${FIRST}», seconda «${SECOND}», liste senza membri ${o}"

  # 2. U1 esce con leave_list() mentre U2 accetta con conferma. In fila, chi
  #    arriva secondo trova il lavoro dell'altro fatto: se esce prima U1, U2 è
  #    l'ultimo membro e la sua accettazione cancella la lista; se accetta
  #    prima U2, U1 resta l'unico membro e leave_list() lo rifiuta con
  #    'only_member', come fa sempre con l'unico membro.
  reset
  shared="$(new_list "$U1" "$U1" "$U2")"
  dest="$(new_list "$U3" "$U3")"; new_invite "$dest" "G239C${round}"
  if (( round % 2 == 1 )); then
    race "$U1" "public.leave_list()" "$U2" "public.join_list_via_invite('G239C${round}', true)"
    expected_second=ok
  else
    race "$U2" "public.join_list_via_invite('G239C${round}', true)" "$U1" "public.leave_list()"
    expected_second=only_member
  fi
  in2="$(lists_of "$U2")"; o="$(orphans)"
  [[ "$FIRST" == ok && "$SECOND" == "$expected_second" && "$in2" == "$dest" && "$o" == 0 ]] && ok=yes || ok=no
  report "giro ${round}, uscita e accettazione con conferma" "$ok" \
    "prima «${FIRST}», seconda «${SECOND}», liste senza membri ${o}"

  # 3. Join incrociati: U1 da L1 a L2 mentre U2 da L2 a L1. In ognuna resta un
  #    membro (U3 in L1, U4 in L2), quindi nessuna lista si cancella. Le due
  #    chiamate si intrecciano con il cancello: è lì che un lock preso in
  #    ordine diverso dalle due andrebbe in deadlock.
  reset
  l1="$(new_list "$U3" "$U3" "$U1")"; new_invite "$l1" "G239D${round}"
  l2="$(new_list "$U4" "$U4" "$U2")"; new_invite "$l2" "G239E${round}"
  if (( round % 2 == 1 )); then
    race_gated "$U1" "public.join_list_via_invite('G239E${round}', true)" "$U2" "public.join_list_via_invite('G239D${round}', true)"
  else
    race_gated "$U2" "public.join_list_via_invite('G239D${round}', true)" "$U1" "public.join_list_via_invite('G239E${round}', true)"
  fi
  in1="$(lists_of "$U1")"; in2="$(lists_of "$U2")"; o="$(orphans)"
  [[ "$FIRST" == ok && "$SECOND" == ok && "$in1" == "$l2" && "$in2" == "$l1" && "$o" == 0 ]] && ok=yes || ok=no
  report "giro ${round}, join incrociati" "$ok" \
    "prima «${FIRST}», seconda «${SECOND}», U1 in ${in1}, U2 in ${in2}, liste senza membri ${o}"
done

if (( failures > 0 )); then
  echo "${failures} casi su $((ROUNDS * 3)) falliti"
  exit 1
fi
echo "$((ROUNDS * 3)) casi su $((ROUNDS * 3)): nessuna lista senza membri, nessun 'unexpected'"
