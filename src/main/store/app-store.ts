// ============================================================
// Manthan Studio — App Store
// Persistent storage for app preferences and generation history
// Now backed by SQLite via DatabaseManager
// ============================================================

import { databaseManager } from './db'
import { GenerationOperation } from '../providers/base'
import { MODEL_REGISTRY } from '../../shared/model-registry'
import { existsSync, readFileSync, renameSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { randomUUID } from 'crypto'

// ── Types ────────────────────────────────────────────────────

interface Preferences {
  theme: 'dark' | 'light'
  sidebarCollapsed: boolean
  defaultProvider: string | null
  defaultAspectRatio: string
  defaultResolution: string
  enabledModels: string[]
  notificationsEnabled: boolean
}

interface Template {
  id: string
  name: string
  prompt: string
  category: string
}

// ── Default templates (seeded into DB if empty) ──────────────

const DEFAULT_TEMPLATES: Template[] = [
  {
    id: 'cinematic',
    name: 'Cinematic',
    prompt:
      'A cinematic shot with dramatic lighting, shallow depth of field, anamorphic lens flare, film grain, professional color grading.',
    category: 'style'
  },
  {
    id: 'dialogue',
    name: 'Dialogue Scene',
    prompt:
      'A close-up conversation scene between two people. Natural lighting, intimate framing, clear dialogue with subtle ambient sound.',
    category: 'scene'
  },
  {
    id: 'realism',
    name: 'Photorealism',
    prompt:
      'Ultra-realistic, photorealistic quality, natural lighting, no artifacts, no distortion, professional photography style.',
    category: 'style'
  },
  {
    id: 'product-ad',
    name: 'Product Ad',
    prompt:
      'Professional product advertisement. Clean white background, studio lighting, smooth camera movement, premium feel.',
    category: 'commercial'
  },
  {
    id: 'storytelling',
    name: 'Storytelling',
    prompt:
      'A narrative sequence with emotional depth, character-driven action, atmospheric soundtrack, cinematic pacing.',
    category: 'narrative'
  }
]

const DEFAULT_PREFERENCES: Preferences = {
  theme: 'dark',
  sidebarCollapsed: false,
  defaultProvider: null,
  defaultAspectRatio: '16:9',
  defaultResolution: '1080p',
  enabledModels: MODEL_REGISTRY.map((model) => model.id),
  notificationsEnabled: true
}

// ── JSON → SQLite Migration ─────────────────────────────────

function migrateFromJson(): void {
  const jsonPath = join(app.getPath('userData'), 'manthan-app.json')
  if (!existsSync(jsonPath)) return

  // Check if we already have data in SQLite
  const count = databaseManager.queryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM generations'
  )
  if (count && count.count > 0) {
    console.log('[Migration] SQLite already has data, skipping JSON migration.')
    return
  }

  console.log('[Migration] Migrating from manthan-app.json to SQLite...')

  try {
    const raw = readFileSync(jsonPath, 'utf-8')
    const data = JSON.parse(raw)

    databaseManager.transaction(() => {
      // Migrate history → generations
      const history = (data.history ?? []) as GenerationOperation[]
      for (const op of history) {
        databaseManager.run(
          `INSERT OR IGNORE INTO generations
            (id, project_id, type, status, prompt, provider, model, config, error, progress, started_at, completed_at, created_at)
           VALUES (?, 'default', ?, ?, ?, ?, ?, '{}', ?, ?, ?, ?, ?)`,
          [
            op.id ?? randomUUID(),
            op.type ?? 'video',
            op.status ?? 'completed',
            op.prompt ?? '',
            op.provider ?? 'unknown',
            op._operationName ?? 'unknown',
            op.error ?? null,
            op.progress ?? 100,
            op.startedAt ?? Date.now(),
            op.completedAt ?? null,
            op.startedAt ?? Date.now()
          ]
        )
      }
      console.log(`[Migration] Migrated ${history.length} history items.`)

      // Migrate preferences
      const prefs = data.preferences
      if (prefs) {
        for (const [key, value] of Object.entries(prefs)) {
          databaseManager.run('INSERT OR REPLACE INTO preferences (key, value) VALUES (?, ?)', [
            key,
            JSON.stringify(value)
          ])
        }
        console.log('[Migration] Migrated preferences.')
      }

      // Migrate templates
      const templates = (data.templates ?? []) as Template[]
      const now = Date.now()
      for (const tmpl of templates) {
        databaseManager.run(
          `INSERT OR IGNORE INTO prompt_templates (id, project_id, name, prompt, category, variables, created_at)
           VALUES (?, NULL, ?, ?, ?, '[]', ?)`,
          [tmpl.id, tmpl.name, tmpl.prompt, tmpl.category, now]
        )
      }
      console.log(`[Migration] Migrated ${templates.length} templates.`)
    })

    // Rename old file
    const backupPath = jsonPath + '.bak'
    renameSync(jsonPath, backupPath)
    console.log(`[Migration] Old JSON file renamed to ${backupPath}`)
  } catch (e) {
    console.error('[Migration] Failed to migrate from JSON:', e)
  }
}

// ── Seed default data ────────────────────────────────────────

function seedDefaults(): void {
  // Seed default templates
  const tmplCount = databaseManager.queryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM prompt_templates'
  )
  if (!tmplCount || tmplCount.count === 0) {
    const now = Date.now()
    for (const tmpl of DEFAULT_TEMPLATES) {
      databaseManager.run(
        `INSERT OR IGNORE INTO prompt_templates (id, project_id, name, prompt, category, variables, created_at)
         VALUES (?, NULL, ?, ?, ?, '[]', ?)`,
        [tmpl.id, tmpl.name, tmpl.prompt, tmpl.category, now]
      )
    }
  }

  // Seed default preferences
  for (const [key, value] of Object.entries(DEFAULT_PREFERENCES)) {
    const existing = databaseManager.queryOne<{ key: string }>(
      'SELECT key FROM preferences WHERE key = ?',
      [key]
    )
    if (!existing) {
      databaseManager.run('INSERT INTO preferences (key, value) VALUES (?, ?)', [
        key,
        JSON.stringify(value)
      ])
    }
  }
}

// ── Public API ───────────────────────────────────────────────

export const appStore = {
  /** Run one-time migration + seeding (call after DB init) */
  initialize(): void {
    migrateFromJson()
    seedDefaults()
  },

  // ── History (generations table) ────────────────────────────

  addToHistory(operation: GenerationOperation): void {
    databaseManager.run(
      `INSERT OR REPLACE INTO generations
        (id, project_id, type, status, prompt, provider, model, config, result_asset_id, error, progress, started_at, completed_at, starred, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, '{}', ?, ?, ?, ?, ?, ?, ?)`,
      [
        operation.id,
        operation.projectId ?? 'default',
        operation.type ?? 'video',
        operation.status ?? 'generating',
        operation.prompt ?? '',
        operation.provider ?? 'unknown',
        operation._operationName ?? 'unknown',
        operation.resultAssetId ?? null,
        operation.error ?? null,
        operation.progress ?? 0,
        operation.startedAt ?? Date.now(),
        operation.completedAt ?? null,
        operation.starred ? 1 : 0,
        Date.now()
      ]
    )
  },

  getHistory(): GenerationOperation[] {
    const rows = databaseManager.query<GenerationRow>(
      'SELECT * FROM generations ORDER BY started_at DESC LIMIT 1000'
    )
    return rows.map(rowToOperation)
  },

  clearHistory(): void {
    databaseManager.run('DELETE FROM generations')
  },

  // ── Preferences ────────────────────────────────────────────

  getPreferences(): Preferences {
    const prefs: Record<string, unknown> = { ...DEFAULT_PREFERENCES }
    const rows = databaseManager.query<{ key: string; value: string }>('SELECT * FROM preferences')
    for (const row of rows) {
      try {
        prefs[row.key] = JSON.parse(row.value)
      } catch {
        prefs[row.key] = row.value
      }
    }
    return prefs as unknown as Preferences
  },

  setPreference(key: string, value: unknown): void {
    databaseManager.run('INSERT OR REPLACE INTO preferences (key, value) VALUES (?, ?)', [
      key,
      JSON.stringify(value)
    ])
  },

  getEnabledModels(): string[] {
    const row = databaseManager.queryOne<{ value: string }>(
      "SELECT value FROM preferences WHERE key = 'enabledModels'"
    )

    const fallback = MODEL_REGISTRY.map((model) => model.id)

    if (!row) {
      this.setPreference('enabledModels', fallback)
      return fallback
    }

    let models: string[]
    try {
      models = JSON.parse(row.value)
    } catch {
      return fallback
    }

    if (!Array.isArray(models) || models.length === 0) {
      this.setPreference('enabledModels', fallback)
      return fallback
    }

    const validIds = new Set(MODEL_REGISTRY.map((model) => model.id))
    const filtered = models.filter((id) => validIds.has(id))
    if (filtered.length === 0) {
      this.setPreference('enabledModels', fallback)
      return fallback
    }

    if (filtered.length !== models.length) {
      this.setPreference('enabledModels', filtered)
    }

    return filtered
  },

  setEnabledModels(ids: string[]): void {
    const validIds = new Set(MODEL_REGISTRY.map((model) => model.id))
    const filtered = ids.filter((id) => validIds.has(id))
    const final = filtered.length > 0 ? filtered : MODEL_REGISTRY.map((model) => model.id)
    this.setPreference('enabledModels', final)
  },

  // ── Templates ──────────────────────────────────────────────

  getTemplates(): Template[] {
    const rows = databaseManager.query<{
      id: string
      name: string
      prompt: string
      category: string
    }>('SELECT id, name, prompt, category FROM prompt_templates ORDER BY created_at ASC')
    return rows
  },

  addTemplate(template: Template): void {
    databaseManager.run(
      `INSERT OR REPLACE INTO prompt_templates (id, project_id, name, prompt, category, variables, created_at)
       VALUES (?, NULL, ?, ?, ?, '[]', ?)`,
      [template.id, template.name, template.prompt, template.category, Date.now()]
    )
  }
}

// ── Internal types & helpers ─────────────────────────────────

interface GenerationRow {
  id: string
  project_id: string | null
  type: string
  status: string
  prompt: string
  negative_prompt: string
  provider: string
  model: string
  config: string
  result_asset_id: string | null
  error: string | null
  progress: number
  started_at: number
  completed_at: number | null
  starred: number
  cost_estimate: number
}

function rowToOperation(row: GenerationRow): GenerationOperation {
  return {
    id: row.id,
    type: row.type as GenerationOperation['type'],
    status: row.status as GenerationOperation['status'],
    prompt: row.prompt,
    provider: row.provider,
    error: row.error ?? undefined,
    progress: row.progress,
    startedAt: row.started_at,
    completedAt: row.completed_at ?? undefined,
    _operationName: row.model
  }
}
