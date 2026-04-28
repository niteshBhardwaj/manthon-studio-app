// ============================================================
// Manthan Studio — Encrypted API Key Store
// Uses electron safeStorage for OS-level encryption
// ============================================================

import { safeStorage } from 'electron'
import { JsonStore } from './json-store'

interface KeyStoreSchema {
  apiKeys: Record<string, string>
  activeProvider: string | null
}

const store = new JsonStore<KeyStoreSchema>('manthan-keys', {
  apiKeys: {},
  activeProvider: null
})

export const keyStore = {
  saveApiKey(provider: string, apiKey: string): void {
    const keys = store.get('apiKeys')

    if (!safeStorage.isEncryptionAvailable()) {
      keys[provider] = Buffer.from(apiKey).toString('base64')
    } else {
      const encrypted = safeStorage.encryptString(apiKey)
      keys[provider] = encrypted.toString('base64')
    }

    store.set('apiKeys', keys)
  },

  getApiKey(provider: string): string | null {
    const keys = store.get('apiKeys')
    const encoded = keys[provider]
    if (!encoded) return null

    if (!safeStorage.isEncryptionAvailable()) {
      return Buffer.from(encoded, 'base64').toString('utf-8')
    }

    try {
      const buffer = Buffer.from(encoded, 'base64')
      return safeStorage.decryptString(buffer)
    } catch {
      return null
    }
  },

  removeApiKey(provider: string): void {
    const keys = store.get('apiKeys')
    delete keys[provider]
    store.set('apiKeys', keys)
  },

  hasApiKey(provider: string): boolean {
    const keys = store.get('apiKeys')
    return !!keys[provider]
  },

  getAllProviderIds(): string[] {
    return Object.keys(store.get('apiKeys'))
  },

  setActiveProvider(provider: string | null): void {
    store.set('activeProvider', provider)
  },

  getActiveProvider(): string | null {
    return store.get('activeProvider')
  }
}
