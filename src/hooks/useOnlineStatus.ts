/**
 * Re-export useNetworkStatus as useOnlineStatus for backward compatibility.
 * Both hooks provide identical functionality: tracking navigator.onLine status.
 */
export { useNetworkStatus as useOnlineStatus } from './useNetworkStatus'
