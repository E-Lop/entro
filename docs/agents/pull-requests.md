# Corpo delle PR

> Scritto a mano. Dalla 1.3 di `mattpocock-skills` la skill `pr` parte da sola ogni volta che l'agente scrive il corpo di una PR, e impone tre sezioni con i titoli in inglese. In questo repo il corpo lo dà già `.github/PULL_REQUEST_TEMPLATE.md`, e vince il template: deciso il 20 ott 2026 in E-Lop/entro-mobile#232.

## La forma

Le sezioni del template, nel loro ordine:

1. **Cosa cambia**
2. **Verifiche**: le caselle di lint, typecheck, test e build, spuntate.
3. **Database e sicurezza**: le caselle, spuntate. Con una migrazione, prima del `db push` dal ramo della PR si lancia `npm run db:prepush` (`CONTRIBUTING.md`, *Migrazioni in produzione*).
4. **UI/mobile**: le caselle, spuntate.
5. **Rischio del merge**: l'unica sezione presa dalla skill, perché il template non l'aveva.

Dopo il template, solo quando serve, si aggiunge **Fuori da qui**: ciò che il brief esclude, e le issue aperte strada facendo, con il numero. Il template non ce l'ha.

## Cosa si prende dalla skill

- **«Rischio del merge»**, con i titoli tradotti: *Door* è **Porta**, *one-way / two-way* sono **a senso unico / a doppio senso**, *Blast Radius* è **Raggio**. Qui pesa più che altrove: una migrazione in produzione è una porta a senso unico, perché un revert del codice non riporta indietro lo schema né i dati riscritti.
- **In «Cosa cambia»**, lo schema più piccolo che mostra la modifica: pseudocodice, albero delle chiamate o dei file, Mermaid, un `diff` dello schema.
- **Niente preamboli**, prosa breve.

Non si aggiungono le sezioni «Summary», «Evidence» e «Merge Danger»: duplicherebbero «Cosa cambia», «Verifiche» e «Rischio del merge», e i titoli resterebbero in inglese in un corpo italiano.

## Il vocabolario

La skill dice di prenderlo da `GLOSSARY.md`, che qui non esiste: il glossario è `../entro-family/core/` (`docs/agents/domain.md`).
