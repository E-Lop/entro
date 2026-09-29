#!/usr/bin/env bash
# Pre-push delle migrazioni: prova quelle nuove del ramo sulla forma di
# produzione, in uno stack Supabase separato, prima di ogni `db push` (#188).
#
#   npm run db:prepush -- <issue>            contro la produzione (serve SUPABASE_ACCESS_TOKEN)
#   npm run db:prepush -- <issue> --local    lo sviluppo fa la parte della produzione:
#                                            è l'autoverifica del comando
#
# Il comando non fa mai il push: se tutto è verde stampa i due comandi da lanciare.
# Lo stack di sviluppo si ferma durante la prova (i volumi restano) e riparte alla
# fine, anche su errore o Ctrl-C; poi si controlla che utenti e alimenti siano
# quelli di prima. La procedura completa è in CONTRIBUTING.md, «Migrazioni in
# produzione».
set -Eeuo pipefail

ISSUE="${1:-}"
MODE=linked
[[ "${2:-}" == "--local" ]] && MODE=local
if [[ ! "$ISSUE" =~ ^[0-9]+$ ]]; then
  echo "uso: npm run db:prepush -- <numero della issue> [--local]" >&2
  exit 2
fi

ROOT="$(git rev-parse --show-toplevel)"
PRODSHAPE=entro-prodshape
DEV_PROJECT="$(basename "$ROOT")"
DEV_DB="supabase_db_${DEV_PROJECT}"
SHADOW_DB="supabase_db_${PRODSHAPE}"
SOURCE_FLAG="--${MODE}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/entro-prodshape.XXXXXX")"
chmod 700 "$WORK"
LOG="$WORK/log.txt"
SHADOW="$WORK/shadow"
CURRENT_STEP="0. avvio"
DEV_WAS_RUNNING=0
SHADOW_STARTED=0
CLEANED=0

step() { CURRENT_STEP="$1"; echo; echo "== $1"; }
die() {
  echo "✗ fermo al passo ${CURRENT_STEP}: $1" >&2
  exit 1
}
# I comandi della CLI scrivono nel log, mai a schermo: `supabase start` stampa
# chiavi e JWT, e i messaggi d'errore possono nominare l'utente del database.
logged() { "$@" >>"$LOG" 2>&1; }
# query <out.json> <file.sql> <flag…>: `--agent no` perché dentro un agente la
# CLI cambia la forma del JSON; un solo statement per file.
query() {
  local out="$1" file="$2"
  shift 2
  supabase db query "$@" --agent no --output-format json -f "$file" >"$out" 2>>"$LOG" || {
    # Solo il codice: il messaggio può nominare l'utente del database.
    echo "  ($(grep -o '"code":"[A-Za-z]*"' "$out" | head -1 || true))" >&2
    return 1
  }
}
psql_shadow() { docker exec -i "$SHADOW_DB" psql -U postgres -v ON_ERROR_STOP=1 -q "$@" >>"$LOG" 2>&1; }
dev_counts() {
  docker exec "$DEV_DB" psql -U postgres -Atc \
    "select (select count(*) from auth.users) || ' utenti, ' || (select count(*) from public.foods) || ' alimenti'"
}
dev_volumes() { docker volume ls -q --filter "label=com.supabase.cli.project=${DEV_PROJECT}" | wc -l | tr -d ' '; }

cleanup() {
  local status=$?
  [[ "$CLEANED" == 1 ]] && return
  CLEANED=1
  trap '' INT TERM
  echo
  echo "== 7. pulizia"
  if [[ "$SHADOW_STARTED" == 1 ]]; then
    (cd "$SHADOW" && supabase stop >>"$LOG" 2>&1) || true
    # Solo i volumi dello stack ombra, per etichetta. Mai `--no-backup`: su un
    # progetto sbagliato cancellerebbe i dati di sviluppo.
    local volumes
    volumes="$(docker volume ls -q --filter "label=com.supabase.cli.project=${PRODSHAPE}")"
    [[ -n "$volumes" ]] && echo "$volumes" | xargs docker volume rm >>"$LOG" 2>&1
    echo "stack ombra fermato, volumi tolti: $(echo "$volumes" | grep -c . || true)"
  fi
  if [[ "$DEV_WAS_RUNNING" == 1 ]]; then
    if ! docker ps -q --filter "name=^${DEV_DB}$" | grep -q .; then
      (cd "$ROOT" && supabase start >>"$LOG" 2>&1) || echo "⚠️ lo stack di sviluppo non è ripartito: supabase start" >&2
    fi
    local counts_after volumes_after
    counts_after="$(dev_counts 2>/dev/null || echo 'illeggibile')"
    volumes_after="$(dev_volumes)"
    if [[ "$counts_after" == "$DEV_COUNTS" && "$volumes_after" == "$DEV_VOLUMES" ]]; then
      echo "sviluppo intatto: ${counts_after}, ${volumes_after} volumi"
    else
      echo "⚠️ SVILUPPO DIVERSO DA PRIMA: prima ${DEV_COUNTS}, ${DEV_VOLUMES} volumi; ora ${counts_after}, ${volumes_after} volumi" >&2
      status=1
    fi
  fi
  if [[ "$status" == 0 ]]; then
    rm -rf "$WORK"
  else
    # Il log resta per capire; i backup della modalità locale no.
    rm -f "$WORK"/backup_*.sql
    echo "log della corsa: $LOG"
  fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

cd "$ROOT"

# --- 1. Precondizioni
step "1. precondizioni"
node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>22||(a===22&&b>=18)?0:1)' \
  || die "serve Node ≥ 22.18, che esegue i moduli TypeScript del comando senza build"
if [[ "$MODE" == linked ]]; then
  [[ "${SUPABASE_ACCESS_TOKEN:-}" =~ ^sbp_[a-f0-9]{40}$ ]] || die "SUPABASE_ACCESS_TOKEN mancante o di forma sbagliata"
fi
[[ -z "$(git status --porcelain)" ]] || die "l'albero non è pulito"
git fetch -q origin main
git diff --name-only --diff-filter=A origin/main...HEAD -- 'supabase/migrations/*.sql' | sort >"$WORK/branch.txt"
echo "select version from supabase_migrations.schema_migrations order by version" >"$WORK/applied.sql"
query "$WORK/applied.json" "$WORK/applied.sql" "$SOURCE_FLAG" \
  || die "non riesco a leggere le migrazioni applicate"
node scripts/prepush/commands.ts migrations "$WORK/applied.json" "$WORK/branch.txt" \
  || die "le migrazioni mancanti non sono esattamente quelle del ramo (sopra)"
echo "migrazioni del ramo, e sole mancanti:"
sed 's/^/  /' "$WORK/branch.txt"

if docker ps -q --filter "name=^${DEV_DB}$" | grep -q .; then
  DEV_WAS_RUNNING=1
  DEV_COUNTS="$(dev_counts)"
  DEV_VOLUMES="$(dev_volumes)"
  echo "sviluppo acceso: ${DEV_COUNTS}, ${DEV_VOLUMES} volumi"
elif [[ "$MODE" == local ]]; then
  die "in modalità locale lo stack di sviluppo deve essere acceso: fa la parte della produzione"
fi

# --- 2. Backup
step "2. backup"
if [[ "$MODE" == linked ]]; then
  BACKUP="$ROOT/backup_pre${ISSUE}_$(date +%Y%m%d-%H%M%S)"
else
  BACKUP="$WORK/backup_pre${ISSUE}"
fi
logged supabase db dump "$SOURCE_FLAG" -f "${BACKUP}_schema.sql" || die "dump dello schema non riuscito"
logged supabase db dump "$SOURCE_FLAG" --data-only -f "${BACKUP}_data.sql" || die "dump dei dati non riuscito"
chmod 600 "${BACKUP}_schema.sql" "${BACKUP}_data.sql"
echo "$(basename "${BACKUP}")_{schema,data}.sql, permessi 600 (il contenuto non si stampa)"

# --- 3. Diff (non bloccante finché la #182 non chiude la deriva)
step "3. diff pg-delta (da leggere, non blocca: #182)"
supabase db diff "$SOURCE_FLAG" --use-pg-delta --agent no 2>>"$LOG" || echo "(diff non riuscito: vedi il log)"

# --- 4. Impronta della sorgente
step "4. impronta della sorgente"
query "$WORK/fingerprint-source.json" "$ROOT/scripts/prepush/fingerprint.sql" "$SOURCE_FLAG" || die "impronta non letta"
query "$WORK/shape.json" "$ROOT/scripts/prepush/shape.sql" "$SOURCE_FLAG" || die "forma degli schemi gestiti non letta"
echo "select current_setting('server_version_num')::int / 10000 as major" >"$WORK/version.sql"
query "$WORK/version.json" "$WORK/version.sql" "$SOURCE_FLAG" \
  || die "versione di Postgres non letta"
MAJOR="$(node scripts/prepush/commands.ts column "$WORK/version.json" major)"
node scripts/prepush/commands.ts column "$WORK/shape.json" ddl >"$WORK/shape.sql"
echo "$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).length)' "$WORK/fingerprint-source.json") oggetti, Postgres ${MAJOR}"

# --- 5. Stack ombra con la forma della sorgente
step "5. stack ombra"
mkdir -p "$SHADOW/supabase"
{
  echo "project_id = \"${PRODSHAPE}\""
  echo
  echo "[db]"
  echo "major_version = ${MAJOR}"
  echo
  cat supabase/config.toml
} >"$SHADOW/supabase/config.toml"
cp -R supabase/functions supabase/tests "$SHADOW/supabase/"
if [[ "$DEV_WAS_RUNNING" == 1 ]]; then
  logged supabase stop || die "lo stack di sviluppo non si è fermato"
fi
SHADOW_STARTED=1
START=$SECONDS
(cd "$SHADOW" && supabase start -x studio,imgproxy,mailpit,logflare,vector,supavisor,realtime,postgres-meta >>"$LOG" 2>&1) \
  || die "lo stack ombra non è partito"
echo "partito in $((SECONDS - START)) s"
psql_shadow -1 -f - <"${BACKUP}_schema.sql" || die "il dump di schema non si carica"
psql_shadow -1 -f - <"$WORK/shape.sql" || die "la forma degli schemi gestiti non si carica"
if [[ -n "${PREPUSH_TAMPER_SQL:-}" ]]; then
  # L'autoverifica del comando: altera lo stack ombra dopo il caricamento, per
  # provare che il confronto delle impronte se ne accorge. Solo in locale.
  [[ "$MODE" == local ]] || die "PREPUSH_TAMPER_SQL vale solo con --local"
  psql_shadow -f - <"$PREPUSH_TAMPER_SQL" || die "PREPUSH_TAMPER_SQL non si applica"
  echo "(autoverifica: applicato ${PREPUSH_TAMPER_SQL})"
fi
query "$WORK/fingerprint-shadow.json" "$ROOT/scripts/prepush/fingerprint.sql" --local --workdir "$SHADOW" \
  || die "impronta dello stack ombra non letta"
if ! node scripts/prepush/commands.ts compare "$WORK/fingerprint-source.json" "$WORK/fingerprint-shadow.json"; then
  die "forma di produzione non fedele (oggetti sopra)"
fi
echo "impronta identica a quella della sorgente"

# --- 6. Prova
step "6. prova delle migrazioni del ramo"
while read -r migration; do
  psql_shadow -1 -f - <"$migration" || die "la migrazione ${migration} non si applica"
  echo "applicata: $(basename "$migration")"
done <"$WORK/branch.txt"
if ! (cd "$SHADOW" && supabase test db --local >"$WORK/pgtap.txt" 2>&1); then
  cat "$WORK/pgtap.txt" >>"$LOG"
  grep -E '^(not ok|# +Failed|Failed)|\.sql \.\.' "$WORK/pgtap.txt" | grep -v ' ok$' || true
  die "pgTAP rosso"
fi
echo "pgTAP: $(grep -E '^Result:' "$WORK/pgtap.txt" || echo verde)"
npm run -s smoke:local || die "suite di smoke rossa"

# --- 8. Esito (la pulizia, il passo 7, la fa il trap all'uscita)
CURRENT_STEP="8. esito"
echo
echo "== 8. esito: verde"
if [[ "$MODE" == linked ]]; then
  echo "Leggi il piano, poi fai il push tu:"
  echo "  supabase db push --linked --dry-run"
  echo "  supabase db push --linked"
else
  echo "modalità locale: nessun push da fare"
fi
