// ============================================================
// Manthan Studio — App Store
// Persistent storage for app preferences and generation history
// ============================================================

import { JsonStore } from './json-store'
import { GenerationOperation } from '../providers/base'

interface AppStoreSchema extends Record<string, unknown> {
  history: GenerationOperation[]
  preferences: {
    theme: 'dark' | 'light'
    sidebarCollapsed: boolean
    defaultProvider: string | null
    defaultAspectRatio: string
    defaultResolution: string
  }
  templates: Array<{ id: string; name: string; prompt: string; category: string }>
}

const store = new JsonStore<AppStoreSchema>('manthan-app', {
  history: [],
  preferences: {
    theme: 'dark',
    sidebarCollapsed: false,
    defaultProvider: null,
    defaultAspectRatio: '16:9',
    defaultResolution: '1080p'
  },
  templates: [
    { id: 'cinematic', name: 'Cinematic', prompt: 'A cinematic shot with dramatic lighting, shallow depth of field, anamorphic lens flare, film grain, professional color grading.', category: 'style' },
    { id: 'dialogue', name: 'Dialogue Scene', prompt: "A close-up conversation scene between two people. Natural lighting, intimate framing, clear dialogue with subtle ambient sound.", category: 'scene' },
    { id: 'realism', name: 'Photorealism', prompt: 'Ultra-realistic, photorealistic quality, natural lighting, no artifacts, no distortion, professional photography style.', category: 'style' },
    { id: 'product-ad', name: 'Product Ad', prompt: 'Professional product advertisement. Clean white background, studio lighting, smooth camera movement, premium feel.', category: 'commercial' },
    { id: 'storytelling', name: 'Storytelling', prompt: 'A narrative sequence with emotional depth, character-driven action, atmospheric soundtrack, cinematic pacing.', category: 'narrative' }
  ]
})

export const appStore = {
  addToHistory(operation: GenerationOperation): void {
    const history = store.get('history')
    history.unshift(operation)
    if (history.length > 500) history.splice(500)
    store.set('history', history)
  },
  getHistory: () => store.get('history'),
  clearHistory: () => store.set('history', []),
  getPreferences: () => store.get('preferences'),
  setPreference<K extends keyof AppStoreSchema['preferences']>(key: K, value: AppStoreSchema['preferences'][K]): void {
    const prefs = store.get('preferences')
    prefs[key] = value
    store.set('preferences', prefs)
  },
  getTemplates: () => store.get('templates'),
  addTemplate(template: AppStoreSchema['templates'][0]): void {
    const templates = store.get('templates')
    templates.push(template)
    store.set('templates', templates)
  }
}
