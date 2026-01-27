/**
 * Utility helpers for Realtime synchronization
 * - Deduplication tracking
 * - Channel naming
 * - Throttle/debounce utilities
 */

// Deduplication window: 2 seconds
const DEDUP_WINDOW_MS = 2000;

/**
 * Tracks recent mutations to prevent duplicate updates from realtime events
 */
export class RecentMutationsTracker {
  private mutations = new Map<string, number>();
  private cleanupIntervalId?: ReturnType<typeof setInterval>;

  constructor(private windowMs: number = DEDUP_WINDOW_MS) {
    // Setup periodic cleanup to prevent memory leaks
    this.startCleanup();
  }

  /**
   * Track a mutation
   */
  track(id: string, type: 'INSERT' | 'UPDATE' | 'DELETE'): void {
    const key = this.getMutationKey(id, type);
    this.mutations.set(key, Date.now());
  }

  /**
   * Check if a mutation was recently tracked
   */
  wasRecentlyMutated(
    id: string,
    type: 'INSERT' | 'UPDATE' | 'DELETE',
  ): boolean {
    const key = this.getMutationKey(id, type);
    const timestamp = this.mutations.get(key);

    if (!timestamp) return false;

    const age = Date.now() - timestamp;
    return age < this.windowMs;
  }

  /**
   * Clear all tracked mutations
   */
  clear(): void {
    this.mutations.clear();
  }

  /**
   * Stop cleanup interval (call on unmount)
   */
  destroy(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
    }
    this.clear();
  }

  private getMutationKey(id: string, type: string): string {
    return `${type}:${id}`;
  }

  private startCleanup(): void {
    // Run cleanup every 5 seconds
    this.cleanupIntervalId = setInterval(() => {
      const now = Date.now();
      const toDelete: string[] = [];

      this.mutations.forEach((timestamp, key) => {
        if (now - timestamp > this.windowMs) {
          toDelete.push(key);
        }
      });

      toDelete.forEach((key) => this.mutations.delete(key));
    }, 5000);
  }
}

/**
 * Generate channel name for a table and list
 */
export function getChannelName(table: string, listId: string): string {
  return `${table}-${listId}`;
}

/**
 * Throttle function - execute at most once per interval
 */
export function throttle<T extends (...args: any[]) => void>(
  func: T,
  limitMs: number,
): (...args: Parameters<T>) => void {
  let lastRan = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function (this: any, ...args: Parameters<T>) {
    const now = Date.now();

    if (now - lastRan >= limitMs) {
      func.apply(this, args);
      lastRan = now;
    } else {
      // Schedule to run after the limit
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(
        () => {
          func.apply(this, args);
          lastRan = Date.now();
        },
        limitMs - (now - lastRan),
      );
    }
  };
}

/**
 * Debounce function - execute after delay of inactivity
 */
export function debounce<T extends (...args: any[]) => void>(
  func: T,
  delayMs: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function (this: any, ...args: Parameters<T>) {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delayMs);
  };
}
