// ============================================================
// Manthan Studio — Database Schema & Migrations
// Versioned SQL migrations for SQLite database
// ============================================================

export interface Migration {
  version: number
  description: string
  sql: string
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: 'Initial schema — projects, generations, assets, preferences',
    sql: `
      -- Projects (workspaces)
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        color TEXT DEFAULT '#6366f1',
        icon TEXT DEFAULT 'folder',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        archived INTEGER DEFAULT 0
      );

      -- Generations (replaces JSON history)
      CREATE TABLE IF NOT EXISTS generations (
        id TEXT PRIMARY KEY,
        project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
        type TEXT NOT NULL CHECK(type IN ('video', 'image', 'audio')),
        status TEXT NOT NULL DEFAULT 'queued',
        prompt TEXT NOT NULL,
        negative_prompt TEXT DEFAULT '',
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        config TEXT DEFAULT '{}',
        result_asset_id TEXT,
        error TEXT,
        progress REAL DEFAULT 0,
        started_at INTEGER NOT NULL,
        completed_at INTEGER,
        starred INTEGER DEFAULT 0,
        tags TEXT DEFAULT '[]',
        cost_estimate REAL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
      );

      CREATE INDEX IF NOT EXISTS idx_generations_project ON generations(project_id);
      CREATE INDEX IF NOT EXISTS idx_generations_type ON generations(type);
      CREATE INDEX IF NOT EXISTS idx_generations_status ON generations(status);
      CREATE INDEX IF NOT EXISTS idx_generations_started_at ON generations(started_at DESC);
      CREATE INDEX IF NOT EXISTS idx_generations_starred ON generations(starred);

      -- Assets (unified media catalog)
      CREATE TABLE IF NOT EXISTS assets (
        id TEXT PRIMARY KEY,
        project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
        filename TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL DEFAULT 0,
        type TEXT NOT NULL CHECK(type IN ('video', 'image', 'audio')),
        source TEXT NOT NULL DEFAULT 'generated' CHECK(source IN ('generated', 'imported', 'uploaded')),
        storage_path TEXT NOT NULL,
        thumbnail_path TEXT,
        metadata TEXT DEFAULT '{}',
        tags TEXT DEFAULT '[]',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_assets_project ON assets(project_id);
      CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(type);
      CREATE INDEX IF NOT EXISTS idx_assets_source ON assets(source);

      -- Preferences (key-value store)
      CREATE TABLE IF NOT EXISTS preferences (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      -- Prompt Templates
      CREATE TABLE IF NOT EXISTS prompt_templates (
        id TEXT PRIMARY KEY,
        project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        prompt TEXT NOT NULL,
        category TEXT DEFAULT 'custom',
        variables TEXT DEFAULT '[]',
        created_at INTEGER NOT NULL
      );

      -- Variables
      CREATE TABLE IF NOT EXISTS variables (
        id TEXT PRIMARY KEY,
        project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        value TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_variables_project ON variables(project_id);

      -- Cost log
      CREATE TABLE IF NOT EXISTS cost_log (
        id TEXT PRIMARY KEY,
        generation_id TEXT REFERENCES generations(id) ON DELETE SET NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        estimated_cost REAL NOT NULL DEFAULT 0,
        currency TEXT DEFAULT 'USD',
        logged_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_cost_log_logged_at ON cost_log(logged_at DESC);

      -- Job queue
      CREATE TABLE IF NOT EXISTS job_queue (
        id TEXT PRIMARY KEY,
        project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
        type TEXT NOT NULL CHECK(type IN ('video', 'image', 'audio')),
        priority INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
        prompt TEXT NOT NULL,
        negative_prompt TEXT DEFAULT '',
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        config TEXT NOT NULL DEFAULT '{}',
        input_assets TEXT DEFAULT '[]',
        result TEXT,
        error TEXT,
        retry_count INTEGER DEFAULT 0,
        max_retries INTEGER DEFAULT 2,
        created_at INTEGER NOT NULL,
        started_at INTEGER,
        completed_at INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_job_queue_status ON job_queue(status);
      CREATE INDEX IF NOT EXISTS idx_job_queue_priority ON job_queue(priority DESC);

      -- Negative prompt presets
      CREATE TABLE IF NOT EXISTS negative_prompt_presets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        content TEXT NOT NULL,
        media_type TEXT CHECK(media_type IN ('video', 'image', 'audio')),
        is_default INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL
      );

      -- Seed default project
      INSERT OR IGNORE INTO projects (id, name, description, color, icon, created_at, updated_at)
      VALUES ('default', 'Personal', 'Default workspace', '#6366f1', 'folder', strftime('%s','now') * 1000, strftime('%s','now') * 1000);

      -- Seed default negative prompt presets
      INSERT OR IGNORE INTO negative_prompt_presets (id, name, content, media_type, is_default, created_at)
      VALUES
        ('neg-video-default', 'Default Video Negative', 'blurry, distorted, low quality, watermark, text overlay, flickering, jittery, artifacts', 'video', 1, strftime('%s','now') * 1000),
        ('neg-image-default', 'Default Image Negative', 'blurry, low resolution, watermark, text, deformed, bad anatomy, disfigured, poorly drawn', 'image', 1, strftime('%s','now') * 1000);
    `
  }
]
