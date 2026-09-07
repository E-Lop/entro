/**
 * La categoria pre-compila il luogo, e solo quello.
 *
 * Decisione 3 del 4 settembre 2026, presa sulla spec nativa e valida per
 * entrambi i client (entro#118, entro-mobile#99). I casi che
 * contano non sono «funziona», ma i tre in cui la pre-compilazione **non deve
 * avvenire**: campo toccato, modifica invece di creazione, categoria assente.
 * Ognuno dei tre, se sbagliato, sovrascrive una scelta dell'utente senza che
 * niente lo segnali — il difetto peggiore di questa funzione non è non
 * riempire, è riempire quando non doveva.
 */
import { describe, it, expect } from 'vitest';
import { storageLocationForCategory } from '../foodDefaults';

const latticini = { default_storage: 'fridge' as const };
const surgelati = { default_storage: 'freezer' as const };

describe('storageLocationForCategory — pre-compila', () => {
  it('propone il luogo della categoria su un form nuovo e mai toccato', () => {
    expect(
      storageLocationForCategory(latticini, { current: null, touched: false, isCreate: true })
    ).toBe('fridge');
  });

  it('segue un secondo cambio di categoria, se il campo resta non toccato', () => {
    expect(
      storageLocationForCategory(surgelati, { current: 'fridge', touched: false, isCreate: true })
    ).toBe('freezer');
  });
});

describe('storageLocationForCategory — non sovrascrive', () => {
  it('non tocca il luogo se l\'utente lo ha già scelto a mano', () => {
    expect(
      storageLocationForCategory(surgelati, { current: 'pantry', touched: true, isCreate: true })
    ).toBe('pantry');
  });

  it('non tocca il luogo nemmeno se coincide con quello che avrebbe proposto', () => {
    // Il caso subdolo: scegliere a mano proprio il predefinito è comunque una
    // decisione, e un cambio di categoria successivo non deve scavalcarla.
    expect(
      storageLocationForCategory(surgelati, { current: 'fridge', touched: true, isCreate: true })
    ).toBe('fridge');
  });

  it('non pre-compila in modifica, dove il luogo è un dato già scelto', () => {
    expect(
      storageLocationForCategory(surgelati, { current: 'pantry', touched: false, isCreate: false })
    ).toBe('pantry');
  });

  it('non pre-compila in modifica nemmeno con il campo vuoto', () => {
    expect(
      storageLocationForCategory(surgelati, { current: null, touched: false, isCreate: false })
    ).toBeNull();
  });
});

describe('storageLocationForCategory — categoria assente', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
  ])('lascia il luogo com\'è quando la categoria è %s', (_nome, categoria) => {
    expect(
      storageLocationForCategory(categoria, { current: 'pantry', touched: false, isCreate: true })
    ).toBe('pantry');
  });

  it('restituisce null se non c\'è né categoria né luogo corrente', () => {
    expect(
      storageLocationForCategory(null, { current: null, touched: false, isCreate: true })
    ).toBeNull();
  });
});
