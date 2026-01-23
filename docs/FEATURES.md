# Features Specification

## 📋 Feature Overview

Questo documento descrive in dettaglio tutte le funzionalità dell'applicazione, organizzate per priorità e fase di sviluppo.

---

## 🎯 MVP Features (Fase 1-2)

### F1: Gestione Alimenti (CRUD)

#### F1.1 - Creazione Alimento

**User Story**: Come utente, voglio aggiungere un nuovo alimento al mio inventario per tenere traccia della sua scadenza.

**Acceptance Criteria**:
- ✅ Form con tutti i campi richiesti
- ✅ Validazione input in tempo reale
- ✅ Suggerimenti categoria basati su nome
- ✅ Date picker per scadenza
- ✅ Upload immagine opzionale
- ✅ Salvataggio con feedback visivo
- ✅ Aggiunta rapida senza immagine per UX veloce

**UI Components**:
```typescript
<FoodForm
  mode="create"
  onSubmit={handleCreate}
  onCancel={handleClose}
/>

// Form fields:
- name: Input text (required)
- quantity: Number input + Unit select (optional)
- expiry_date: DatePicker (required)
- category: Select with icons (required)
- storage_location: Radio buttons (required)
- image: Drag & drop upload (optional)
- notes: Textarea (optional)
```

**Validation Rules**:
```typescript
const foodSchema = z.object({
  name: z.string().min(2, 'Nome troppo corto').max(100),
  quantity: z.number().positive().optional(),
  quantity_unit: z.enum(['pz', 'kg', 'g', 'l', 'ml']).optional(),
  expiry_date: z.date().min(new Date(), 'Data deve essere futura'),
  category_id: z.string().uuid(),
  storage_location: z.enum(['fridge', 'freezer', 'pantry']),
  image: z.instanceof(File).optional(),
  notes: z.string().max(500).optional(),
})
```

#### F1.2 - Visualizzazione Alimenti

**User Story**: Come utente, voglio vedere tutti i miei alimenti in modo chiaro per capire cosa sta per scadere.

**Views**:

**Grid View (Default)**:
```typescript
<FoodList view="grid">
  <FoodCard
    food={food}
    onClick={handleView}
    onEdit={handleEdit}
    onDelete={handleDelete}
  />
</FoodList>

// Card mostra:
- Immagine (o icona categoria)
- Nome alimento
- Quantità (se presente)
- Badge categoria (con colore)
- Giorni alla scadenza (color-coded)
- Icona storage location
- Badge "Scaduto" se necessario
```

**Color Coding per Scadenza**:
```typescript
const getExpiryColor = (daysUntilExpiry: number) => {
  if (daysUntilExpiry < 0) return 'red' // Scaduto
  if (daysUntilExpiry === 0) return 'red' // Scade oggi
  if (daysUntilExpiry <= 2) return 'orange' // 1-2 giorni
  if (daysUntilExpiry <= 7) return 'yellow' // 3-7 giorni
  return 'green' // >7 giorni
}
```

**List View (Alternativa)**:
- Tabella compatta
- Sorting su ogni colonna
- Checkbox per selezione multipla

#### F1.3 - Modifica Alimento

**User Story**: Come utente, voglio modificare un alimento esistente per aggiornare quantità o scadenza.

**Acceptance Criteria**:
- ✅ Form pre-compilato con dati esistenti
- ✅ Possibilità di modificare tutti i campi
- ✅ Modifica immagine (sostituisci o rimuovi)
- ✅ Salvataggio con optimistic update
- ✅ Annulla ripristina valori originali

**Quick Actions**:
```typescript
// Modifica rapida quantità (senza aprire form completo)
<QuantityQuickEdit
  currentQuantity={food.quantity}
  onUpdate={(newQuantity) => updateFood({ quantity: newQuantity })}
/>

// Bottoni: -1, Custom input, +1
```

#### F1.4 - Eliminazione Alimento

**User Story**: Come utente, voglio eliminare alimenti consumati o buttati.

**Acceptance Criteria**:
- ✅ Conferma prima di eliminare
- ✅ Opzionale: "Perché elimini?" (consumato, scaduto, altro)
- ✅ Undo per 5 secondi dopo eliminazione
- ✅ Soft delete per statistiche future

**UI Flow**:
```typescript
// Click su delete
<AlertDialog>
  <AlertDialogTitle>Elimina {food.name}?</AlertDialogTitle>
  <AlertDialogDescription>
    Perché stai eliminando questo alimento?
  </AlertDialogDescription>
  <RadioGroup>
    <Radio value="consumed">Consumato ✅</Radio>
    <Radio value="expired">Scaduto/Buttato 🗑️</Radio>
    <Radio value="other">Altro</Radio>
  </RadioGroup>
  <AlertDialogAction onClick={handleDelete}>Elimina</AlertDialogAction>
</AlertDialog>

// Toast con undo
toast.success('Alimento eliminato', {
  action: {
    label: 'Annulla',
    onClick: handleUndo
  }
})
```

---

### F2: Filtri e Ricerca

#### F2.1 - Filtri Base

**User Story**: Come utente, voglio filtrare gli alimenti per categoria e location per trovare cosa cerco velocemente.

**Filters**:

**Filtro Categorie**:
```typescript
<MultiSelect
  options={categories}
  value={selectedCategories}
  onChange={setSelectedCategories}
  renderOption={(cat) => (
    <>
      <Icon name={cat.icon} />
      {cat.name}
    </>
  )}
/>
```

**Filtro Storage Location**:
```typescript
<SegmentedControl
  options={[
    { value: 'all', label: 'Tutti', icon: 'package' },
    { value: 'fridge', label: 'Frigo', icon: 'refrigerator' },
    { value: 'freezer', label: 'Freezer', icon: 'snowflake' },
    { value: 'pantry', label: 'Dispensa', icon: 'archive' }
  ]}
  value={storageFilter}
  onChange={setStorageFilter}
/>
```

**UI Placement**:
- Top bar con sticky position
- Badge con count per filtri attivi
- "Reset Filters" button quando ≥1 filtro attivo

#### F2.2 - Ordinamento

**User Story**: Come utente, voglio ordinare gli alimenti in modi diversi per diverse situazioni.

**Sort Options**:
```typescript
type SortOption = 
  | 'expiry_date:asc'    // Scadenza più vicina
  | 'expiry_date:desc'   // Scadenza più lontana
  | 'name:asc'           // A → Z
  | 'name:desc'          // Z → A
  | 'created_at:desc'    // Più recenti
  | 'quantity:desc'      // Quantità maggiore

<Select
  value={sortBy}
  onChange={setSortBy}
  options={sortOptions}
/>
```

**Default**: `expiry_date:asc` (scadenza più vicina)

#### F2.3 - Ricerca Full-Text

**User Story**: Come utente, voglio cercare un alimento per nome per trovarlo velocemente.

**Implementation**:
```typescript
<SearchBar
  placeholder="Cerca alimento..."
  value={searchQuery}
  onChange={handleSearch} // Debounced 300ms
  onClear={clearSearch}
/>

// Backend: PostgreSQL full-text search
WHERE to_tsvector('italian', name) @@ plainto_tsquery('italian', :query)
```

**Features**:
- ✅ Ricerca mentre digiti (debounced)
- ✅ Evidenzia match nei risultati
- ✅ "X risultati trovati" feedback
- ✅ Ricerca case-insensitive
- ✅ Ricerca parziale (es. "moz" trova "mozzarella")

---

### F3: Autenticazione

#### F3.1 - Sign Up

**User Story**: Come nuovo utente, voglio creare un account per iniziare a tracciare i miei alimenti.

**Form Fields**:
```typescript
<SignUpForm>
  <Input name="email" type="email" required />
  <Input name="password" type="password" required minLength={8} />
  <Input name="confirmPassword" type="password" required />
  <Checkbox name="termsAccepted" required>
    Accetto i termini e condizioni
  </Checkbox>
  <Button type="submit">Crea Account</Button>
</SignUpForm>
```

**Validation**:
- Email valida e non già registrata
- Password ≥8 caratteri, con lettere e numeri
- Password match
- Terms accepted

**Flow**:
1. User compila form
2. Validazione client-side
3. API call a Supabase Auth
4. Email di verifica inviata
5. Redirect a "Check your email" page
6. User clicca link email
7. Redirect a app (auto-login)

#### F3.2 - Login

**User Story**: Come utente esistente, voglio fare login per accedere ai miei dati.

**Methods**:
```typescript
// Email + Password
<LoginForm>
  <Input name="email" type="email" />
  <Input name="password" type="password" />
  <Checkbox name="rememberMe">Ricordami</Checkbox>
  <Button type="submit">Accedi</Button>
  <Link to="/forgot-password">Password dimenticata?</Link>
</LoginForm>

// Magic Link (Future)
<MagicLinkForm>
  <Input name="email" placeholder="La tua email" />
  <Button>Invia link di accesso</Button>
</MagicLinkForm>
```

**Remember Me**:
- Cookie session persistente (7 giorni)
- Senza checkbox: sessione temporanea

#### F3.3 - Logout

**User Story**: Come utente, voglio fare logout per proteggere i miei dati su device condivisi.

**Implementation**:
```typescript
<DropdownMenu>
  <DropdownMenuTrigger>
    <Avatar user={currentUser} />
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem>Profilo</DropdownMenuItem>
    <DropdownMenuItem>Impostazioni</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem onClick={handleLogout}>
      Esci
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

**Logout Flow**:
1. User clicca "Esci"
2. Clear Supabase session
3. Clear local state (Zustand stores)
4. Clear React Query cache
5. Redirect a login page

#### F3.4 - Password Reset

**User Story**: Come utente, voglio poter recuperare l'accesso se dimentico la password.

**Implementation**:

**Forgot Password Page** (`/forgot-password`):
```typescript
<ForgotPasswordForm>
  <Input
    name="email"
    type="email"
    placeholder="tua@email.com"
    required
  />
  <Button type="submit">Invia link di reset</Button>
  <Link to="/login">Torna al login</Link>
</ForgotPasswordForm>
```

**Reset Password Page** (`/reset-password`):
```typescript
<ResetPasswordForm>
  <Input
    name="password"
    type="password"
    placeholder="Nuova password"
    minLength={6}
    required
  />
  <Input
    name="confirmPassword"
    type="password"
    placeholder="Conferma password"
    required
  />
  <Button type="submit">Aggiorna password</Button>
</ResetPasswordForm>
```

**Password Reset Flow**:
1. User clicca "Password dimenticata?" nella login page
2. Inserisce email su `/forgot-password`
3. Supabase invia email con magic link
4. User clicca link email → redirect a `/reset-password`
5. Supabase crea sessione temporanea `PASSWORD_RECOVERY`
6. authStore intercetta evento e NON fa redirect automatico
7. User inserisce nuova password
8. Password aggiornata via `supabase.auth.updateUser()`
9. Redirect a dashboard con toast di successo

**Technical Details**:

**Auth Service Functions** (`lib/auth.ts`):
```typescript
// Request password reset email
export async function resetPasswordRequest(
  email: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  })
  return { error }
}

// Update password for authenticated user
export async function updatePassword(
  newPassword: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  })
  return { error }
}
```

**Auth State Management**:
```typescript
// authStore handles PASSWORD_RECOVERY event
const unsubscribe = onAuthStateChange((event, user, session) => {
  // Skip redirects during password recovery flow
  if (event === 'PASSWORD_RECOVERY') {
    console.log('Password recovery session detected')
    return // Stay on /reset-password page
  }
  // ... normal auth state handling
})
```

**Validation** (`lib/validations/auth.schemas.ts`):
```typescript
// Forgot password schema
export const forgotPasswordSchema = z.object({
  email: z.string().min(1, 'Email richiesta').email('Email non valida'),
})

// Reset password schema
export const resetPasswordSchema = z
  .object({
    password: z.string().min(6, 'Minimo 6 caratteri').max(72),
    confirmPassword: z.string().min(1, 'Conferma password richiesta'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Le password non corrispondono',
    path: ['confirmPassword'],
  })
```

**Supabase Email Template Configuration**:
- Template: Authentication → Email Templates → Reset Password
- Link format: `{{ .SiteURL }}/reset-password?access_token={{ .Token }}&type=recovery`
- Or use: `{{ .ConfirmationURL }}` (auto-generated by Supabase)
- Redirect URLs configured in: Authentication → URL Configuration
  - Development: `http://localhost:5173/reset-password`
  - Production: `https://entro-il.netlify.app/reset-password`

**Security Features**:
- Reset tokens are one-time use
- Tokens expire after limited time
- Password reset creates temporary auth session
- Session cleared after password update
- Password must meet minimum requirements (6+ chars)

**Error Handling**:
```typescript
// Rate limiting (Supabase default: 2 emails/hour)
if (error.message.includes('rate limit')) {
  toast.error('Troppe richieste. Riprova tra un\'ora')
}

// Invalid/expired token
if (error.message.includes('token')) {
  toast.error('Link scaduto. Richiedi un nuovo reset')
  navigate('/forgot-password')
}
```

**User Experience**:
- Clear visual feedback at each step
- Success/error toast notifications
- Loading states during async operations
- Auto-redirect after successful password update
- Link to login page from forgot password page
- Link to request new reset if token expired

---

### F4: Responsive Design

**User Story**: Come utente mobile, voglio un'app che funzioni perfettamente sul mio smartphone.

**Breakpoints**:
```typescript
const breakpoints = {
  sm: '640px',   // Mobile large
  md: '768px',   // Tablet
  lg: '1024px',  // Desktop
  xl: '1280px',  // Large desktop
}
```

**Layout Changes**:

**Mobile (<768px)**:
- Single column grid
- Bottom navigation bar
- Floating Action Button per "Add Food"
- Drawer per filtri
- Swipe gestures enabled

**Tablet (768-1024px)**:
- 2 column grid
- Side drawer navigation
- FAB o top bar "Add Food"

**Desktop (>1024px)**:
- 3-4 column grid
- Persistent sidebar
- Inline filters
- Mouse hover effects

---

## 🚀 Post-MVP Features (Fase 3-4)

### F5: Scansione Barcode

Vedi [BARCODE_INTEGRATION.md](BARCODE_INTEGRATION.md) per dettagli completi.

**Quick Summary**:
- Scansiona barcode EAN-13
- Query Open Food Facts
- Pre-compila form con dati prodotto
- Fallback a inserimento manuale

---

### F6: Swipe Gestures

#### F6.1 - Swipe to Edit

**User Story**: Come utente mobile, voglio swipare a sinistra per modificare rapidamente un alimento.

**Implementation**:
```typescript
<Swipeable
  onSwipedLeft={() => handleEdit(food.id)}
  trackMouse={false} // Solo touch
>
  <FoodCard food={food} />
</Swipeable>

// Visual feedback durante swipe:
// - Card si sposta a sinistra
// - Rivela icona "Edit" con background verde
// - Haptic feedback (se supportato)
```

#### F6.2 - Swipe to Delete

**User Story**: Come utente mobile, voglio swipare a destra per eliminare un alimento consumato.

**Implementation**:
```typescript
<Swipeable
  onSwipedRight={() => handleDeletePrompt(food.id)}
  trackMouse={false}
>
  <FoodCard food={food} />
</Swipeable>

// Visual feedback:
// - Card si sposta a destra
// - Rivela icona "Delete" con background rosso
// - Haptic feedback
```

**Settings**:
- Toggle per abilitare/disabilitare swipe
- Inversione direzioni (left=delete, right=edit)

---

### F7: Vista Calendario

#### F7.1 - Vista Settimanale

**User Story**: Come utente, voglio vedere quali alimenti scadono questa settimana per pianificare i pasti.

**Layout**:
```typescript
<WeekView>
  {daysOfWeek.map(day => (
    <DayColumn key={day}>
      <DayHeader>{day}</DayHeader>
      {getFoodsExpiringOn(day).map(food => (
        <FoodBadge food={food} compact />
      ))}
    </DayColumn>
  ))}
</WeekView>

// Features:
- Scroll orizzontale su mobile
- Click su alimento → apri dettagli
- Codice colore per categoria
- Badge "Oggi" evidenziato
```

#### F7.2 - Vista Mensile

**User Story**: Come utente, voglio una vista mensile per vedere le scadenze a lungo termine.

**Layout**:
```typescript
<MonthView>
  <MonthHeader>
    <Button onClick={previousMonth}>←</Button>
    <h2>{currentMonth} {currentYear}</h2>
    <Button onClick={nextMonth}>→</Button>
  </MonthHeader>
  
  <CalendarGrid>
    {daysInMonth.map(day => (
      <DayCell key={day}>
        <DayNumber>{day}</DayNumber>
        <FoodCount count={getFoodsCount(day)} />
      </DayCell>
    ))}
  </CalendarGrid>
</MonthView>

// Features:
- Heatmap: colore più intenso = più scadenze
- Click su giorno → mostra lista alimenti
- "Torna a oggi" quick action
```

---

### F8: Notifiche

#### F8.1 - Browser Push Notifications

**User Story**: Come utente, voglio ricevere notifiche quando un alimento sta per scadere per non dimenticarmene.

**Permission Flow**:
```typescript
// Richiedi permesso al primo login
const requestNotificationPermission = async () => {
  if ('Notification' in window) {
    const permission = await Notification.requestPermission()
    if (permission === 'granted') {
      // Subscribe to push notifications
      await subscribeUserToPush()
    }
  }
}
```

**Notification Types**:

**1. Scadenza Imminente (3 giorni prima)**:
```typescript
{
  title: '🍕 Pizza presto in scadenza',
  body: 'Scade tra 3 giorni',
  icon: '/icons/icon-192.png',
  badge: '/icons/badge.png',
  data: { foodId: '123', action: 'view' },
  actions: [
    { action: 'view', title: 'Vedi' },
    { action: 'dismiss', title: 'OK' }
  ]
}
```

**2. Scadenza Oggi**:
```typescript
{
  title: '⚠️ Latte scade oggi!',
  body: 'Consumalo presto o lo perderai',
  tag: 'expiry-today',
  renotify: false
}
```

**3. Riepilogo Settimanale (Domenica sera)**:
```typescript
{
  title: '📊 Riepilogo Settimanale',
  body: 'Hai 5 alimenti che scadono questa settimana',
  actions: [
    { action: 'calendar', title: 'Vedi Calendario' }
  ]
}
```

**Settings**:
```typescript
<NotificationSettings>
  <Toggle name="enableNotifications" />
  <Select name="daysBeforeExpiry" options={[1,2,3,5,7]} />
  <TimeInput name="notificationTime" defaultValue="18:00" />
  <Toggle name="weeklyDigest" />
</NotificationSettings>
```

---

### F9: Condivisione Liste

**⚠️ NOTA: Per dettagli implementativi completi, vedi [SHORT_CODE_INVITES_PLAN.md](../SHORT_CODE_INVITES_PLAN.md)**

#### F9.1 - Invita Utente (Sistema Codici Brevi)

**User Story**: Come utente, voglio condividere la mia lista con mio marito/moglie/coinquilino in modo facile e veloce, specialmente da mobile.

**Approccio**: Codici brevi 6 caratteri (es: `ABC123`) tipo Discord/Zoom/Airbnb

**Implementation**:
```typescript
<InviteDialog>
  {/* Step 1: Genera codice */}
  <Button onClick={generateCode}>
    Genera codice invito
  </Button>

  {/* Step 2: Mostra codice generato */}
  {inviteCode && (
    <>
      <CodeDisplay>{inviteCode}</CodeDisplay>
      <ButtonGroup>
        <Button onClick={copyCode}>
          <Copy /> Copia
        </Button>
        <Button onClick={shareCode}>
          <Share2 /> Condividi
        </Button>
      </ButtonGroup>

      {/* Istruzioni */}
      <Instructions>
        Condividi questo codice via WhatsApp, Telegram,
        SMS o qualsiasi app. Il destinatario potrà usarlo
        visitando: /join/{inviteCode}
      </Instructions>
    </>
  )}
</InviteDialog>

// Features chiave:
// - NO form email
// - Codice 6 caratteri alfanumerici maiuscoli
// - Web Share API per condivisione nativa mobile
// - URL breve: /join/ABC123
// - Scadenza: 7 giorni
// - Completamente anonimo (chiunque con codice può usarlo)
```

**Backend - Edge Functions**:
```typescript
// create-invite: Genera short_code (6 char)
// validate-invite: Verifica code + scadenza (NO email check)
// accept-invite: Aggiunge user alla lista (NO email match)

// Semplificazioni:
// - NO email parameter
// - NO email prefill in signup
// - NO email sending (zero costi ricorrenti)
```

#### F9.2 - Real-time Updates

**User Story**: Come utente in una lista condivisa, voglio vedere gli aggiornamenti in tempo reale.

**Implementation**:
```typescript
// Supabase Realtime subscription
useEffect(() => {
  const channel = supabase
    .channel('foods')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'foods',
      filter: `user_id=eq.${userId}`
    }, (payload) => {
      // Update local state
      handleRealtimeUpdate(payload)
    })
    .subscribe()

  return () => channel.unsubscribe()
}, [userId])
```

**Visual Feedback**:
- Toast: "Mario ha aggiunto Latte"
- Badge "New" su nuovi items
- Avatar dell'utente che ha fatto modifica

---

### F10: Statistiche e Analytics

#### F10.1 - Dashboard Statistiche

**User Story**: Come utente, voglio vedere statistiche sui miei sprechi per migliorare.

**Metrics**:

**1. Waste Reduction**:
```typescript
<StatCard>
  <StatLabel>Cibo Salvato</StatLabel>
  <StatValue>95%</StatValue>
  <StatTrend>+12% vs mese scorso</StatTrend>
</StatCard>
```

**2. Most Wasted Categories**:
```typescript
<BarChart
  data={wasteByCategory}
  xAxis="category"
  yAxis="count"
/>
```

**3. Economic Impact**:
```typescript
<StatCard>
  <StatLabel>Risparmio Stimato</StatLabel>
  <StatValue>€47</StatValue>
  <StatDescription>Basato su prezzo medio alimenti</StatDescription>
</StatCard>
```

**4. Monthly Trends**:
```typescript
<LineChart
  data={monthlyData}
  lines={[
    { key: 'added', label: 'Alimenti aggiunti', color: 'blue' },
    { key: 'consumed', label: 'Consumati', color: 'green' },
    { key: 'wasted', label: 'Buttati', color: 'red' }
  ]}
/>
```

---

## 🎨 UI/UX Features

### F11: Theming

#### Dark Mode
```typescript
<ThemeProvider defaultTheme="system">
  {/* App automatically switches based on system preference */}
</ThemeProvider>

// Settings
<RadioGroup name="theme">
  <Radio value="light">Chiaro</Radio>
  <Radio value="dark">Scuro</Radio>
  <Radio value="system">Auto (Sistema)</Radio>
</RadioGroup>
```

#### Custom Accents (Future)
- Scegli colore accent principale
- Applica a bottoni, badge, highlights

---

### F12: Accessibility

**Features**:
- ✅ Keyboard navigation completa
- ✅ Screen reader support (ARIA labels)
- ✅ Focus indicators visibili
- ✅ Color contrast WCAG AA
- ✅ Text resizing fino a 200%
- ✅ Reduced motion support

```typescript
// Rispetta prefers-reduced-motion
const prefersReducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
).matches

const animation = prefersReducedMotion 
  ? { duration: 0 } 
  : { duration: 300, ease: 'easeInOut' }
```

---

## 🔮 Future Ideas

### Advanced Features (Fase 5+)

1. **OCR per Date Stampate**
   - Fotografa la data di scadenza
   - Riconoscimento automatico con Tesseract.js

2. **Recipe Suggestions**
   - AI suggerisce ricette basate su alimenti in scadenza
   - Integrazione con API ricette

3. **Shopping List Generation**
   - Genera lista spesa da alimenti terminati
   - Export/Integrazione con app spesa

4. **Voice Input**
   - "Aggiungi latte che scade dopodomani"
   - Web Speech API

5. **Barcode per Prodotti Sfusi**
   - Genera QR code personalizzati
   - Per prodotti senza barcode

6. **Gamification**
   - Badge per achievements
   - Streak per giorni senza sprechi
   - Leaderboard tra amici

7. **Integration con Smart Home**
   - API per frigo smart
   - Alexa/Google Home skill

---

**Next**: Vedi [BARCODE_INTEGRATION.md](BARCODE_INTEGRATION.md) per dettagli sulla scansione barcode.
