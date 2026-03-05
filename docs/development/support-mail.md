# Email di supporto

## Configurazione

- **Email**: `support@entroapp.it`
- **Tipo**: alias/redirect configurato su Aruba verso l'email personale dello sviluppatore
- **Pannello**: gestione dominio entroapp.it su Aruba

## Implementazione nell'app

- **File**: `src/pages/SettingsPage.tsx`
- **Posizione**: sezione "Supporto" tra Notifiche e Privacy & Dati
- **Meccanismo**: `<a href="mailto:support@entroapp.it">` — funziona nativamente su Android, iOS e desktop
- **Data deploy**: 2026-03-05
- **Verificato su**: Android, iOS

## Note

- La stessa email e' usata come `VAPID_SUBJECT` (`mailto:support@entroapp.it`) per le push notifications
- Non servono librerie aggiuntive: il tag `mailto:` e' supportato da tutti i browser e client nativi
