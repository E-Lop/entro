# Security Policy

## English summary

Please report security issues privately. Do not open public issues for vulnerabilities, secrets, data exposure, authentication bypasses or RLS problems.

## Segnalare una vulnerabilita'

Per segnalazioni di sicurezza, scrivi privatamente a:

**support@entroapp.it**

Includi, se possibile:

- descrizione del problema;
- passi per riprodurlo;
- impatto stimato;
- URL, screenshot o log rilevanti;
- eventuale mitigazione suggerita.

Non pubblicare dettagli sensibili in issue GitHub, pull request o discussioni pubbliche.

## Ambito

Sono considerate segnalazioni di sicurezza:

- accesso non autorizzato a dati alimenti, liste, inviti o account;
- bypass di autenticazione o autorizzazione;
- policy RLS mancanti o errate;
- segreti esposti;
- problemi nelle Edge Functions Supabase;
- vulnerabilita' XSS, CSRF o supply chain;
- perdita o cancellazione non autorizzata di dati.

## Note per contributor

Le modifiche database devono sempre includere RLS e GRANT espliciti dove richiesto. Le funzioni con privilegi elevati devono essere minime, testate e documentate.
