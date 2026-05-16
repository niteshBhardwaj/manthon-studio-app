// ============================================================
// Manthan Studio — Database Manager
// Singleton SQLite database manager with versioned migrations
// ============================================================

import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { mkdirSync } from 'fs'
import { MIGRATIONS } from './schema'
import { logger } from '../logger'

class DatabaseManager {
  private db: Database.Database | null = null
  private dbPath: string = ''

  /** Initialize the database — must be called after app.whenReady() */
  initialize(): void {
    const userDataPath = app.getPath('userData')
    mkdirSync(userDataPath, { recursive: true })
    this.dbPath = join(userDataPath, 'manthan.db')

    this.db = new Database(this.dbPath)

    // Performance pragmas
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
    this.db.pragma('busy_timeout = 5000')

    this.runMigrations()

    logger.info('DB', `Database initialized at: ${this.dbPath}`)
  }

  /** Get the raw database instance */
  getDb(): Database.Database {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.')
    }
    return this.db
  }

  /** Get the path to the database file */
  getDbPath(): string {
    return this.dbPath
  }

  /** Gracefully close the database connection */
  close(): void {
    if (this.db) {
      try {
        // Checkpoint WAL before closing for a clean state
        this.db.pragma('wal_checkpoint(TRUNCATE)')
        this.db.close()
        logger.info('DB', 'Database closed.')
      } catch (e) {
        logger.error('DB', 'Error closing database:', e)
      }
      this.db = null
    }
  }

  // ── Convenience query helpers ──────────────────────────────

  /** Run a query that returns rows */
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[] {
    const stmt = this.getDb().prepare(sql)
    return (params ? stmt.all(...params) : stmt.all()) as T[]
  }

  /** Run a query that returns a single row */
  queryOne<T = Record<string, unknown>>(sql: string, params?: unknown[]): T | undefined {
    const stmt = this.getDb().prepare(sql)
    return (params ? stmt.get(...params) : stmt.get()) as T | undefined
  }

  /** Run an INSERT/UPDATE/DELETE statement */
  run(sql: string, params?: unknown[]): Database.RunResult {
    const stmt = this.getDb().prepare(sql)
    return params ? stmt.run(...params) : stmt.run()
  }

  /** Run multiple statements in a transaction */
  transaction<T>(fn: () => T): T {
    const trx = this.getDb().transaction(fn)
    return trx()
  }

  // ── Migrations ─────────────────────────────────────────────

  private runMigrations(): void {
    const db = this.getDb()

    // Create migrations tracking table
    db.exec(`
      CREATE TABLE IF NOT EXISTS _migrations (
        version INTEGER PRIMARY KEY,
        description TEXT,
        applied_at INTEGER NOT NULL
      )
    `)

    const applied = db.prepare('SELECT version FROM _migrations').all() as { version: number }[]
    const appliedSet = new Set(applied.map((r) => r.version))
    let shouldVacuum = false

    for (const migration of MIGRATIONS) {
      if (!appliedSet.has(migration.version)) {
        const runMigration = db.transaction(() => {
          db.exec(migration.sql)
          db.prepare(
            'INSERT INTO _migrations (version, description, applied_at) VALUES (?, ?, ?)'
          ).run(migration.version, migration.description, Date.now())
        })

        try {
          runMigration()
          logger.info(
            'Migration',
            `Applied migration v${migration.version}: ${migration.description}`
          )
          if (migration.version === 5) {
            shouldVacuum = true
          }
        } catch (e) {
          logger.error('Migration', `Failed to apply migration v${migration.version}:`, e)
          throw e
        }
      }
    }

    if (shouldVacuum) {
      try {
        db.pragma('wal_checkpoint(TRUNCATE)')
        db.exec('VACUUM')
        logger.info('Migration', 'Compacted database after media cleanup migration')
      } catch (error) {
        logger.warn('Migration', 'Database compaction after media cleanup was skipped:', error)
      }
    }
  }
}

// Singleton instance
export const databaseManager = new DatabaseManager()
