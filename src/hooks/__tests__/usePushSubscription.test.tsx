// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { renderHook, waitFor, cleanup } from '@testing-library/react'

const {
  mockSupported, mockIOS, mockPWA, mockPermission,
  mockGetCurrent, mockSubscribe, mockUnsubscribe, mockSync,
} = vi.hoisted(() => ({
  mockSupported: vi.fn(),
  mockIOS: vi.fn(),
  mockPWA: vi.fn(),
  mockPermission: vi.fn(),
  mockGetCurrent: vi.fn(),
  mockSubscribe: vi.fn(),
  mockUnsubscribe: vi.fn(),
  mockSync: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))
vi.mock('@/lib/pushNotifications', () => ({
  isPushSupported: () => mockSupported(),
  isPWAInstalled: () => mockPWA(),
  isIOS: () => mockIOS(),
  getPermissionState: () => mockPermission(),
  getCurrentSubscription: () => mockGetCurrent(),
  subscribeToPush: () => mockSubscribe(),
  unsubscribeFromPush: () => mockUnsubscribe(),
  syncSubscription: () => mockSync(),
}))

import { usePushSubscription } from '../usePushSubscription'

beforeEach(() => {
  mockSupported.mockReturnValue(true)
  mockIOS.mockReturnValue(false)
  mockPWA.mockReturnValue(true)
  mockPermission.mockReturnValue('granted')
  mockGetCurrent.mockResolvedValue(null)
  mockSubscribe.mockResolvedValue({ success: true })
  mockUnsubscribe.mockResolvedValue({ success: true })
  mockSync.mockResolvedValue(undefined)
})

afterEach(cleanup)

describe('usePushSubscription — recupero subscription persa', () => {
  it("segnala status 'lost' quando il permesso è granted ma la subscription è sparita", async () => {
    // iOS invalida la subscription senza emettere pushsubscriptionchange:
    // il permesso resta granted, ma getCurrentSubscription() ritorna null.
    const { result } = renderHook(() => usePushSubscription())

    await waitFor(() => expect(result.current.status).toBe('lost'))
  })

  it("resta 'subscribed' e ri-sincronizza quando esiste una subscription attiva", async () => {
    mockGetCurrent.mockResolvedValue({ endpoint: 'https://web.push.apple.com/abc' })

    const { result } = renderHook(() => usePushSubscription())

    await waitFor(() => expect(mockSync).toHaveBeenCalledTimes(1))
    expect(result.current.status).toBe('subscribed')
  })
})
