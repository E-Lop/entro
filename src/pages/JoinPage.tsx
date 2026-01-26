import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { AcceptInviteDialog } from '../components/sharing/AcceptInviteDialog'
import { PageLoader } from '../components/ui/PageLoader'

/**
 * Join Page - Handles invite acceptance via /join/:code URL
 * - If user is not authenticated: redirect to signup with code
 * - If user is authenticated: show AcceptInviteDialog
 */
export default function JoinPage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { user, loading } = useAuth()
  const [showDialog, setShowDialog] = useState(false)

  useEffect(() => {
    // Invalid code - redirect to signup
    if (!code) {
      navigate('/signup', { replace: true })
      return
    }

    // Wait for auth to load
    if (loading) {
      return
    }

    // Not authenticated - redirect to signup with code
    if (!user) {
      navigate(`/signup?code=${code.toUpperCase()}`, { replace: true })
      return
    }

    // Authenticated - show dialog
    setShowDialog(true)
  }, [code, user, loading, navigate])

  const handleSuccess = () => {
    // After successful acceptance, navigate to dashboard
    navigate('/', { replace: true })
  }

  const handleClose = () => {
    // If user closes dialog, navigate to dashboard
    navigate('/', { replace: true })
  }

  // Show loading while determining auth state
  if (loading || !showDialog) {
    return <PageLoader />
  }

  return (
    <AcceptInviteDialog
      open={showDialog}
      onOpenChange={(open) => {
        if (!open) {
          handleClose()
        }
      }}
      shortCode={code!.toUpperCase()}
      onSuccess={handleSuccess}
    />
  )
}
