/**
 * La scala delle distanze fra elementi (#106).
 *
 * I cinque nomi sono quelli del bundle di famiglia
 * (`entro-family/conventions/distance-scale.md`) e di entro-mobile: il ruolo è
 * condiviso, il valore è di piattaforma. Si scrive `gap-blocks`, non `gap-4`:
 * il nome dice cosa separa da cosa, il numero no. I valori sono gli stessi del
 * nativo, in `rem` perché sul web il `rem` è quello del browser (sul nativo
 * sono in px perché NativeWind lo risolve a 14). I padding di inset (`px-*`,
 * `py-*`) restano numerici: sono distanza dal bordo, non ritmo.
 *
 * Il guardiano è `src/__tests__/spacingScale.test.ts`.
 */
const DISTANCE_SCALE = {
  /** Un'etichetta e il **suo** controllo: una coppia inseparabile. */
  paired: '0.375rem',
  /** Pezzi dentro uno stesso elemento: titolo e sottotitolo, icona e testo. */
  inner: '0.5rem',
  /** Elementi omogenei in sequenza: gli alimenti, le chip di un filtro. */
  siblings: '0.75rem',
  /** Blocchi di natura diversa: i campi di un form, la ricerca e i conteggi. */
  blocks: '1rem',
  /** Sezioni di una schermata. */
  sections: '1.5rem',
};

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      spacing: DISTANCE_SCALE,
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
}
