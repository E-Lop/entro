---
name: Entro
description: PWA italiana per il tracciamento delle scadenze alimentari, mobile-first
colors:
  primary: "#16a34a"
  primary-foreground: "#fef2f2"
  primary-dark: "#22c55e"
  background: "#ffffff"
  foreground: "#0a0a0a"
  card: "#ffffff"
  card-foreground: "#0a0a0a"
  muted: "#f5f5f5"
  muted-foreground: "#737373"
  border: "#e5e5e5"
  ring: "#16a34a"
  destructive: "#ef4444"
  destructive-foreground: "#fafafa"
typography:
  display:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 5vw, 1.875rem)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.25
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.lg}"
    padding: "16px"
  input:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  fab:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.full}"
    size: "56px"
---

# Design System: Entro

## 1. Overview

**Creative North Star: "La dispensa pulita"**

Entro è un'app da cucina: utile, calma, leggibile a colpo d'occhio mentre tieni il telefono con una mano e
la spesa nell'altra. Il sistema visivo è uno **shadcn/ui neutro con un'unica voce verde**: superfici bianche e
grigi neutri che fanno da sfondo silenzioso, e il verde del brand (#16a34a) che porta tutte le azioni e gli
stati attivi. La densità è bassa, lo spazio respira, niente ornamenti: l'informazione che conta è lo stato di
scadenza, e tutto il resto si fa da parte.

Il sistema rifiuta esplicitamente l'estetica "AI-slop" e la dashboard SaaS generica: niente gradient text,
niente glassmorphism decorativo, niente palette cream/sand, niente hero-metric template, niente blu corporate.
Il verde non è "sostenibilità", è freschezza e cibo.

**Key Characteristics:**
- Superfici neutre, una sola voce cromatica (verde brand).
- Mobile-first: pollice, target ampi, una mano.
- Stato di scadenza leggibile in una frazione di secondo, mai affidato al solo colore.
- Calmo e fidato: l'urgenza si nota senza gridare.

## 2. Colors

Palette neutra (bianco + scala di grigi) con un unico accento verde; il rosso è riservato al pericolo. I valori
canonici sono definiti come CSS custom properties HSL in `src/index.css` (tema chiaro e `.dark`); i token qui
sono la loro resa sRGB.

### Primary
- **Verde Entro** (#16a34a): l'identità. Bottoni primari, FAB, stati attivi/selezionati, focus ring, link.
  In dark mode si schiarisce a **Verde Acceso** (#22c55e) per restare leggibile sul fondo scuro.

### Neutral
- **Bianco** (#ffffff): sfondo app e superfici card.
- **Inchiostro** (#0a0a0a): testo primario.
- **Grigio tenue** (#f5f5f5): superfici muted, riempimenti secondari.
- **Grigio testo** (#737373): testo secondario/label. Al limite del contrasto AA su bianco (~4.6:1): non
  scendere sotto questo valore per il testo.
- **Bordo** (#e5e5e5): bordi card, input, divisori.

### Tertiary — Stati di scadenza (semantici)
Il dominio richiede tre stati, ora resi da **token semantici** (CSS custom properties HSL in `src/index.css`,
light + `.dark`, mappati in Tailwind come `bg-warning` / `text-success` / `bg-destructive` ecc.). I valori sono
volutamente scuri e saturi, con foreground bianco, per superare AA anche come badge soft su tinte chiare.

| Stato | Token | Light (HSL → ~sRGB) | Dark (HSL) | Foreground |
|---|---|---|---|---|
| **OK / fresco** | `--success` | `142 74% 26%` ≈ #117335 | `142 60% 62%` | `--success-foreground` (bianco) |
| **In scadenza** | `--warning` | `25 90% 34%` ≈ #a54a0a | `40 96% 60%` | `--warning-foreground` (bianco) |
| **Scaduto** | `--destructive` | `0 84% 60%` ≈ #ef4444 | `0 72% 50%` | `--destructive-foreground` (bianco) |

Regola operativa: **mai colori Tailwind grezzi** (`orange-*`, `amber-*`, `red-*`, `green-*`) dove esiste un
token; rompono il dark mode e l'identità. La banda "in scadenza" è **unica** (≤7gg = `--warning`), non sfumata
su più tier.

### Named Rules
**La regola Una Sola Voce.** L'unico accento cromatico è il verde del brand. Lo stato attivo, il focus, le
azioni primarie sono verdi: mai blu, mai un secondo accento "perché serviva un colore".

**La regola Mai Solo Colore.** Lo stato di scadenza non è mai comunicato dal solo colore: sempre colore +
icona + testo. Un daltonico deve distinguere "in scadenza" da "scaduto" senza vedere arancione vs rosso.

## 3. Typography

**Display Font:** Inter (fallback system-ui, sans-serif)
**Body Font:** Inter (stessa famiglia)
**Label Font:** Inter

**Character:** una sola famiglia, gerarchia costruita su scala + peso. Inter è neutra e legge bene a corpo
piccolo su mobile; la personalità viene dal contrasto di peso, non dall'accostamento di font.

### Hierarchy
- **Display** (700, clamp 1.5–1.875rem, lh 1.2, tracking -0.025em): saluto Dashboard, titoli di pagina.
- **Title** (600, 1.125rem, lh 1.3): titoli di card e dialog.
- **Body** (400, 0.875–1rem, lh 1.5): testo corrente, descrizioni.
- **Label** (500, 0.75rem): etichette stat, metadati, caption (colore grigio testo #737373).

### Named Rules
**La regola Una Famiglia.** Una sola famiglia (Inter). La gerarchia nasce da peso e scala, mai
dall'introduzione di un secondo typeface.

## 4. Elevation

Sistema sostanzialmente **piatto con ombre sottili come segnale di stato**. Le superfici riposano piatte; le
card statistiche e le food card sollevano leggermente in hover, il FAB ha un'ombra persistente perché
galleggia sopra il contenuto.

### Shadow Vocabulary
- **Riposo** (`shadow-sm`): card e contenitori a riposo.
- **Hover** (`shadow-md`): card interattive al passaggio/tap.
- **Flottante** (`shadow-lg`): FAB e elementi che galleggiano stabilmente sopra il contenuto.

### Named Rules
**La regola Piatto a Riposo.** Le superfici sono piatte di default; l'ombra compare come risposta a uno stato
(hover, flottante), non come decorazione permanente.

## 5. Components

### Buttons
- **Shape:** angoli arrotondati morbidi (6px, `rounded-md`).
- **Primary:** fondo verde brand (#16a34a), testo chiaro (#fef2f2), padding 8×16px. Icona Lucide + testo
  (verbo + oggetto).
- **Hover / Focus:** scurimento leggero del fondo; focus-visible con ring verde a 2px e offset.
- **Outline / Ghost:** fondo trasparente/bianco, testo inchiostro, bordo neutro; per azioni secondarie.

### Stat cards (segnale-componente)
Tre pulsanti-statistica (Totali / In scadenza / Scaduti) che fungono da quick-filter. Card neutra con icona +
numero grande + label; lo stato selezionato è evidenziato da un ring. **Il ring selezionato deve essere verde
brand** (oggi alcuni stati usano `ring-blue-500`: fuori sistema, da correggere).

### Cards / Containers
- **Corner Style:** 8px (`rounded-lg`).
- **Background:** bianco (#ffffff), testo inchiostro.
- **Shadow Strategy:** `shadow-sm` a riposo, `shadow-md` in hover (vedi Elevation).
- **Border:** 1px neutro (#e5e5e5).
- **Internal Padding:** 16px.

### Inputs / Fields
- **Style:** bordo neutro 1px, fondo bianco, 6px radius, padding 8×12px.
- **Focus:** ring verde brand (#16a34a), focus-visible.
- **Error:** messaggio inline sotto il campo; bordo/destructive rosso (#ef4444).

### Navigation
- Header sticky con icona app + branding, accesso a guida, tema, menu utente. Su mobile l'azione primaria
  (aggiungi) è un **FAB verde a pollice** in basso a destra (56px, `rounded-full`), non nell'header.

## 6. Do's and Don'ts

### Do:
- **Do** usare il **verde brand (#16a34a)** per ogni azione primaria, stato attivo, selezione e focus ring.
- **Do** comunicare lo stato di scadenza con **colore + icona + testo** insieme (regola Mai Solo Colore).
- **Do** mantenere i target tattili **≥ 44×44px** su mobile (le primitive condivise — `Button size="touch"`,
  `AlertDialog`, chiusura `Dialog` — sono già a 44px; usa `touch`/`icon-touch` per i nuovi controlli tappabili).
- **Do** tenere il testo secondario a **#737373 o più scuro** (mai grigi più tenui: scendono sotto 4.5:1).
- **Do** usare i token semantici `--warning` / `--success` / `--destructive` per gli stati di scadenza (già
  definiti in `src/index.css`, light + dark; vedi §2).

### Don't:
- **Don't** usare il **blu** (es. `ring-blue-500`) per stati attivi o accenti: il brand è verde, non blu.
- **Don't** hard-codare colori Tailwind grezzi (`green-600`, `orange-600`, `red-500`) dove esiste o dovrebbe
  esistere un token; rompono il dark mode e l'identità.
- **Don't** usare **gradient text** (`background-clip: text`), **glassmorphism** decorativo, palette cream/sand,
  eyebrow maiuscolo tracked sopra ogni sezione, o l'**hero-metric template** (tutti tell dell'AI-slop).
- **Don't** affidare un'informazione critica al **solo colore**.
- **Don't** introdurre un secondo font: la gerarchia è peso + scala su Inter.
