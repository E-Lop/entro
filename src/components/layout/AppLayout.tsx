import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Outlet, useNavigate, Link } from 'react-router-dom'
import { LogOut, User, Settings } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { AppIcon } from '../ui/AppIcon'
import { ThemeToggle } from './ThemeToggle'
import { QuickGuideDialog } from '../guide/QuickGuideDialog'
import { InviteMenuItem } from '../sharing/InviteMenuItem'
import { InviteDialog } from '../sharing/InviteDialog'
import { InviteMenuDialog } from '../sharing/InviteMenuDialog'
import { AcceptInviteFlowDialog } from '../sharing/AcceptInviteFlowDialog'
import { LeaveListDialog } from '../sharing/LeaveListDialog'
import { RemoveMemberDialog } from '../sharing/RemoveMemberDialog'
import { WriteErrorAnnouncer } from '../pwa/WriteErrorAnnouncer'
import {
  getUserList,
  getListMembers,
  getRemovableMembers,
  peekRemovalNotice,
  takeRemovalNotice,
  type RemovableMember,
} from '../../lib/invites'
import { logError } from '@/lib/safeLog'
import { queryClient } from '@/lib/queryClient'
import { clearPersistedCache } from '@/lib/queryPersister'
import { clearSignedImageCaches } from '@/lib/signedImageCache'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { Button } from '../ui/button'

/**
 * App Layout Component
 * Provides header with navigation and user menu
 */
export function AppLayout() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [inviteMenuOpen, setInviteMenuOpen] = useState(false)
  const [createInviteOpen, setCreateInviteOpen] = useState(false)
  const [acceptInviteOpen, setAcceptInviteOpen] = useState(false)
  const [leaveListOpen, setLeaveListOpen] = useState(false)
  const [isInSharedList, setIsInSharedList] = useState(false)
  const [removableMembers, setRemovableMembers] = useState<RemovableMember[]>([])
  const [memberToRemove, setMemberToRemove] = useState<RemovableMember | null>(null)

  // Chi può togliere membri li vede nel menu «Inviti»; agli altri il server
  // risponde zero righe (#196). Si rilegge a ogni apertura del menu, perché
  // qualcuno può essere entrato o uscito nel frattempo.
  const loadRemovableMembers = useCallback(async () => {
    const { members } = await getRemovableMembers()
    setRemovableMembers(members)
  }, [])

  // Check if user is in a shared list (>1 member)
  const checkSharedList = useCallback(async () => {
    try {
      const { list } = await getUserList()
      if (!list) return null

      const { members } = await getListMembers(list.id)
      setIsInSharedList(members.length > 1)
      return list.id
    } catch (error) {
      logError('Error checking shared list:', error)
      return null
    }
  }, [])

  useEffect(() => {
    if (!user) return

    void (async () => {
      const listId = await checkSharedList()
      if (!listId) return

      // Chi è stato tolto da una lista lo scopre qui, una volta sola:
      // l'avviso resta finché non lo chiude (#196).
      if (await takeRemovalNotice(user.id, listId)) {
        // Le foto di quella lista non sono più sue da vedere, e la cache del
        // service worker le servirebbe senza chiedere al server (#213).
        clearSignedImageCaches().catch(() => {})
        toast.info('Non fai più parte della lista condivisa. I tuoi alimenti sono rimasti lì.', {
          duration: Infinity,
          closeButton: true,
        })
      }
    })()
  }, [user, checkSharedList])

  // Chi viene tolto con l'app aperta lo scopre tornando in primo piano (#196,
  // deciso l'8 ott 2026: niente realtime). A schermo c'è ancora la lista di
  // prima, quindi si riparte da capo: ciò che il dispositivo tiene di quella
  // lista sparisce, e l'avviso lo mostra l'apertura qui sopra. Chi nel
  // frattempo è rientrato nella stessa lista non ha niente da ricaricare.
  useEffect(() => {
    if (!user) return

    const onVisible = async () => {
      if (document.visibilityState !== 'visible') return
      const notice = await peekRemovalNotice()
      if (!notice) return

      const listId = await checkSharedList()
      if (listId && listId === notice.listId) {
        await takeRemovalNotice(user.id, listId)
        return
      }

      queryClient.clear()
      await clearPersistedCache().catch(() => {})
      await clearSignedImageCaches().catch(() => {})
      window.location.reload()
    }

    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [user, checkSharedList])

  useEffect(() => {
    if (user && inviteMenuOpen) void loadRemovableMembers()
  }, [user, inviteMenuOpen, loadRemovableMembers])

  const handleLogout = async () => {
    const result = await signOut()

    // Il discriminante è la pulizia locale, non la risposta di Supabase: se i
    // token sono spariti da questo browser l'utente **è** uscito da qui, anche
    // quando il server ha rifiutato. supabase-js in quel caso non emette
    // `SIGNED_OUT`, quindi senza questa navigazione resterebbe sulla dashboard
    // a guardare i dati di una sessione che non esiste più. Se invece la
    // pulizia è fallita — storage bloccato dal browser — i token possono essere
    // ancora lì e mandarlo al login mentirebbe sullo stato del dispositivo.
    if (result.localSessionCleared) {
      navigate('/login', { replace: true })
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Skip to main content link - for keyboard navigation */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:shadow-lg"
      >
        Vai al contenuto principale
      </a>

      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          {/* Logo / Brand */}
          <Link to="/" className="flex items-center gap-inner hover:opacity-80 transition-opacity">
            <AppIcon size={40} className="rounded-lg" />
            <div>
              <div className="text-lg font-bold text-foreground">entro</div>
              <p className="text-xs text-muted-foreground">Scadenze sotto controllo</p>
            </div>
          </Link>

          {/* Actions - Navigation landmark */}
          <nav aria-label="Menu principale" className="flex items-center gap-siblings">
            <QuickGuideDialog />
            <ThemeToggle />

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-11 w-11 rounded-full p-0"
                  aria-label="Menu utente"
                >
                  <User className="!h-7 !w-7" />
                </Button>
              </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-inner">
                  <p className="text-sm font-medium leading-none">
                    {user?.user_metadata?.full_name || 'Il mio account'}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email || 'Utente'}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <InviteMenuItem onSelect={() => setInviteMenuOpen(true)} />
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => navigate('/settings')}
                className="cursor-pointer"
              >
                <Settings className="mr-2 h-4 w-4" />
                <span>Impostazioni</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Disconnetti</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
            </DropdownMenu>
          </nav>
        </div>
      </header>

      {/* Invite Menu Dialog */}
      <InviteMenuDialog
        open={inviteMenuOpen}
        onOpenChange={setInviteMenuOpen}
        isInSharedList={isInSharedList}
        onCreateInvite={() => setCreateInviteOpen(true)}
        onAcceptInvite={() => setAcceptInviteOpen(true)}
        onLeaveList={() => setLeaveListOpen(true)}
        removableMembers={removableMembers}
        onRemoveMember={setMemberToRemove}
      />

      {/* Create Invite Dialog */}
      <InviteDialog open={createInviteOpen} onOpenChange={setCreateInviteOpen} />

      {/* Accept Invite Flow Dialog */}
      <AcceptInviteFlowDialog open={acceptInviteOpen} onOpenChange={setAcceptInviteOpen} />

      {/* Leave List Dialog */}
      <LeaveListDialog open={leaveListOpen} onOpenChange={setLeaveListOpen} />

      {/* Remove Member Dialog */}
      <RemoveMemberDialog
        member={memberToRemove}
        onOpenChange={(open) => {
          if (!open) setMemberToRemove(null)
        }}
        onRemoved={() => {
          void loadRemovableMembers()
          void checkSharedList()
        }}
      />

      {/* Gli errori di scrittura, per gli screen reader (#121). Qui e non in
          App: si scrive solo nell'area autenticata, e sulle pagine d'accesso
          l'unico alert resta quello del modulo. */}
      <WriteErrorAnnouncer />

      {/* Main Content */}
      <main id="main-content" className="container mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
