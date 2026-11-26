/**
 * Avvia il giro giornaliero di smoke contro la produzione (`smoke-daily.yml`)
 * alle 05:43 UTC, cioè 06:43 o 07:43 a Roma (#286): lontano dalla mezzanotte di
 * Roma, così ripristino e controllo cadono nello stesso giorno delle etichette.
 * Netlify esegue le funzioni pianificate solo sul deploy pubblicato, e non sono
 * raggiungibili da un URL.
 */
import { dispatchWorkflow } from '../lib/dispatchWorkflow'

export default async (): Promise<void> => {
  await dispatchWorkflow('smoke-daily.yml')
}

export const config = {
  schedule: '43 5 * * *',
}
