#!/usr/bin/env bash
# Un giro contro la produzione parte solo se l'Environment `production` ha
# tutti i secret che usa (#190). Senza, si ferma verde e lo dice: il job ha
# `ready=false` fra gli output, e i passi successivi non partono.
#
# Finché il maintainer non crea i secret (#189, #190), quindi, i workflow non diventano rossi a
# ogni ora per una ragione che si conosce già, e si accendono da soli quando
# i secret arrivano. Si stampano solo i nomi dei secret mancanti, mai i valori.
#
# Uso: bash scripts/smoke/require-secrets.sh NOME [NOME...]
# con ogni NOME nell'ambiente del passo, presi da `secrets.*`.
set -euo pipefail

if [ "$#" -eq 0 ]; then
  echo "::error::require-secrets.sh: nessun nome di secret da controllare" >&2
  exit 2
fi

missing=()
for name in "$@"; do
  if [ -z "${!name:-}" ]; then
    missing+=("$name")
  fi
done

if [ "${#missing[@]}" -eq 0 ]; then
  echo "ready=true" >> "$GITHUB_OUTPUT"
  exit 0
fi

message="Giro saltato: all'Environment production mancano ${missing[*]}. Li crea il maintainer (#189, #190)."
echo "::notice title=Smoke in produzione non configurato::$message"
echo "$message" >> "$GITHUB_STEP_SUMMARY"
echo "ready=false" >> "$GITHUB_OUTPUT"
