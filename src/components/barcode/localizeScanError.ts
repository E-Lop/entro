// Vive in un file suo, non dentro `BarcodeScanner.tsx`: un modulo che esporta
// insieme un componente e una funzione non ricaricabile a caldo fa perdere a
// Fast Refresh lo stato del componente a ogni salvataggio
// (`react-refresh/only-export-components`).
/**
 * Map raw camera/ZXing error strings (often English, e.g. "Not supported") to
 * plain Italian guidance. Falls back to the original message when already localized.
 */
export function localizeScanError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('not supported') || m.includes('notsupported')) {
    return 'Scanner non supportato su questo browser. Aggiornalo o usa un altro dispositivo.'
  }
  if (m.includes('not allowed') || m.includes('permission') || m.includes('denied')) {
    return 'Permesso fotocamera negato. Abilitalo nelle impostazioni del browser e riprova.'
  }
  if (m.includes('not found') || m.includes('notfound')) {
    return 'Nessuna fotocamera trovata sul dispositivo.'
  }
  if (m.includes('not readable') || m.includes('in use') || m.includes('notreadable')) {
    return 'Fotocamera occupata da un\'altra app. Chiudila e riprova.'
  }
  if (m.includes('secure') || m.includes('https')) {
    return 'Lo scanner richiede una connessione sicura (HTTPS).'
  }
  return message
}
