import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { LogOut, User } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { AppIcon } from '../ui/AppIcon'
import { ThemeToggle } from './ThemeToggle'
import { InviteButton } from '../sharing/InviteButton'
import { InviteDialog } from '../sharing/InviteDialog'
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
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)

  const handleLogout = async () => {
    const result = await signOut()
    if (result.success) {
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
          <div className="flex items-center gap-2">
            <AppIcon size={40} className="rounded-lg" aria-label="Logo entro" />
            <div>
              <div className="text-lg font-bold text-foreground">entro</div>
              <p className="text-xs text-muted-foreground">Food Expiry Tracker</p>
            </div>
          </div>

          {/* Actions - Navigation landmark */}
          <nav aria-label="Menu principale" className="flex items-center gap-2">
            <ThemeToggle />

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-10 w-10 rounded-full p-0"
                  aria-label="Menu utente"
                >
                  <User className="!h-7 !w-7 text-primary" />
                </Button>
              </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {user?.user_metadata?.full_name || 'Il mio account'}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email || 'Utente'}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <InviteButton onClick={() => setInviteDialogOpen(true)} />
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="cursor-pointer text-red-600 focus:text-red-600"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Disconnetti</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
            </DropdownMenu>
          </nav>
        </div>
      </header>

      {/* Invite Dialog */}
      <InviteDialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen} />

      {/* Main Content */}
      <main id="main-content" className="container mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
