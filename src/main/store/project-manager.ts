// ============================================================
// Manthan Studio — Project Manager
// CRUD operations for project workspaces
// ============================================================

import { randomUUID } from 'crypto'
import { databaseManager } from './db'

export interface Project {
  id: string
  name: string
  description: string
  color: string
  icon: string
  created_at: number
  updated_at: number
  archived: number
}

export interface ProjectWithStats extends Project {
  generation_count: number
  asset_count: number
}

const PROJECT_COLORS = [
  '#6366f1', // indigo
  '#f43f5e', // rose
  '#10b981', // emerald
  '#f59e0b', // amber
  '#06b6d4', // cyan
  '#8b5cf6', // violet
  '#f97316', // orange
  '#64748b'  // slate
]

class ProjectManager {
  /** Create a new project */
  createProject(options: {
    name: string
    description?: string
    color?: string
    icon?: string
  }): Project {
    const id = randomUUID()
    const now = Date.now()
    const color = options.color ?? PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)]

    databaseManager.run(
      `INSERT INTO projects (id, name, description, color, icon, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, options.name, options.description ?? '', color, options.icon ?? 'folder', now, now]
    )

    return this.getProject(id)!
  }

  /** Get a single project by ID */
  getProject(id: string): Project | null {
    return databaseManager.queryOne<Project>(
      'SELECT * FROM projects WHERE id = ?',
      [id]
    ) ?? null
  }

  /** List all non-archived projects with generation and asset counts */
  listProjects(): ProjectWithStats[] {
    return databaseManager.query<ProjectWithStats>(
      `SELECT
        p.*,
        COALESCE(g.cnt, 0) as generation_count,
        COALESCE(a.cnt, 0) as asset_count
       FROM projects p
       LEFT JOIN (SELECT project_id, COUNT(*) as cnt FROM generations GROUP BY project_id) g
         ON g.project_id = p.id
       LEFT JOIN (SELECT project_id, COUNT(*) as cnt FROM assets GROUP BY project_id) a
         ON a.project_id = p.id
       WHERE p.archived = 0
       ORDER BY p.updated_at DESC`
    )
  }

  /** Update a project */
  updateProject(id: string, updates: Partial<Pick<Project, 'name' | 'description' | 'color' | 'icon'>>): Project | null {
    const fields: string[] = []
    const values: unknown[] = []

    if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name) }
    if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description) }
    if (updates.color !== undefined) { fields.push('color = ?'); values.push(updates.color) }
    if (updates.icon !== undefined) { fields.push('icon = ?'); values.push(updates.icon) }

    if (fields.length === 0) return this.getProject(id)

    fields.push('updated_at = ?')
    values.push(Date.now())
    values.push(id)

    databaseManager.run(
      `UPDATE projects SET ${fields.join(', ')} WHERE id = ?`,
      values
    )

    return this.getProject(id)
  }

  /** Soft-delete (archive) a project */
  archiveProject(id: string): void {
    if (id === 'default') return // Can't archive the default project
    databaseManager.run(
      'UPDATE projects SET archived = 1, updated_at = ? WHERE id = ?',
      [Date.now(), id]
    )
  }

  /** Hard-delete a project and all its data */
  deleteProject(id: string): void {
    if (id === 'default') return // Can't delete the default project

    databaseManager.transaction(() => {
      // Delete assets files would be handled by asset-manager in a real cascade
      // For now, just remove DB rows — asset files remain on disk for safety
      databaseManager.run('DELETE FROM assets WHERE project_id = ?', [id])
      databaseManager.run('DELETE FROM generations WHERE project_id = ?', [id])
      databaseManager.run('DELETE FROM variables WHERE project_id = ?', [id])
      databaseManager.run('DELETE FROM prompt_templates WHERE project_id = ?', [id])
      databaseManager.run('DELETE FROM projects WHERE id = ?', [id])
    })
  }

  /** Get available project colors */
  getColors(): string[] {
    return [...PROJECT_COLORS]
  }
}

export const projectManager = new ProjectManager()
