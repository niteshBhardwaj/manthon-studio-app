// ============================================================
// Manthan Studio — Simple JSON File Store
// Replaces electron-store to avoid ESM/CJS issues
// ============================================================

import { app } from 'electron'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

import { logger } from '../logger'

export class JsonStore<T extends Record<string, unknown>> {
  private data: T
  private filePath: string

  constructor(name: string, defaults: T) {
    const userDataPath = app.getPath('userData')
    mkdirSync(userDataPath, { recursive: true })
    this.filePath = join(userDataPath, `${name}.json`)

    if (existsSync(this.filePath)) {
      try {
        const raw = readFileSync(this.filePath, 'utf-8')
        this.data = { ...defaults, ...JSON.parse(raw) }
      } catch {
        this.data = { ...defaults }
      }
    } else {
      this.data = { ...defaults }
      this.save()
    }
  }

  get<K extends keyof T>(key: K): T[K] {
    return this.data[key]
  }

  set<K extends keyof T>(key: K, value: T[K]): void {
    this.data[key] = value
    this.save()
  }

  private save(): void {
    try {
      writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8')
    } catch (e) {
      logger.error('App', 'Failed to save store:', e)
    }
  }
}
