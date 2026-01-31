import { useState } from 'react'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../ui/button'
import { exportUserData } from '../../lib/dataExport'

/**
 * Data Export Button Component
 * GDPR Article 20 - Right to Data Portability
 *
 * Allows users to export all their data as JSON
 */
export function DataExportButton() {
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)

    try {
      const { success, error } = await exportUserData()

      if (success) {
        toast.success('Dati esportati con successo!', {
          description: 'Il file JSON è stato scaricato sul tuo dispositivo.',
        })
      } else {
        throw error || new Error('Esportazione fallita')
      }
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Errore durante l\'esportazione', {
        description:
          error instanceof Error
            ? error.message
            : 'Si è verificato un errore durante l\'esportazione dei dati.',
      })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Button
      onClick={handleExport}
      disabled={isExporting}
      variant="outline"
      className="w-full"
    >
      <Download className="mr-2 h-4 w-4" />
      {isExporting ? 'Esportazione...' : 'Esporta i Miei Dati'}
    </Button>
  )
}
