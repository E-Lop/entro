# Etichette di triage

Le skill parlano di cinque **ruoli** canonici. Questa tabella li mappa sulle stringhe usate davvero nel tracker di questo repo.

| Ruolo nelle skill | Etichetta qui | Significato |
| --- | --- | --- |
| `needs-triage` | `needs-triage` | Da valutare |
| `needs-info` | `needs-info` | In attesa di informazioni da chi ha aperto |
| `ready-for-agent` | `ready-for-agent` | Specificata a sufficienza per un agente che lavora da solo |
| `ready-for-human` | `ready-for-human` | Richiede implementazione umana |
| `wontfix` | `wontfix` | Non verrà fatta |

È una tabella identità: i nomi canonici sono stati tenuti. Le quattro etichette che mancavano sono state **create sul repo il 24 ago 2026** (`wontfix` c'era già dai default di GitHub) — la skill di setup scrive la mappatura ma non crea niente, e `gh issue edit --add-label <mancante>` fallisce invece di creare l'etichetta.

Queste cinque dicono **in che stato** è una issue. Sono ortogonali alle etichette che dicono **cosa** è (`bug`, `enhancement`, `documentation`) e a quelle di fase: una issue le porta insieme.
