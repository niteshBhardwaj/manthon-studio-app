import { randomUUID } from 'crypto'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { app } from 'electron'
import { extname, isAbsolute, join, relative, resolve } from 'path'
import type { EnqueueJobInput, QueueJobInputAsset } from './types'
import { logger } from '../logger'

type BinaryLike = {
  data?: unknown
  filePath?: unknown
  mimeType?: unknown
  metadata?: unknown
  referenceType?: unknown
}

const DATA_URL_PREFIX = /^data:([^;]+);base64,/

function getQueueInputsDir(): string {
  return join(app.getPath('userData'), 'temp', 'queue-inputs')
}

function extensionForMime(mimeType: string): string {
  const subtype = mimeType.split('/')[1]?.split(';')[0]
  if (!subtype) return '.bin'
  if (subtype === 'jpeg') return '.jpg'
  if (subtype === 'mpeg') return '.mp3'
  return `.${subtype.replace(/[^a-z0-9]/gi, '') || 'bin'}`
}

function normalizeBase64(data: string): string {
  return data.replace(DATA_URL_PREFIX, '')
}

function writeBinary(jobId: string, value: BinaryLike, cache: Map<string, string>): string | null {
  if (typeof value.data !== 'string' || typeof value.mimeType !== 'string' || !value.data) {
    return null
  }

  const base64 = normalizeBase64(value.data)
  const cacheKey = `${value.mimeType}:${base64}`
  const cached = cache.get(cacheKey)
  if (cached) return cached

  const dir = getQueueInputsDir()
  mkdirSync(dir, { recursive: true })

  const filePath = join(dir, `${jobId}-${randomUUID()}${extensionForMime(value.mimeType)}`)
  writeFileSync(filePath, Buffer.from(base64, 'base64'))
  cache.set(cacheKey, filePath)
  return filePath
}

function externalizeValue(value: unknown, jobId: string, cache: Map<string, string>): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => externalizeValue(item, jobId, cache))
  }

  if (typeof value !== 'object' || value === null) {
    return value
  }

  const record = value as BinaryLike & Record<string, unknown>
  const filePath = writeBinary(jobId, record, cache)
  if (filePath && typeof record.mimeType === 'string') {
    const rest = { ...record }
    delete rest.data
    return {
      ...rest,
      filePath,
      mimeType: record.mimeType
    }
  }

  return Object.fromEntries(
    Object.entries(record).map(([key, entry]) => [key, externalizeValue(entry, jobId, cache)])
  )
}

function hydrateValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => hydrateValue(item))
  }

  if (typeof value !== 'object' || value === null) {
    return value
  }

  const record = value as BinaryLike & Record<string, unknown>
  if (typeof record.filePath === 'string' && typeof record.mimeType === 'string') {
    const { filePath, ...rest } = record
    return {
      ...rest,
      data: readFileSync(filePath).toString('base64'),
      mimeType: record.mimeType
    }
  }

  return Object.fromEntries(
    Object.entries(record).map(([key, entry]) => [key, hydrateValue(entry)])
  )
}

function collectFilePaths(value: unknown, paths: Set<string>): void {
  if (Array.isArray(value)) {
    value.forEach((item) => collectFilePaths(item, paths))
    return
  }

  if (typeof value !== 'object' || value === null) return

  const record = value as BinaryLike & Record<string, unknown>
  if (typeof record.filePath === 'string') {
    paths.add(record.filePath)
  }

  Object.values(record).forEach((entry) => collectFilePaths(entry, paths))
}

export function externalizeQueueInputAssets(
  input: EnqueueJobInput,
  jobId: string
): EnqueueJobInput {
  const cache = new Map<string, string>()
  return {
    ...input,
    inputAssets: externalizeValue(input.inputAssets ?? [], jobId, cache) as QueueJobInputAsset[],
    config: {
      ...input.config,
      providerParams: externalizeValue(
        input.config.providerParams,
        jobId,
        cache
      ) as EnqueueJobInput['config']['providerParams']
    }
  }
}

export function hydrateQueueJobInputAssets<T>(value: T): T {
  return hydrateValue(value) as T
}

export function cleanupQueueInputFiles(...values: unknown[]): void {
  const paths = new Set<string>()
  values.forEach((value) => collectFilePaths(value, paths))
  const root = resolve(getQueueInputsDir())

  for (const filePath of paths) {
    try {
      const target = resolve(filePath)
      const rel = relative(root, target)
      const isInsideRoot = rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
      if (isInsideRoot && existsSync(target) && extname(target)) {
        unlinkSync(target)
      }
    } catch (error) {
      logger.warn('Queue', `Failed to remove staged queue input: ${filePath}`, { error })
    }
  }
}
