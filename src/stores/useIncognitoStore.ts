import { create } from 'zustand';

/**
 * Incognito Chat Store
 *
 * Single source of truth for whether the app is currently in Incognito Mode.
 * When isIncognito is true:
 *  - No conversation is created in Appwrite
 *  - No chat messages are saved to Appwrite
 *  - No chat history is loaded from Appwrite
 *  - The Drawer refresh counter is NOT incremented
 *  - All messages live only in local component state and disappear on session end
 */
interface IncognitoState {
  isIncognito: boolean;
  /** Toggle between incognito and normal mode */
  toggleIncognito: () => void;
  /** Explicitly exit incognito mode (used when starting a fresh normal chat) */
  exitIncognito: () => void;
}

export const useIncognitoStore = create<IncognitoState>((set) => ({
  isIncognito: false,
  toggleIncognito: () => set((s) => ({ isIncognito: !s.isIncognito })),
  exitIncognito: () => set({ isIncognito: false }),
}));
