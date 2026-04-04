# Food Form Collapsible UX Improvements

**Date**: 2026-04-04
**Status**: Approved

## Problem

When adding a food item via barcode scanning, the form auto-switches to the "Dettagli aggiuntivi" (Additional Details) collapsible section because scanned notes trigger `setOpenSection('details')`. This closes the main section where the user still needs to fill in **expiry date** and **quantity** — two fields that are never auto-populated by the barcode scan.

Additionally, closed collapsible sections lack visual distinction, making them easy to overlook.

## Solution

### 1. Keep main section open after barcode scan

**File**: `src/components/foods/FoodForm.tsx`

Remove the auto-expansion of the details section after barcode scan (lines 221-223):

```typescript
// REMOVE THIS:
if (mappedData.notes) {
  setOpenSection('details')
}
```

The default state `useState<'main' | 'details'>('main')` already ensures the main section starts open. After scanning, the user stays in the main section to complete expiry date and quantity, then can optionally open the details section to review notes.

**Rationale**: The scanned notes (brand info, OFF categories) are informational and rarely need editing. The user's immediate need after scanning is completing the required fields in the main section.

### 2. Visual distinction for closed collapsibles

Add a subtle background color to collapsed section headers so they are visually identifiable as expandable areas.

**Behavior**:
- **Open section**: No background change (current behavior)
- **Closed section**: Subtle colored background on the header/button

**Implementation**: The exact color will be determined using `/frontend-design` with screenshots of the current UI to ensure consistency with the app's theme. The chosen color must work well in both light mode and dark mode.

**File**: `src/components/foods/FoodForm.tsx` — conditional class on the collapsible header buttons.

## Scope

- No changes to barcode scanning logic, API integration, or data mapping
- No changes to form validation or field structure
- No changes to the accordion mutual-exclusion behavior (one section open at a time)
- Visual change limited to collapsible header styling when closed

## Testing

- Barcode scan keeps main section open; user can fill expiry date and quantity without switching
- Manual form entry (no barcode) works as before — main section starts open
- Closed collapsible headers show distinct background color in both light and dark mode
- Opening a section removes the background color
- Form validation still auto-expands main section on errors
