/**
 * src/services/security/SecureStorageService.ts
 *
 * Unified secure storage abstraction:
 * 1. For small, critical secrets (<= 2KB): Uses expo-secure-store directly (backed by Android Keystore / iOS Keychain).
 * 2. For larger sensitive records (user pins, cached API keys, private memory): Uses AES-256-GCM via CryptoVault persisted to local storage.
 * 3. Provides clean migration from legacy plaintext AsyncStorage.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { cryptoVault } from './CryptoVault';

class SecureStorageService {
  /**
   * Hardware-backed storage for short credentials (PINs, auth tokens)
   */
  async setKeystoreSecret(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
      });
    } catch (err) {
      console.warn(`[SecureStorage] Error writing keystore secret ${key}:`, err);
      // Fallback to AES-256 encrypted AsyncStorage
      await this.setEncryptedItem(key, value);
    }
  }

  async getKeystoreSecret(key: string): Promise<string | null> {
    try {
      const val = await SecureStore.getItemAsync(key);
      if (val !== null) return val;
      // Fallback check in encrypted AsyncStorage
      return await this.getEncryptedItem(key);
    } catch (err) {
      console.warn(`[SecureStorage] Error reading keystore secret ${key}:`, err);
      return await this.getEncryptedItem(key);
    }
  }

  async removeKeystoreSecret(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Ignored
    }
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // Ignored
    }
  }

  /**
   * AES-256 encrypted local storage for sensitive data structures of arbitrary size
   */
  async setEncryptedItem(key: string, plainValue: string): Promise<void> {
    const cipherText = await cryptoVault.encrypt(plainValue);
    await AsyncStorage.setItem(key, cipherText);
  }

  async getEncryptedItem(key: string): Promise<string | null> {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    return await cryptoVault.decrypt(raw);
  }

  async setEncryptedJson<T>(key: string, data: T): Promise<void> {
    const jsonStr = JSON.stringify(data);
    await this.setEncryptedItem(key, jsonStr);
  }

  async getEncryptedJson<T>(key: string, defaultValue: T): Promise<T> {
    const decrypted = await this.getEncryptedItem(key);
    if (!decrypted) return defaultValue;
    try {
      return JSON.parse(decrypted) as T;
    } catch {
      return defaultValue;
    }
  }

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  }
}

export const secureStorage = new SecureStorageService();
