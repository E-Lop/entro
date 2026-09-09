// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act, cleanup, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { FoodForm } from '../FoodForm'

// Capture the onScanSuccess callback passed to BarcodeScanner
let capturedOnScanSuccess: ((barcode: string) => void) | null = null

// Mock dependencies using vi.hoisted so mocks are available in factory functions
const { mockFetchProduct, mockMapProduct } = vi.hoisted(() => ({
  mockFetchProduct: vi.fn(),
  mockMapProduct: vi.fn(),
}))

vi.mock('@/lib/openfoodfacts', () => ({
  fetchProductByBarcode: mockFetchProduct,
  mapProductToFormData: mockMapProduct,
}))

vi.mock('@/hooks/useFoods', () => ({
  useCategories: () => ({
    data: [
      // `default_storage` arriva dai tipi generati come `string`: il mock lo
      // riproduce così com'è, o il test proverebbe una forma che il database
      // non consegna.
      { id: 'cat-1', name_it: 'Latticini', default_storage: 'fridge' },
      { id: 'cat-2', name_it: 'Surgelati', default_storage: 'freezer' },
    ],
    isLoading: false,
  }),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
      // `unsubscribe` sta sul **canale**, non solo sull'oggetto restituito da
      // `subscribe`: è quello che `FoodForm` chiama allo smontaggio (`:250`).
      // Mancava perché nessun test rendeva `mode="edit"`, l'unica modalità che
      // apre il canale dei conflitti — e il difetto compariva come
      // «channel.unsubscribe is not a function» dentro un effetto di cleanup,
      // cioè lontano dalla riga di test che lo provoca.
      unsubscribe: vi.fn(),
    })),
    getChannels: vi.fn(() => []),
    removeChannel: vi.fn(),
  },
}))

vi.mock('@/lib/realtime', () => ({
  mutationTracker: {
    wasRecentlyMutated: vi.fn().mockReturnValue(false),
  },
}))

// Mock BarcodeScanner to capture onScanSuccess callback
// The FoodForm uses lazy(() => import('../barcode/BarcodeScanner'))
// vi.mock resolves relative to the test file
vi.mock('../../barcode/BarcodeScanner', () => ({
  BarcodeScanner: (props: { onScanSuccess: (barcode: string) => void }) => {
    capturedOnScanSuccess = props.onScanSuccess
    return <div data-testid="mock-barcode-scanner">Scanner Mock</div>
  },
}))

describe('FoodForm accordion sections', () => {
  const mockOnSubmit = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    capturedOnScanSuccess = null
  })

  afterEach(() => {
    cleanup()
  })

  it('should have main section open by default', () => {
    render(<FoodForm mode="create" onSubmit={mockOnSubmit} />)

    const mainSection = document.getElementById('section-main')
    const detailsSection = document.getElementById('section-details')

    expect(mainSection).not.toBeNull()
    expect(detailsSection).not.toBeNull()
    // Main section should be visible (not hidden)
    expect(mainSection).not.toHaveClass('hidden')
    // Details section should be hidden
    expect(detailsSection).toHaveClass('hidden')
  })

  it('should apply background class to closed section header', () => {
    render(<FoodForm mode="create" onSubmit={mockOnSubmit} />)

    // Main is open by default, details is closed
    const mainButton = document.querySelector('button[aria-controls="section-main"]')!
    const detailsButton = document.querySelector('button[aria-controls="section-details"]')!

    // Closed section (details) gets a neutral highlight, not the brand green
    expect(detailsButton.className).toMatch(/bg-muted/)
    expect(detailsButton.className).not.toMatch(/bg-primary/)
    // Open section (main) should NOT have the closed background class
    expect(mainButton.className).not.toMatch(/bg-muted/)
  })

  it('should swap background class when toggling sections', async () => {
    const user = userEvent.setup()
    render(<FoodForm mode="create" onSubmit={mockOnSubmit} />)

    const mainButton = document.querySelector('button[aria-controls="section-main"]')!
    const detailsButton = document.querySelector('button[aria-controls="section-details"]')!

    // Initially: main open (no bg), details closed (neutral bg)
    expect(mainButton.className).not.toMatch(/bg-muted/)
    expect(detailsButton.className).toMatch(/bg-muted/)

    // Click details to open it (closes main)
    await user.click(detailsButton)

    // Now: main closed (neutral bg), details open (no bg)
    expect(mainButton.className).toMatch(/bg-muted/)
    expect(detailsButton.className).not.toMatch(/bg-muted/)
  })

  it('barcode button accessible name contains its visible label (WCAG 2.5.3)', () => {
    render(<FoodForm mode="create" onSubmit={mockOnSubmit} />)

    // The button must be findable by its visible text, with no overriding
    // aria-label that hides "Scansiona Barcode" from voice-control users.
    const scanButton = screen.getByRole('button', { name: /Scansiona Barcode/i })
    expect(scanButton).toBeInTheDocument()
    expect(scanButton).not.toHaveAttribute('aria-label')
  })

  it('renders form controls with a >=44px touch target height', () => {
    render(<FoodForm mode="create" onSubmit={mockOnSubmit} />)

    // Name input and the submit button should carry the 44px height class.
    const nameInput = screen.getByPlaceholderText('es. Latte intero')
    expect(nameInput.className).toMatch(/h-11/)

    const submit = screen.getByRole('button', { name: /Aggiungi alimento/i })
    expect(submit.className).toMatch(/h-11/)
  })

  it('should keep main section open after barcode scan populates notes', async () => {
    const user = userEvent.setup()

    // Setup mocks: barcode scan returns product with notes
    mockFetchProduct.mockResolvedValue({
      data: { product_name: 'Latte Intero', categories_tags: ['dairies'] },
      error: null,
    })
    mockMapProduct.mockReturnValue({
      name: 'Latte Intero',
      category_id: 'cat-1',
      storage_location: 'fridge',
      quantity: 1,
      quantity_unit: 'l',
      notes: 'Ingredienti: latte intero pastorizzato',
    })

    render(<FoodForm mode="create" onSubmit={mockOnSubmit} />)

    // Open the barcode scanner by clicking the scan button
    const scanButtons = screen.getAllByRole('button', { name: /Scansiona Barcode/i })
    await user.click(scanButtons[0])

    // Wait for lazy-loaded BarcodeScanner mock to render via Suspense
    await waitFor(() => {
      expect(capturedOnScanSuccess).not.toBeNull()
    })

    // Simulate a barcode scan
    await act(async () => {
      capturedOnScanSuccess!('1234567890123')
    })

    // After scan completes, main section should STILL be open (not switched to details)
    await waitFor(() => {
      const mainSection = document.getElementById('section-main')
      const detailsSection = document.getElementById('section-details')

      expect(mainSection).not.toHaveClass('hidden')
      expect(detailsSection).toHaveClass('hidden')
    })
  })

  it('keeps the collapsed section out of the tab order and a11y tree (inert + hidden)', () => {
    render(<FoodForm mode="create" onSubmit={mockOnSubmit} />)

    const mainSection = document.getElementById('section-main')!
    const detailsSection = document.getElementById('section-details')!

    // Open section: reachable, announced.
    expect(mainSection).not.toHaveAttribute('inert')
    expect(mainSection).not.toHaveClass('hidden')
    // Collapsed section: inert (no focus) + hidden (no layout / not announced).
    expect(detailsSection).toHaveAttribute('inert')
    expect(detailsSection).toHaveClass('hidden')
  })

  it('reveals a section when opened: drops inert/hidden and flips aria-expanded', async () => {
    const user = userEvent.setup()
    render(<FoodForm mode="create" onSubmit={mockOnSubmit} />)

    const detailsButton = document.querySelector('button[aria-controls="section-details"]')!
    expect(detailsButton).toHaveAttribute('aria-expanded', 'false')

    await user.click(detailsButton)

    const detailsSection = document.getElementById('section-details')!
    expect(detailsButton).toHaveAttribute('aria-expanded', 'true')
    expect(detailsSection).not.toHaveAttribute('inert')
    expect(detailsSection).not.toHaveClass('hidden')
  })
})

/**
 * Cosa arriva davvero a `onSubmit`: la data e il luogo.
 *
 * Sono le due gemelle native di entro#117 ed entro#118, e vanno provate qui e
 * non sullo schema, perché la trasformazione vive nel submit handler del form
 * — lo schema non la vede passare.
 */
describe('FoodForm — la data e il luogo che arrivano a onSubmit', () => {
  const mockOnSubmit = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  async function fill(
    user: ReturnType<typeof userEvent.setup>,
    { data = '2026-09-04', category }: { data?: string; category?: string } = {}
  ) {
    await user.type(screen.getByLabelText(/Nome \*/), 'Latte intero')
    if (category) await user.selectOptions(screen.getByLabelText(/Categoria \*/), category)
    // `user.type` non deposita niente in un `input[type=date]` sotto jsdom:
    // il campo resta vuoto, la validazione ferma il submit, e il test
    // fallisce con «onSubmit mai chiamato» invece che sulla data — cioè
    // sembra un difetto del form. Si scrive il valore direttamente.
    fireEvent.change(screen.getByLabelText(/Data di scadenza \*/), { target: { value: data } })
  }

  /**
   * Invia il form dall'elemento, non cliccando «Aggiungi alimento».
   *
   * Il click sul pulsante di submit **non fa partire il submit** in questo
   * ambiente: misurato con una sonda: zero chiamate a `onSubmit` dopo il
   * click, una dopo `fireEvent.submit` sullo stesso form già compilato e
   * senza un solo messaggio di validazione a schermo. Chi ci ricasca legge
   * «onSubmit mai chiamato» e va a cercare un difetto di validazione che non
   * c'è. Quello che si prova qui è cosa esce dal submit handler, e per quello
   * l'evento sul form è la via diretta.
   */
  async function sendForm(container: HTMLElement) {
    await act(async () => {
      fireEvent.submit(container.querySelector('form')!)
    })
  }

  it('invia expiry_date come yyyy-MM-dd, senza passare per Date', async () => {
    const user = userEvent.setup()
    const { container } = render(<FoodForm mode="create" onSubmit={mockOnSubmit} />)

    await fill(user, { category: 'cat-1' })
    await sendForm(container)

    await waitFor(() => expect(mockOnSubmit).toHaveBeenCalled())
    // Esattamente la stringa dell'input: nessuna `T`, nessuna `Z`, nessun'ora.
    // Un datetime ISO qui è la forma da cui nasce lo slittamento di un giorno
    // il giorno in cui qualcuno passasse un `Date` invece della stringa.
    expect(mockOnSubmit.mock.calls[0][0].expiry_date).toBe('2026-09-04')
  })

  it('accetta una data nel passato: il divieto è stato tolto dallo schema', async () => {
    const user = userEvent.setup()
    const { container } = render(<FoodForm mode="create" onSubmit={mockOnSubmit} />)

    await fill(user, { data: '2020-01-15', category: 'cat-1' })
    await sendForm(container)

    await waitFor(() => expect(mockOnSubmit).toHaveBeenCalled())
    expect(mockOnSubmit.mock.calls[0][0].expiry_date).toBe('2020-01-15')
  })

  it('la categoria pre-compila il luogo, se l\'utente non lo ha toccato', async () => {
    const user = userEvent.setup()
    render(<FoodForm mode="create" onSubmit={mockOnSubmit} />)

    await user.selectOptions(screen.getByLabelText(/Categoria \*/), 'cat-2')

    expect(screen.getByLabelText(/Posizione \*/)).toHaveValue('freezer')
  })

  it('non sovrascrive il luogo che l\'utente ha già scelto a mano', async () => {
    const user = userEvent.setup()
    render(<FoodForm mode="create" onSubmit={mockOnSubmit} />)

    // L'utente sceglie «Dispensa» **prima** della categoria: è una decisione,
    // e un cambio di categoria non deve scavalcarla.
    await user.selectOptions(screen.getByLabelText(/Posizione \*/), 'pantry')
    await user.selectOptions(screen.getByLabelText(/Categoria \*/), 'cat-2')

    expect(screen.getByLabelText(/Posizione \*/)).toHaveValue('pantry')
  })
})

/**
 * Il barcode scansionato arriva alla riga.
 *
 * Era `null` fisso in `useFoodFormDialog` (entro#115): la colonna esiste, ha
 * un indice, e nessuna riga l'ha mai portata. Il codice non è un campo del
 * form — non lo digita nessuno — quindi viaggia come secondo argomento di
 * `onSubmit`, fuori da `FoodFormData` e fuori dallo schema Zod.
 */
describe('FoodForm — il barcode scansionato', () => {
  const mockOnSubmit = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    capturedOnScanSuccess = null
  })

  afterEach(() => {
    cleanup()
  })

  async function scan(user: ReturnType<typeof userEvent.setup>, code: string) {
    await user.click(screen.getAllByRole('button', { name: /Scansiona Barcode/i })[0])
    await waitFor(() => expect(capturedOnScanSuccess).not.toBeNull())
    await act(async () => {
      capturedOnScanSuccess!(code)
    })
  }

  async function sendForm(container: HTMLElement) {
    await act(async () => {
      fireEvent.submit(container.querySelector('form')!)
    })
  }

  it('passa il codice a onSubmit quando Open Food Facts conosce il prodotto', async () => {
    const user = userEvent.setup()
    mockFetchProduct.mockResolvedValue({
      data: { product_name: 'Latte Intero', categories_tags: ['dairies'] },
      error: null,
    })
    mockMapProduct.mockReturnValue({ name: 'Latte Intero', category_id: 'cat-1' })

    const { container } = render(<FoodForm mode="create" onSubmit={mockOnSubmit} />)
    await scan(user, '8001120000123')
    fireEvent.change(screen.getByLabelText(/Data di scadenza \*/), {
      target: { value: '2026-09-04' },
    })
    await sendForm(container)

    await waitFor(() => expect(mockOnSubmit).toHaveBeenCalled())
    expect(mockOnSubmit.mock.calls[0][1]).toBe('8001120000123')
  })

  it('passa il codice anche se il prodotto non è nel catalogo', async () => {
    // Il caso che conta: un prodotto sconosciuto ha comunque un codice, ed è
    // proprio lì che salvarlo serve di più. Registrare il barcode solo in caso
    // di successo perderebbe questi.
    const user = userEvent.setup()
    mockFetchProduct.mockResolvedValue({ data: null, error: 'not found' })

    const { container } = render(<FoodForm mode="create" onSubmit={mockOnSubmit} />)
    await scan(user, '9999999999999')
    await user.type(screen.getByLabelText(/Nome \*/), 'Prodotto ignoto')
    await user.selectOptions(screen.getByLabelText(/Categoria \*/), 'cat-1')
    fireEvent.change(screen.getByLabelText(/Data di scadenza \*/), {
      target: { value: '2026-09-04' },
    })
    await sendForm(container)

    await waitFor(() => expect(mockOnSubmit).toHaveBeenCalled())
    expect(mockOnSubmit.mock.calls[0][1]).toBe('9999999999999')
  })

  it('senza scansione passa null, non una stringa vuota', async () => {
    const user = userEvent.setup()
    const { container } = render(<FoodForm mode="create" onSubmit={mockOnSubmit} />)

    await user.type(screen.getByLabelText(/Nome \*/), 'Latte intero')
    await user.selectOptions(screen.getByLabelText(/Categoria \*/), 'cat-1')
    fireEvent.change(screen.getByLabelText(/Data di scadenza \*/), {
      target: { value: '2026-09-04' },
    })
    await sendForm(container)

    await waitFor(() => expect(mockOnSubmit).toHaveBeenCalled())
    expect(mockOnSubmit.mock.calls[0][1]).toBeNull()
  })

  it('in modifica conserva il codice esistente senza riscansionare', async () => {
    // Salvare una modifica al solo nome non deve cancellare il barcode che la
    // riga già portava: il ref parte da `initialData`, non da `null`.
    const { container } = render(
      <FoodForm
        mode="edit"
        initialData={
          {
            id: 'f1',
            name: 'Latte intero',
            category_id: 'cat-1',
            storage_location: 'fridge',
            expiry_date: '2026-09-04',
            quantity: null,
            quantity_unit: null,
            notes: null,
            image_url: null,
            barcode: '8001120000123',
          } as never
        }
        onSubmit={mockOnSubmit}
      />
    )
    await sendForm(container)

    await waitFor(() => expect(mockOnSubmit).toHaveBeenCalled())
    expect(mockOnSubmit.mock.calls[0][1]).toBe('8001120000123')
  })
})
