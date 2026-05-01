// ============================================================
// Manthan Studio — Provider Registry
// Central registry managing all available AI providers
// ============================================================

import { MediaProvider, ConnectionStatus } from './base'
import { GoogleVeoProvider } from './google-veo'
import { GoogleImagenProvider } from './google-imagen'
import { GoogleLyriaProvider } from './google-lyria'
import { KEY_GROUPS, PROVIDER_GROUP_MAPPING } from '../../shared/model-registry'

class ProviderRegistry {
  private providers: Map<string, MediaProvider> = new Map()
  private activeProviderId: string | null = null

  constructor() {
    // Register built-in providers
    this.register(new GoogleVeoProvider())
    this.register(new GoogleImagenProvider())
    this.register(new GoogleLyriaProvider())
  }

  register(provider: MediaProvider): void {
    this.providers.set(provider.id, provider)
  }

  get(id: string): MediaProvider | undefined {
    return this.providers.get(id)
  }

  getAll(): MediaProvider[] {
    return Array.from(this.providers.values())
  }

  getProviderList(): Array<{
    id: string
    name: string
    icon: string
    modalities: string[]
    initialized: boolean
  }> {
    return this.getAll().map((p) => ({
      id: p.id,
      name: p.name,
      icon: p.icon,
      modalities: p.supportedModalities,
      initialized: p.isInitialized()
    }))
  }

  setActive(id: string): void {
    if (!this.providers.has(id)) {
      throw new Error(`Provider ${id} not found`)
    }
    this.activeProviderId = id
  }

  getActive(): MediaProvider | null {
    if (!this.activeProviderId) return null
    return this.providers.get(this.activeProviderId) || null
  }

  getActiveId(): string | null {
    return this.activeProviderId
  }

  async initializeProvider(id: string, apiKey: string): Promise<void> {
    const provider = this.providers.get(id)
    if (!provider) throw new Error(`Provider ${id} not found`)
    await provider.initialize(apiKey)
  }

  async initializeGroup(group: string, apiKey: string): Promise<void> {
    const providerIds = KEY_GROUPS.find((entry) => entry.id === group)?.providerIds ?? []

    if (providerIds.length === 0) {
      throw new Error(`Provider group ${group} not found`)
    }

    await Promise.all(providerIds.map((providerId) => this.initializeProvider(providerId, apiKey)))
  }

  async testProvider(id: string): Promise<ConnectionStatus> {
    const provider = this.providers.get(id)
    if (!provider) throw new Error(`Provider ${id} not found`)
    return provider.testConnection()
  }

  getGroupMapping(): Record<string, string> {
    return { ...PROVIDER_GROUP_MAPPING }
  }
}

// Singleton instance
export const providerRegistry = new ProviderRegistry()
