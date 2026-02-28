import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CircleHelp,
  Plus,
  ArrowLeftRight,
  Palette,
  Search,
  Calendar,
  Users,
  Bell,
  Download,
} from 'lucide-react'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog'

const guideItems = [
  {
    icon: Plus,
    title: 'Aggiungi alimenti',
    description: 'Premi "+ Alimento" per inserire manualmente o scansionare un barcode',
  },
  {
    icon: ArrowLeftRight,
    title: 'Modifica ed elimina',
    description: 'Swipe dx per modificare, sx per eliminare (su desktop usa i pulsanti)',
  },
  {
    icon: Palette,
    title: 'Colori scadenza',
    description: 'Verde (7+ gg), Giallo (4-7), Arancione (1-3), Rosso (scaduto)',
  },
  {
    icon: Search,
    title: 'Filtri e ricerca',
    description: 'Filtra per categoria, posizione o stato. Tocca le statistiche per filtri rapidi',
  },
  {
    icon: Calendar,
    title: 'Vista calendario',
    description: 'Passa alla vista settimanale per vedere le scadenze giorno per giorno',
  },
  {
    icon: Users,
    title: 'Condividi lista',
    description: 'Dal menu utente, genera un codice invito per condividere la lista',
  },
  {
    icon: Bell,
    title: 'Notifiche scadenza',
    description: 'Attivale in Impostazioni per ricevere avvisi quando i tuoi alimenti stanno per scadere. Su iPhone funzionano solo con l\'app installata',
  },
  {
    icon: Download,
    title: 'Installa app',
    description: 'Dal browser, aggiungi entro alla schermata Home per accesso rapido',
  },
]

export function QuickGuideDialog() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="h-10 w-10 p-0" aria-label="Guida rapida">
          <CircleHelp className="!h-7 !w-7" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Guida Rapida</DialogTitle>
          <DialogDescription>Come usare entro in pochi passi</DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 space-y-3 py-2">
          {guideItems.map((item) => (
            <div key={item.title} className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5 rounded-md bg-muted p-2">
                <item.icon className="h-4 w-4 text-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setOpen(false)
              navigate('/guida')
            }}
          >
            Leggi la guida completa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
