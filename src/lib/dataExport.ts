import { getCurrentUser } from './auth'
import { getFoods } from './foods'
import { getUserList, getListMembers } from './invites'
import { getSignedImageUrls } from './storage'
import type { Food } from './foods'

/**
 * Data Export Service - GDPR Article 20 (Right to Data Portability)
 *
 * Exports all user data in a machine-readable JSON format:
 * - User profile (email, name, created_at)
 * - All food items
 * - Shared lists and memberships
 */

export interface ExportData {
  exportDate: string
  user: {
    id: string
    email: string
    fullName: string
    createdAt: string
  }
  foods: Food[]
  lists: {
    listId: string | null
    listName: string | null
    createdBy: string | null
    members: Array<{
      userId: string
      joinedAt: string
    }>
  }
  note: string
}

/**
 * Export all user data to JSON file
 * Returns success/error status
 */
export async function exportUserData(): Promise<{ success: boolean; error: Error | null }> {
  try {
    // 1. Get current user profile
    const user = await getCurrentUser()

    if (!user) {
      throw new Error('Utente non autenticato')
    }

    // 2. Fetch all foods
    const { foods, error: foodsError } = await getFoods()

    if (foodsError) {
      throw new Error(`Errore nel recupero alimenti: ${foodsError.message}`)
    }

    // 3. Generate signed URLs for all images (valid for 24 hours)
    const imagePaths = foods
      .filter((food) => food.image_url)
      .map((food) => food.image_url as string)

    let imageUrlMap = new Map<string, string>()
    if (imagePaths.length > 0) {
      try {
        // Generate signed URLs valid for 24 hours (86400 seconds)
        imageUrlMap = await getSignedImageUrls(imagePaths, 86400)
      } catch (error) {
        console.warn('Failed to generate some signed URLs:', error)
        // Continue with export even if some images fail
      }
    }

    // 4. Replace image paths with signed URLs in foods array
    const foodsWithSignedUrls = foods.map((food) => {
      if (food.image_url && imageUrlMap.has(food.image_url)) {
        return {
          ...food,
          image_url: imageUrlMap.get(food.image_url) || food.image_url,
        }
      }
      return food
    })

    // 5. Fetch lists and memberships
    const listData = {
      listId: null as string | null,
      listName: null as string | null,
      createdBy: null as string | null,
      members: [] as Array<{ userId: string; joinedAt: string }>,
    }

    try {
      const { list } = await getUserList()

      if (list) {
        listData.listId = list.id
        listData.listName = list.name
        listData.createdBy = list.created_by

        const { members } = await getListMembers(list.id)
        listData.members = members.map((m) => ({
          userId: m.user_id,
          joinedAt: m.joined_at,
        }))
      }
    } catch (listError) {
      // If user has no list, continue with empty list data
      console.warn('No list found for user:', listError)
    }

    // 6. Build export data object
    const exportData: ExportData = {
      exportDate: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email || 'N/A',
        fullName: user.user_metadata?.full_name || 'N/A',
        createdAt: user.created_at || 'N/A',
      },
      foods: foodsWithSignedUrls,
      lists: listData,
      note: 'Image signed URLs are valid for 24 hours. Download images before they expire if needed.',
    }

    // 7. Download JSON file
    downloadJSON(exportData, `entro-export-${Date.now()}.json`)

    return { success: true, error: null }
  } catch (error) {
    console.error('Error exporting user data:', error)
    return {
      success: false,
      error: error instanceof Error ? error : new Error('Errore durante l\'esportazione dati'),
    }
  }
}

/**
 * Helper function to download data as JSON file
 */
function downloadJSON(data: ExportData, filename: string): void {
  // Convert to formatted JSON string
  const jsonString = JSON.stringify(data, null, 2)

  // Create Blob
  const blob = new Blob([jsonString], { type: 'application/json' })

  // Create download link
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename

  // Trigger download
  document.body.appendChild(link)
  link.click()

  // Cleanup
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
