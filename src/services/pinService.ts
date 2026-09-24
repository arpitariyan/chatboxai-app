import AsyncStorage from '@react-native-async-storage/async-storage';

type PinListener = (pinnedIds: string[]) => void;

class PinService {
  private listeners: Set<PinListener> = new Set();
  private cache: Map<string, string[]> = new Map();

  private getStorageKey(userEmail: string): string {
    const cleanEmail = (userEmail || 'anonymous').trim().toLowerCase();
    return `@chatboxai:pinned_conversations:${cleanEmail}`;
  }

  /**
   * Get all pinned conversation IDs for a user
   */
  async getPinnedIds(userEmail: string): Promise<string[]> {
    if (!userEmail) return [];
    const key = this.getStorageKey(userEmail);

    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    try {
      const stored = await AsyncStorage.getItem(key);
      const ids: string[] = stored ? JSON.parse(stored) : [];
      this.cache.set(key, ids);
      return ids;
    } catch (err) {
      console.warn('[PinService] Error reading pinned IDs:', err);
      return [];
    }
  }

  /**
   * Check if a specific conversation is pinned
   */
  async isPinned(libId: string, userEmail: string): Promise<boolean> {
    if (!libId || !userEmail) return false;
    const pinned = await this.getPinnedIds(userEmail);
    return pinned.includes(libId);
  }

  /**
   * Toggle pinned state of a conversation
   * @returns new isPinned state
   */
  async togglePin(libId: string, userEmail: string): Promise<boolean> {
    if (!libId || !userEmail) return false;
    const key = this.getStorageKey(userEmail);
    const current = await this.getPinnedIds(userEmail);

    let updated: string[];
    let nowPinned: boolean;

    if (current.includes(libId)) {
      updated = current.filter((id) => id !== libId);
      nowPinned = false;
    } else {
      updated = [libId, ...current];
      nowPinned = true;
    }

    this.cache.set(key, updated);
    try {
      await AsyncStorage.setItem(key, JSON.stringify(updated));
    } catch (err) {
      console.warn('[PinService] Error writing pinned IDs:', err);
    }

    this.notify(updated);
    return nowPinned;
  }

  /**
   * Unpin a conversation (e.g. on delete)
   */
  async unpin(libId: string, userEmail: string): Promise<void> {
    if (!libId || !userEmail) return;
    const key = this.getStorageKey(userEmail);
    const current = await this.getPinnedIds(userEmail);

    if (!current.includes(libId)) return;

    const updated = current.filter((id) => id !== libId);
    this.cache.set(key, updated);

    try {
      await AsyncStorage.setItem(key, JSON.stringify(updated));
    } catch (err) {
      console.warn('[PinService] Error unpinning conversation:', err);
    }

    this.notify(updated);
  }

  /**
   * Subscribe to pin changes
   */
  addListener(listener: PinListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(pinnedIds: string[]) {
    this.listeners.forEach((fn) => {
      try {
        fn(pinnedIds);
      } catch (e) {
        console.warn('[PinService] Listener error:', e);
      }
    });
  }
}

export const pinService = new PinService();
