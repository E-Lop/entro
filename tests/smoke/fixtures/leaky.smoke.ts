/**
 * Una corsa volutamente rossa, che prova a far uscire dei segreti in ogni modo
 * che vitest conosce (#187). La lancia `tests/smokeOutput.test.ts`, con lo
 * stesso reporter della suite: niente di questo deve arrivare all'output.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { SmokeFailure } from '../failure'
import { LEAKY_EMAIL, LEAKY_JWT, LEAKY_SIGNED_URL } from './leakyValues'

it('un errore con il messaggio del server', () => {
  throw new Error(`${LEAKY_EMAIL} ${LEAKY_SIGNED_URL}`)
})

it('un expect fallito, con il suo diff', () => {
  expect({ email: LEAKY_EMAIL, url: LEAKY_SIGNED_URL }).toEqual({ email: 'altro' })
})

it('la console dei test', () => {
  console.log(LEAKY_JWT)
  console.error(LEAKY_EMAIL)
  throw new SmokeFailure('categoria scritta nel codice')
})

it('una promise rifiutata e non gestita', () => {
  void Promise.reject(new Error(LEAKY_SIGNED_URL))
})

describe('un hook che fallisce', () => {
  beforeAll(() => {
    throw new Error(LEAKY_JWT)
  })

  it('non arriva a girare', () => {})
})
