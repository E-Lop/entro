/**
 * Avvia il giro orario di smoke contro la produzione (`smoke-hourly.yml`) al
 * minuto 17 di ogni ora, in UTC (#286). Netlify esegue le funzioni pianificate
 * solo sul deploy pubblicato, e non sono raggiungibili da un URL.
 */
import { dispatchWorkflow } from '../lib/dispatchWorkflow'

export default async (): Promise<void> => {
  await dispatchWorkflow('smoke-hourly.yml')
}

export const config = {
  schedule: '17 * * * *',
}
