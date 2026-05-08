// ============================================================
// Manthan Studio — Encrypted API Key Store
// Uses electron safeStorage for OS-level encryption
// ============================================================

import { safeStorage } from 'electron'
import { JsonStore } from './json-store'
import { KEY_GROUPS, PROVIDER_GROUP_MAPPING } from '../../shared/model-registry'
import { logger } from '../logger'

interface KeyStoreSchema extends Record<string, unknown> {
  apiKeys: Record<string, string>
  groupKeys: Record<string, string>
  activeProvider: string | null
  backupOAuth: {
    refreshToken: string | null
    accountEmail: string | null
    folderId: string | null
  }
}

const store = new JsonStore<KeyStoreSchema>('manthan-keys', {
  apiKeys: {},
  groupKeys: {},
  activeProvider: null,
  backupOAuth: {
    refreshToken: null,
    accountEmail: null,
    folderId: null
  }
})

function encodeKey(apiKey: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    return Buffer.from(apiKey).toString('base64')
  }

  const encrypted = safeStorage.encryptString(apiKey)
  return encrypted.toString('base64')
}

function decodeKey(encoded: string): string | null {
  if (!safeStorage.isEncryptionAvailable()) {
    return Buffer.from(encoded, 'base64').toString('utf-8')
  }

  try {
    const buffer = Buffer.from(encoded, 'base64')
    return safeStorage.decryptString(buffer)
  } catch {
    return null
  }
}

export const keyStore = {
  saveApiKey(provider: string, apiKey: string): void {
    const group = PROVIDER_GROUP_MAPPING[provider]
    if (group) {
      this.saveGroupKey(group, apiKey)
      return
    }

    const keys = store.get('apiKeys')
    keys[provider] = encodeKey(apiKey)
    store.set('apiKeys', keys)
    logger.info('App', `API key saved for provider: ${provider}`)
  },

  getApiKey(provider: string): string | null {
    const group = PROVIDER_GROUP_MAPPING[provider]
    if (group) {
      const groupKey = this.getGroupKey(group)
      if (groupKey) return groupKey
    }

    const keys = store.get('apiKeys')
    const encoded = keys[provider]
    if (!encoded) return null

    return decodeKey(encoded)
  },

  removeApiKey(provider: string): void {
    const keys = store.get('apiKeys')
    delete keys[provider]
    store.set('apiKeys', keys)
    logger.info('App', `API key removed for provider: ${provider}`)
  },

  hasApiKey(provider: string): boolean {
    const group = PROVIDER_GROUP_MAPPING[provider]
    if (group && this.hasGroupKey(group)) return true

    const keys = store.get('apiKeys')
    return !!keys[provider]
  },

  getAllProviderIds(): string[] {
    return Object.keys(store.get('apiKeys'))
  },

  saveGroupKey(group: string, apiKey: string): void {
    const groupKeys = store.get('groupKeys')
    groupKeys[group] = encodeKey(apiKey)
    store.set('groupKeys', groupKeys)

    // Keep provider slots warm for legacy reads and older code paths.
    const matchingProviders = KEY_GROUPS.find((entry) => entry.id === group)?.providerIds ?? []
    const keys = store.get('apiKeys')
    matchingProviders.forEach((providerId) => {
      keys[providerId] = groupKeys[group]
    })
    store.set('apiKeys', keys)
    logger.info('App', `API key saved for group: ${group}`)
  },

  getGroupKey(group: string): string | null {
    const groupKeys = store.get('groupKeys')
    const encoded = groupKeys[group]
    if (encoded) {
      return decodeKey(encoded)
    }

    // Backward-compatible migration path: hydrate the group key from any stored provider key.
    const matchingProviders = KEY_GROUPS.find((entry) => entry.id === group)?.providerIds ?? []
    for (const providerId of matchingProviders) {
      const providerKey = this.getApiKeyFromProviderSlot(providerId)
      if (providerKey) {
        this.saveGroupKey(group, providerKey)
        return providerKey
      }
    }

    return null
  },

  getApiKeyFromProviderSlot(provider: string): string | null {
    const keys = store.get('apiKeys')
    const encoded = keys[provider]
    if (!encoded) return null
    return decodeKey(encoded)
  },

  removeGroupKey(group: string): void {
    const groupKeys = store.get('groupKeys')
    delete groupKeys[group]
    store.set('groupKeys', groupKeys)
    logger.info('App', `API key removed for group: ${group}`)
  },

  hasGroupKey(group: string): boolean {
    const groupKeys = store.get('groupKeys')
    return !!groupKeys[group]
  },

  getStoredGroupIds(): string[] {
    return Object.keys(store.get('groupKeys'))
  },

  getProviderGroupMapping(): Record<string, string> {
    return { ...PROVIDER_GROUP_MAPPING }
  },

  setActiveProvider(provider: string | null): void {
    store.set('activeProvider', provider)
    logger.info('App', `Active provider changed to: ${provider}`)
  },

  getActiveProvider(): string | null {
    return store.get('activeProvider')
  },

  saveGoogleDriveCredentials(credentials: {
    refreshToken: string
    accountEmail?: string | null
    folderId?: string | null
  }): void {
    const current = store.get('backupOAuth')
    store.set('backupOAuth', {
      refreshToken: encodeKey(credentials.refreshToken),
      accountEmail: credentials.accountEmail ?? current.accountEmail ?? null,
      folderId: credentials.folderId ?? current.folderId ?? null
    })
    logger.info('App', 'Google Drive backup credentials saved')
  },

  getGoogleDriveRefreshToken(): string | null {
    const encoded = store.get('backupOAuth')?.refreshToken
    if (!encoded) return null
    return decodeKey(encoded)
  },

  getGoogleDriveAccountEmail(): string | null {
    return store.get('backupOAuth')?.accountEmail ?? null
  },

  getGoogleDriveFolderId(): string | null {
    return store.get('backupOAuth')?.folderId ?? null
  },

  setGoogleDriveFolderId(folderId: string | null): void {
    const current = store.get('backupOAuth')
    store.set('backupOAuth', {
      ...current,
      folderId
    })
  },

  clearGoogleDriveCredentials(): void {
    store.set('backupOAuth', {
      refreshToken: null,
      accountEmail: null,
      folderId: null
    })
    logger.info('App', 'Google Drive backup credentials removed')
  }
}
