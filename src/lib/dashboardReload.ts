/**
 * Ciò che «Riprova» rilancia sulla dashboard (#210).
 *
 * Gli alimenti sempre; le categorie solo quando non ci sono. Sono due
 * letture, e le categorie hanno una freschezza di un'ora: rilette a ogni
 * «Riprova» sarebbero una richiesta in più per niente, non rilette mai
 * restavano in errore finché la schermata non veniva rimontata.
 *
 * «Non ci sono» e non «sono in errore»: chi tocca «Riprova» mentre il secondo
 * tentativo delle categorie è ancora in volo le troverebbe non ancora
 * fallite, e quando poi cadono nessuno le rilancia più. Visto nel browser,
 * con l'E2E di questa issue.
 *
 * E in quel caso `refetch()` non fa partire una lettura nuova: senza dati
 * React Query si accoda a quella in volo (`query.ts`, `fetch`: annulla e
 * rilegge solo se `data` c'è già). Se quella cade, si rilancia una volta.
 *
 * Il rilancio delle categorie non si aspetta: se cade di nuovo lo dirà la sua
 * query, e quello degli alimenti non deve restare appeso a lei.
 */
interface Reloadable<T> {
  refetch: () => Promise<T>
}

export function reloadDashboard<T>(
  foods: Reloadable<T>,
  categories: Reloadable<{ isError: boolean }> & { isError: boolean; isFetching: boolean; data: unknown },
): Promise<T> {
  if (categories.isError || categories.data === undefined) {
    const joinedReadInFlight = categories.isFetching
    void categories.refetch().then((result) => {
      if (joinedReadInFlight && result.isError) void categories.refetch()
    })
  }
  return foods.refetch()
}
