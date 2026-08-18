// @vitest-environment jsdom
/**
 * Dove va il fuoco quando una riga esce dalla lista (#87).
 *
 * La rimozione è ottimistica: la card sparisce prima che il dialogo finisca di
 * chiudersi, e il dialogo prova a restituire il fuoco a un elemento che non
 * esiste più. Il fuoco finisce su `document.body` e il primo Tab riparte
 * dall'inizio del documento — dopo *ogni* eliminazione, anche a rete perfetta.
 *
 * La regola è quella fissata nel bundle di famiglia (`fuoco-dopo-una-rimozione`):
 * riga successiva, intestazione della lista come ripiego, e sul rollback il
 * fuoco torna sulla riga ricomparsa.
 */
import { afterEach, describe, expect, it } from 'vitest'
import {
  FOOD_ACTIONS_ATTR,
  LIST_HEADING_ATTR,
  actionsIndexOf,
  moveFocusAfterRemoval,
  restoreFocusTo,
  restoreFocusToOpener,
} from '@/lib/focusAfterRemoval'

/** Una lista di card con il loro pulsante azioni, più l'intestazione. */
function renderList(ids: string[]): void {
  document.body.innerHTML = `
    <h2 ${LIST_HEADING_ATTR} tabindex="-1">I tuoi alimenti</h2>
    ${ids.map((id) => `<button ${FOOD_ACTIONS_ATTR}="${id}">Azioni per ${id}</button>`).join('')}
  `
}

/** Toglie una card, come fa l'aggiornamento ottimistico della cache. */
function removeCard(id: string): void {
  document.querySelector(`[${FOOD_ACTIONS_ATTR}="${id}"]`)?.remove()
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('moveFocusAfterRemoval', () => {
  it('porta il fuoco sulla riga che ha preso il posto di quella rimossa', () => {
    renderList(['a', 'b', 'c'])
    const index = actionsIndexOf('b')

    removeCard('b')
    const destination = moveFocusAfterRemoval(index)

    expect(destination).toBe('next')
    expect(document.activeElement?.getAttribute(FOOD_ACTIONS_ATTR)).toBe('c')
  })

  it('ripiega sull’intestazione quando la riga rimossa era l’ultima', () => {
    renderList(['a', 'b'])
    const index = actionsIndexOf('b')

    removeCard('b')
    const destination = moveFocusAfterRemoval(index)

    expect(destination).toBe('heading')
    expect(document.activeElement?.hasAttribute(LIST_HEADING_ATTR)).toBe(true)
  })

  it('ripiega sull’intestazione anche quando la lista resta vuota', () => {
    renderList(['a'])
    const index = actionsIndexOf('a')

    removeCard('a')
    const destination = moveFocusAfterRemoval(index)

    expect(destination).toBe('heading')
    expect(document.activeElement?.hasAttribute(LIST_HEADING_ATTR)).toBe(true)
  })

  it('non lascia il fuoco sul body quando la riga non si trova', () => {
    // Vista che non espone i pulsanti azioni: meglio l'intestazione del vuoto.
    renderList([])
    const destination = moveFocusAfterRemoval(actionsIndexOf('fantasma'))

    expect(destination).toBe('heading')
    expect(document.activeElement?.hasAttribute(LIST_HEADING_ATTR)).toBe(true)
  })

  it('dice di non aver trovato dove andare invece di fingere', () => {
    document.body.innerHTML = ''

    expect(moveFocusAfterRemoval(0)).toBe('none')
  })
})

describe('restoreFocusTo', () => {
  it('riporta il fuoco sulla riga ricomparsa dopo un rollback', () => {
    // La scrittura fallisce, `onError` ripristina la lista e la card torna.
    renderList(['a', 'b', 'c'])

    expect(restoreFocusTo('b')).toBe(true)
    expect(document.activeElement?.getAttribute(FOOD_ACTIONS_ATTR)).toBe('b')
  })

  it('non solleva se la riga non è ricomparsa', () => {
    renderList(['a'])

    expect(restoreFocusTo('b')).toBe(false)
  })
})

describe('restoreFocusToOpener', () => {
  it('riporta il fuoco al pulsante che ha aperto il dialogo', () => {
    renderList(['a', 'b'])
    const opener = document.querySelector<HTMLElement>(`[${FOOD_ACTIONS_ATTR}="a"]`)

    expect(restoreFocusToOpener(opener, 'a')).toBe(true)
    expect(document.activeElement).toBe(opener)
  })

  it('ripiega sulla riga se quel nodo non è più nel documento', () => {
    // Succede quando un re-render sostituisce l'elemento: il riferimento resta
    // valido come oggetto, ma non è più quello che l'utente vede.
    renderList(['a', 'b'])
    const staccato = document.createElement('button')

    expect(restoreFocusToOpener(staccato, 'b')).toBe(true)
    expect(document.activeElement?.getAttribute(FOOD_ACTIONS_ATTR)).toBe('b')
  })

  it('non finge quando non c’è né l’uno né l’altra', () => {
    renderList([])

    expect(restoreFocusToOpener(null, 'fantasma')).toBe(false)
  })
})
