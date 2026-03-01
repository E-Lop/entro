import { get, set, del, createStore } from 'idb-keyval'
import { compressImage } from './storage'

/**
 * Dedicated IDB store for pending food images (separate from React Query cache).
 * Stores compressed images as ArrayBuffer so they survive page reloads.
 */
const pendingStore = createStore('pending-images', 'images')

const PENDING_PREFIX = 'pending://'

export interface PendingImageData {
  buffer: ArrayBuffer
  type: string
  name: string
}

/** Check whether a URL uses the pending:// protocol. */
export function isPendingUrl(url: string | null | undefined): url is string {
  return !!url?.startsWith(PENDING_PREFIX)
}

/** Extract the UUID from a pending:// URL. */
function extractId(pendingUrl: string): string {
  return pendingUrl.slice(PENDING_PREFIX.length)
}

/**
 * Compress an image File and persist it in IndexedDB.
 * @returns A `pending://{uuid}` identifier to use as `image_url`
 */
export async function savePendingImage(file: File): Promise<string> {
  const compressed = await compressImage(file)
  const buffer = await compressed.arrayBuffer()
  const id = crypto.randomUUID()

  await set(id, { buffer, type: compressed.type, name: compressed.name } satisfies PendingImageData, pendingStore)
  return `${PENDING_PREFIX}${id}`
}

/**
 * Load a pending image's raw data from IndexedDB.
 */
export async function getPendingImage(pendingUrl: string): Promise<PendingImageData> {
  const id = extractId(pendingUrl)
  const data = await get<PendingImageData>(id, pendingStore)
  if (!data) throw new Error(`Pending image not found: ${id}`)
  return data
}

/**
 * Delete a pending image from IndexedDB after successful upload.
 */
export async function deletePendingImage(pendingUrl: string): Promise<void> {
  await del(extractId(pendingUrl), pendingStore)
}

/**
 * Convert a pending image back to a File for upload to Supabase Storage.
 */
export async function pendingImageToFile(pendingUrl: string): Promise<File> {
  const { buffer, type, name } = await getPendingImage(pendingUrl)
  return new File([buffer], name, { type })
}
