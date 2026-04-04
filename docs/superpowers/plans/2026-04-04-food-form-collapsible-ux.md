# Food Form Collapsible UX Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the barcode scan flow to keep the main collapsible open, and add visual distinction to closed collapsible headers in both light and dark mode.

**Architecture:** Two small changes in `FoodForm.tsx`: (1) remove the `setOpenSection('details')` call after barcode scan, (2) add conditional background styling to collapsed section headers. The background color will be determined using `/frontend-design` with Playwright screenshots.

**Tech Stack:** React, Tailwind CSS, Vitest

**Spec:** `docs/superpowers/specs/2026-04-04-food-form-collapsible-ux-design.md`

---

### Task 1: Remove auto-switch to details section after barcode scan

**Files:**
- Modify: `src/components/foods/FoodForm.tsx:220-223`
- Test: `src/components/foods/__tests__/FoodForm.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

Create `src/components/foods/__tests__/FoodForm.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies before importing component
const mockFetchProductByBarcode = vi.fn()
const mockMapProductToFormData = vi.fn()

vi.mock('@/lib/openfoodfacts', () => ({
  fetchProductByBarcode: (...args: unknown[]) => mockFetchProductByBarcode(...args),
  mapProductToFormData: (...args: unknown[]) => mockMapProductToFormData(...args),
}))

vi.mock('@/hooks/useFoods', () => ({
  useCategories: () => ({
    data: [
      { id: 'cat-1', name_it: 'Latticini' },
      { id: 'cat-2', name_it: 'Bevande' },
    ],
    isLoading: false,
  }),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      unsubscribe: vi.fn(),
    })),
    getChannels: vi.fn(() => []),
    removeChannel: vi.fn(),
  },
}))

vi.mock('@/lib/realtime', () => ({
  mutationTracker: {
    wasRecentlyMutated: vi.fn(() => false),
  },
}))

// Need jsdom for React rendering
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FoodForm } from '../FoodForm'

describe('FoodForm collapsible behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps main section open after barcode scan populates notes', async () => {
    // Setup: barcode scan returns product with notes
    mockFetchProductByBarcode.mockResolvedValue({
      data: { product_name: 'Latte Intero' },
      error: null,
    })
    mockMapProductToFormData.mockReturnValue({
      name: 'Latte Intero',
      category_id: 'cat-1',
      storage_location: 'fridge',
      quantity: 1,
      quantity_unit: 'l',
      notes: 'Brand: Granarolo. Categorie OFF: en:milks',
    })

    render(<FoodForm mode="create" onSubmit={vi.fn()} />)

    // Main section should be visible (open by default)
    const mainSection = screen.getByTestId('section-main')
    expect(mainSection).not.toHaveClass('hidden')

    // Simulate barcode scan by calling the onScanSuccess callback
    // We need to open the scanner first, then trigger the scan
    const scanButton = screen.getByRole('button', { name: /scanner barcode/i })
    await userEvent.click(scanButton)

    // Wait for the scan to complete and form to be populated
    await waitFor(() => {
      expect(mockFetchProductByBarcode).toHaveBeenCalled()
    })

    // CRITICAL: Main section should STILL be open (not switched to details)
    expect(mainSection).not.toHaveClass('hidden')

    // Details section should be closed
    const detailsSection = screen.getByTestId('section-details')
    expect(detailsSection).toHaveClass('hidden')
  })

  it('starts with main section open by default', () => {
    render(<FoodForm mode="create" onSubmit={vi.fn()} />)

    const mainSection = screen.getByTestId('section-main')
    const detailsSection = screen.getByTestId('section-details')

    expect(mainSection).not.toHaveClass('hidden')
    expect(detailsSection).toHaveClass('hidden')
  })
})
```

> **Note:** The test references `data-testid` attributes that don't exist yet. We'll add them in Step 3. The barcode scanner test may need adjustment based on how the BarcodeScanner lazy component renders in the test environment — the core assertion is that `section-main` stays visible after `handleBarcodeScanned` completes.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/foods/__tests__/FoodForm.test.tsx`

Expected: FAIL — `data-testid` attributes don't exist yet, and barcode scan still switches to details section.

> **Important:** The test environment is `node` in the vitest config. For React component tests, you need `jsdom`. If the test fails due to missing DOM APIs, add `// @vitest-environment jsdom` at the top of the test file, or update `vitest.config.ts` for this test. Also ensure `@testing-library/react` and `@testing-library/user-event` are installed — if not, run `npm install -D @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom`.

- [ ] **Step 3: Implement the fix**

In `src/components/foods/FoodForm.tsx`:

**3a.** Add `data-testid` to the section containers (for testability):

Change line 311:
```tsx
// Before:
<div id="section-main" className={openSection !== 'main' ? 'hidden' : 'space-y-4'}>
// After:
<div id="section-main" data-testid="section-main" className={openSection !== 'main' ? 'hidden' : 'space-y-4'}>
```

Change line 526:
```tsx
// Before:
<div id="section-details" className={openSection !== 'details' ? 'hidden' : 'space-y-4'}>
// After:
<div id="section-details" data-testid="section-details" className={openSection !== 'details' ? 'hidden' : 'space-y-4'}>
```

**3b.** Remove lines 220-223 (the auto-switch to details after barcode scan):

```tsx
// REMOVE these lines entirely:
      // Auto-expand details section if barcode populated optional fields
      if (mappedData.notes) {
        setOpenSection('details')
      }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/foods/__tests__/FoodForm.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/foods/FoodForm.tsx src/components/foods/__tests__/FoodForm.test.tsx
git commit -m "fix: keep main section open after barcode scan

Previously, scanning a barcode with notes auto-switched to the details
section, hiding required fields (expiry date, quantity) the user still
needed to fill in."
```

---

### Task 2: Add background color to closed collapsible headers

**Files:**
- Modify: `src/components/foods/FoodForm.tsx:295-298,509-512`

- [ ] **Step 1: Determine the right background color using /frontend-design**

Use the `/frontend-design` skill with Playwright screenshots to:
1. Take a screenshot of the food form in its current state (both light and dark mode)
2. Propose a subtle background color for closed collapsible headers
3. The color must work in both light and dark mode
4. It should be consistent with the app's existing color palette (see the orange conflict banner at line 280 for the pattern: `bg-X-50 dark:bg-X-900/20`)

A good starting point pattern: `bg-muted/50 dark:bg-muted/30` (uses the theme's muted color at low opacity). Adjust based on screenshot results.

- [ ] **Step 2: Write the test**

Add to `src/components/foods/__tests__/FoodForm.test.tsx`:

```tsx
describe('FoodForm closed collapsible styling', () => {
  it('applies background color to closed section header', () => {
    render(<FoodForm mode="create" onSubmit={vi.fn()} />)

    // Main section is open, details is closed
    const detailsButton = screen.getByRole('button', { name: /dettagli aggiuntivi/i })

    // Closed section should have the background class
    expect(detailsButton.className).toMatch(/bg-/)
  })

  it('removes background color from open section header', async () => {
    render(<FoodForm mode="create" onSubmit={vi.fn()} />)

    const mainButton = screen.getByRole('button', { name: /dati alimento/i })

    // Open section should NOT have the closed background class
    // (The exact class depends on the color chosen in Step 1 — update accordingly)
    expect(mainButton.className).not.toMatch(/bg-muted/)
  })

  it('swaps background when toggling sections', async () => {
    render(<FoodForm mode="create" onSubmit={vi.fn()} />)

    const mainButton = screen.getByRole('button', { name: /dati alimento/i })
    const detailsButton = screen.getByRole('button', { name: /dettagli aggiuntivi/i })

    // Initially: main is open (no bg), details is closed (has bg)
    expect(detailsButton.className).toMatch(/bg-/)

    // Click details to open it (closes main)
    await userEvent.click(detailsButton)

    // Now: main is closed (has bg), details is open (no bg)
    expect(mainButton.className).toMatch(/bg-/)
  })
})
```

> **Note:** The exact class assertions (`bg-muted` etc.) should match the color chosen in Step 1. Update the test accordingly after the `/frontend-design` skill determines the final color.

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/components/foods/__tests__/FoodForm.test.tsx`

Expected: FAIL — no background class on closed headers yet.

- [ ] **Step 4: Add conditional background to collapsible headers**

In `src/components/foods/FoodForm.tsx`, modify the main section button (line 298):

```tsx
// Before:
className="flex w-full items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md p-2 -mx-2"

// After (add conditional bg class — replace COLOR_CLASS with the value from Step 1):
className={`flex w-full items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md p-2 -mx-2${openSection !== 'main' ? ' COLOR_CLASS' : ''}`}
```

And the details section button (line 512):

```tsx
// Before:
className="flex w-full items-center gap-2 text-left border-t pt-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md px-2 pb-2 -mx-2"

// After:
className={`flex w-full items-center gap-2 text-left border-t pt-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md px-2 pb-2 -mx-2${openSection !== 'details' ? ' COLOR_CLASS' : ''}`}
```

Replace `COLOR_CLASS` with the Tailwind classes chosen in Step 1 (e.g., `bg-muted/50 dark:bg-muted/30`).

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/foods/__tests__/FoodForm.test.tsx`

Expected: PASS

- [ ] **Step 6: Visual verification with Playwright**

Use Playwright to take screenshots of the form in both light and dark mode. Verify that:
1. The closed collapsible header has a visible but subtle background
2. The open collapsible header has no extra background
3. The color works well in both themes

If the color doesn't look right, iterate on the Tailwind classes and re-screenshot.

- [ ] **Step 7: Commit**

```bash
git add src/components/foods/FoodForm.tsx src/components/foods/__tests__/FoodForm.test.tsx
git commit -m "feat: add background color to closed collapsible headers

Closed accordion sections now have a subtle background to make them
visually distinct and more discoverable. Works in both light and dark mode."
```

---

### Task 3: Run code-simplifier

- [ ] **Step 1: Run the code-simplifier skill**

Use the Skill tool: `skill: "code-simplifier:code-simplifier"`

This will review all changes in `FoodForm.tsx` and the new test file for clarity and consistency.

- [ ] **Step 2: Apply any suggestions and commit if changes were made**

```bash
git add -u
git commit -m "refactor: simplify collapsible UX code per code-simplifier"
```

---

### Task 4: Final verification

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`

Expected: All tests pass.

- [ ] **Step 2: Manual smoke test checklist**

Verify in the browser:
1. Open food form → main section is open, details is closed
2. Scan a barcode → main section stays open after scan completes
3. Expiry date and quantity fields are visible and editable after scan
4. Closed section has subtle background color (light mode)
5. Closed section has subtle background color (dark mode)
6. Click to toggle sections → background swaps correctly
7. Submit form with validation errors → main section auto-opens
