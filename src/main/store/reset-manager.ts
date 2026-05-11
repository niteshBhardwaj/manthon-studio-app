import { BrowserWindow, app, dialog, session } from 'electron'
import { existsSync, mkdirSync } from 'fs'
import { rm } from 'fs/promises'
import { join } from 'path'
import { queueManager } from '../queue/queue-manager'
import { logger } from '../logger'
import { DEFAULT_TEMPLATES } from './app-store'
import { databaseManager } from './db'

export interface ResetResult {
  success: boolean
  restarting: boolean
  canceled?: boolean
}

const DEFAULT_PROJECT = {
  id: 'default',
  name: 'Personal',
  description: 'Default workspace',
  color: '#6366f1',
  icon: 'folder',
  archived: 0
}

const DEFAULT_NEGATIVE_PROMPT_PRESETS = [
  {
    id: 'neg-video-default',
    name: 'Default Video Negative',
    content:
      'blurry, distorted, low quality, watermark, text overlay, flickering, jittery, artifacts',
    mediaType: 'video'
  },
  {
    id: 'neg-image-default',
    name: 'Default Image Negative',
    content:
      'blurry, low resolution, watermark, text, deformed, bad anatomy, disfigured, poorly drawn',
    mediaType: 'image'
  }
] as const

const FILE_ONLY_TABLE_POLICIES = {
  _migrations: 'preserve',
  preferences: 'preserve',
  projects: 'reset-default',
  prompt_templates: 'reseed-defaults',
  negative_prompt_presets: 'reseed-defaults',
  generations: 'clear',
  assets: 'clear',
  job_queue: 'clear',
  api_logs: 'clear',
  cost_log: 'clear',
  variables: 'clear'
} as const

const RESET_DIRECTORIES = ['assets', 'cache', 'temp', 'media'] as const
const LEGACY_APP_STORE_FILES = ['manthan-app.json', 'manthan-app.json.bak'] as const
const LOCKED_FILE_ERROR_CODES = new Set(['EBUSY', 'EPERM', 'ENOTEMPTY'])

class ResetManager {
  async resetFilesOnly(): Promise<ResetResult> {
    logger.warn('Storage', 'Starting files-only reset')
    queueManager.shutdown()
    this.assertFilesOnlyTableCoverage()

    databaseManager.transaction(() => {
      databaseManager.run('DELETE FROM job_queue')
      databaseManager.run('DELETE FROM cost_log')
      databaseManager.run('DELETE FROM api_logs')
      databaseManager.run('DELETE FROM variables')
      databaseManager.run('DELETE FROM generations')
      databaseManager.run('DELETE FROM assets')
      databaseManager.run('DELETE FROM prompt_templates')
      databaseManager.run('DELETE FROM negative_prompt_presets')
      databaseManager.run("DELETE FROM projects WHERE id <> 'default'")
      this.seedDefaultProject()
      this.seedDefaultTemplates()
      this.seedDefaultNegativePromptPresets()
    })

    await this.clearChromiumCache()
    await Promise.all([
      this.resetUserDirectories(),
      ...LEGACY_APP_STORE_FILES.map((file) =>
        this.removePathBestEffort(join(app.getPath('userData'), file))
      )
    ])
    this.scheduleRelaunch()
    return { success: true, restarting: true }
  }

  async resetEverything(): Promise<ResetResult> {
    if (!this.confirmFactoryReset()) {
      return { success: false, restarting: false, canceled: true }
    }

    logger.warn('Storage', 'Starting full factory reset')
    queueManager.shutdown()
    await this.clearChromiumCache()
    databaseManager.close()

    const userDataPath = app.getPath('userData')
    const dbPath = databaseManager.getDbPath() || join(userDataPath, 'manthan.db')

    await Promise.all([
      this.removePath(dbPath),
      this.removePath(`${dbPath}-wal`),
      this.removePath(`${dbPath}-shm`),
      this.removePath(join(userDataPath, 'manthan-keys.json')),
      ...LEGACY_APP_STORE_FILES.map((file) =>
        this.removePathBestEffort(join(userDataPath, file))
      ),
      ...RESET_DIRECTORIES.map((directory) =>
        this.removePathBestEffort(join(userDataPath, directory))
      )
    ])

    this.recreateUserDirectories()
    this.scheduleRelaunch({ closeDatabase: false })
    return { success: true, restarting: true }
  }

  private assertFilesOnlyTableCoverage(): void {
    const tables = databaseManager.query<{ name: string }>(
      `SELECT name
       FROM sqlite_master
       WHERE type = 'table'
         AND name NOT LIKE 'sqlite_%'
       ORDER BY name`
    )
    const knownTables = new Set(Object.keys(FILE_ONLY_TABLE_POLICIES))
    const unknownTables = tables.map((table) => table.name).filter((name) => !knownTables.has(name))

    if (unknownTables.length > 0) {
      throw new Error(
        `Factory reset is missing reset policies for table(s): ${unknownTables.join(', ')}`
      )
    }
  }

  private seedDefaultProject(): void {
    const now = Date.now()
    databaseManager.run(
      `INSERT OR REPLACE INTO projects
        (id, name, description, color, icon, created_at, updated_at, archived)
       VALUES (?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM projects WHERE id = ?), ?), ?, ?)`,
      [
        DEFAULT_PROJECT.id,
        DEFAULT_PROJECT.name,
        DEFAULT_PROJECT.description,
        DEFAULT_PROJECT.color,
        DEFAULT_PROJECT.icon,
        DEFAULT_PROJECT.id,
        now,
        now,
        DEFAULT_PROJECT.archived
      ]
    )
  }

  private seedDefaultTemplates(): void {
    const now = Date.now()
    for (const template of DEFAULT_TEMPLATES) {
      databaseManager.run(
        `INSERT OR IGNORE INTO prompt_templates
          (id, project_id, name, prompt, category, variables, created_at)
         VALUES (?, NULL, ?, ?, ?, '[]', ?)`,
        [template.id, template.name, template.prompt, template.category, now]
      )
    }
  }

  private seedDefaultNegativePromptPresets(): void {
    const now = Date.now()
    for (const preset of DEFAULT_NEGATIVE_PROMPT_PRESETS) {
      databaseManager.run(
        `INSERT OR IGNORE INTO negative_prompt_presets
          (id, name, content, media_type, is_default, created_at)
         VALUES (?, ?, ?, ?, 1, ?)`,
        [preset.id, preset.name, preset.content, preset.mediaType, now]
      )
    }
  }

  private async resetUserDirectories(): Promise<void> {
    await Promise.all(
      RESET_DIRECTORIES.map((directory) =>
        this.removePathBestEffort(join(app.getPath('userData'), directory))
      )
    )
    this.recreateUserDirectories()
  }

  private recreateUserDirectories(): void {
    const userDataPath = app.getPath('userData')
    for (const directory of RESET_DIRECTORIES) {
      mkdirSync(join(userDataPath, directory), { recursive: true })
    }
    mkdirSync(join(userDataPath, 'assets', 'thumbnails'), { recursive: true })
  }

  private async removePath(path: string): Promise<void> {
    if (!existsSync(path)) return
    await rm(path, { recursive: true, force: true })
  }

  private async removePathBestEffort(path: string): Promise<void> {
    try {
      await this.removePath(path)
    } catch (error) {
      if (!this.isLockedFileError(error)) {
        throw error
      }

      await this.wait(250)
      try {
        await this.removePath(path)
      } catch (retryError) {
        if (!this.isLockedFileError(retryError)) {
          throw retryError
        }
        logger.warn('Storage', `Skipped locked reset path: ${path}`, retryError)
      }
    }
  }

  private async clearChromiumCache(): Promise<void> {
    try {
      await session.defaultSession.clearCache()
    } catch (error) {
      logger.warn('Storage', 'Failed to clear Chromium cache before reset:', error)
    }
  }

  private isLockedFileError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      LOCKED_FILE_ERROR_CODES.has(String((error as { code?: unknown }).code))
    )
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms)
    })
  }

  private confirmFactoryReset(): boolean {
    const focusedWindow = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const options: Electron.MessageBoxSyncOptions = {
      type: 'warning',
      buttons: ['Full Factory Reset', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      title: 'Full Factory Reset',
      message: 'Erase all Manthan Studio data?',
      detail:
        'This permanently deletes generated media, projects, settings, API keys, and Google Drive credentials. The app will restart immediately.'
    }

    const result = focusedWindow
      ? dialog.showMessageBoxSync(focusedWindow, options)
      : dialog.showMessageBoxSync(options)

    return result === 0
  }

  private scheduleRelaunch(options: { closeDatabase?: boolean } = {}): void {
    setTimeout(() => {
      try {
        if (options.closeDatabase !== false) {
          databaseManager.close()
        }
      } catch (error) {
        logger.warn('Storage', 'Failed to close database before relaunch:', error)
      }
      app.relaunch()
      app.exit(0)
    }, 300)
  }
}

export const resetManager = new ResetManager()
