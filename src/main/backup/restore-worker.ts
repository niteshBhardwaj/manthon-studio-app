import Database from 'better-sqlite3'
import { createDecipheriv, pbkdf2Sync } from 'crypto'
import { createReadStream, createWriteStream } from 'fs'
import { mkdir, open, readdir, stat } from 'fs/promises'
import yauzl from 'yauzl'
import { dirname, join, resolve, sep } from 'path'
import { pipeline } from 'stream/promises'
import { parentPort, workerData } from 'worker_threads'
import type { BackupProgress } from './types'

const ENCRYPTION_MAGIC = Buffer.from('MSBKP01G')
const SALT_LENGTH = 16
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16
const KEY_ITERATIONS = 100_000
const KEY_LENGTH = 32
const HEADER_LENGTH =
  ENCRYPTION_MAGIC.length + SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH

interface RestoreWorkerData {
  inputPath: string
  outputDir: string
  encrypted: boolean
  password?: string
  currentSchemaVersion: number
}

interface RestorePreview {
  dbPath: string
  assetsPath: string
  generationCount: number
  assetCount: number
  projectCount: number
  schemaVersion: number
  extractedSize: number
}

function postProgress(progress: BackupProgress): void {
  parentPort?.postMessage({ type: 'progress', progress })
}

async function isEncryptedFile(filePath: string): Promise<boolean> {
  const file = await open(filePath, 'r')
  try {
    const magic = Buffer.alloc(ENCRYPTION_MAGIC.length)
    await file.read(magic, 0, ENCRYPTION_MAGIC.length, 0)
    return magic.equals(ENCRYPTION_MAGIC)
  } finally {
    await file.close()
  }
}

async function decryptBackup(inputPath: string, outputPath: string, password: string): Promise<void> {
  const file = await open(inputPath, 'r')
  let salt: Buffer
  let iv: Buffer
  let authTag: Buffer
  try {
    const header = Buffer.alloc(HEADER_LENGTH)
    await file.read(header, 0, HEADER_LENGTH, 0)
    const magic = header.subarray(0, ENCRYPTION_MAGIC.length)
    if (!magic.equals(ENCRYPTION_MAGIC)) {
      throw new Error('This backup is not encrypted in Manthan Studio format.')
    }

    salt = header.subarray(ENCRYPTION_MAGIC.length, ENCRYPTION_MAGIC.length + SALT_LENGTH)
    iv = header.subarray(
      ENCRYPTION_MAGIC.length + SALT_LENGTH,
      ENCRYPTION_MAGIC.length + SALT_LENGTH + IV_LENGTH
    )
    authTag = header.subarray(
      ENCRYPTION_MAGIC.length + SALT_LENGTH + IV_LENGTH,
      HEADER_LENGTH
    )
  } finally {
    await file.close()
  }

  const key = pbkdf2Sync(password, salt, KEY_ITERATIONS, KEY_LENGTH, 'sha256')
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)

  const inputSize = (await stat(inputPath)).size
  const encryptedSize = Math.max(1, inputSize - HEADER_LENGTH)
  let decryptedBytes = 0
  const input = createReadStream(inputPath, { start: HEADER_LENGTH })
  input.on('data', (chunk: string | Buffer) => {
    decryptedBytes += Buffer.byteLength(chunk)
    postProgress({
      phase: 'decrypting',
      percent: Math.min(99, Math.round((decryptedBytes / encryptedSize) * 100)),
      message: 'Decrypting backup archive'
    })
  })

  await pipeline(input, decipher, createWriteStream(outputPath))
  postProgress({ phase: 'decrypting', percent: 100, message: 'Backup decrypted' })
}

async function extractZip(zipPath: string, outputDir: string): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    yauzl.open(zipPath, { lazyEntries: true }, (openError, zipfile) => {
      if (openError) {
        rejectPromise(openError)
        return
      }
      if (!zipfile) {
        rejectPromise(new Error('Could not open backup archive.'))
        return
      }

      const root = resolve(outputDir)
      const rootPrefix = root.endsWith(sep) ? root : `${root}${sep}`
      let processedEntries = 0

      zipfile.on('error', rejectPromise)
      zipfile.on('end', () => {
        postProgress({ phase: 'extracting', percent: 100, message: 'Backup extracted' })
        resolvePromise()
      })

      zipfile.readEntry()
      zipfile.on('entry', (entry) => {
        processedEntries += 1
        const percent = Math.min(99, Math.round((processedEntries / zipfile.entryCount) * 100))
        postProgress({
          phase: 'extracting',
          percent,
          message: `Extracting ${processedEntries} of ${zipfile.entryCount} entries`
        })

        const targetPath = resolve(outputDir, entry.fileName)
        if (targetPath !== root && !targetPath.startsWith(rootPrefix)) {
          rejectPromise(new Error(`Unsafe path in backup archive: ${entry.fileName}`))
          return
        }

        if (/\/$/.test(entry.fileName)) {
          mkdir(targetPath, { recursive: true })
            .then(() => zipfile.readEntry())
            .catch(rejectPromise)
          return
        }

        mkdir(dirname(targetPath), { recursive: true })
          .then(
            () =>
              new Promise<void>((resolveEntry, rejectEntry) => {
                zipfile.openReadStream(entry, (streamError, readStream) => {
                  if (streamError) {
                    rejectEntry(streamError)
                    return
                  }
                  if (!readStream) {
                    rejectEntry(new Error(`Could not read ${entry.fileName} from backup archive.`))
                    return
                  }

                  pipeline(readStream, createWriteStream(targetPath))
                    .then(resolveEntry)
                    .catch(rejectEntry)
                })
              })
          )
          .then(() => zipfile.readEntry())
          .catch(rejectPromise)
      })
    })
  })
}

function countTable(db: Database.Database, table: string): number {
  try {
    const row = db.prepare(`SELECT COUNT(*) as count FROM "${table}"`).get() as
      | { count: number }
      | undefined
    return row?.count ?? 0
  } catch {
    return 0
  }
}

function validateRestoredDatabase(
  outputDir: string,
  currentSchemaVersion: number
): RestorePreview {
  const dbPath = join(outputDir, 'manthan.db')
  const db = new Database(dbPath, { readonly: true, fileMustExist: true })
  try {
    const migrationRow = db.prepare('SELECT MAX(version) as version FROM _migrations').get() as
      | { version: number | null }
      | undefined
    const schemaVersion = migrationRow?.version ?? 0
    if (schemaVersion > currentSchemaVersion) {
      throw new Error(
        `Backup schema version ${schemaVersion} is newer than this app supports (${currentSchemaVersion}).`
      )
    }

    return {
      dbPath,
      assetsPath: join(outputDir, 'assets'),
      generationCount: countTable(db, 'generations'),
      assetCount: countTable(db, 'assets'),
      projectCount: countTable(db, 'projects'),
      schemaVersion,
      extractedSize: 0
    }
  } finally {
    db.close()
  }
}

async function directorySize(dirPath: string): Promise<number> {
  let total = 0
  try {
    const entries = await readdir(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name)
      if (entry.isDirectory()) total += await directorySize(fullPath)
      else if (entry.isFile()) total += (await stat(fullPath)).size
    }
  } catch {
    return total
  }

  return total
}

async function main(): Promise<void> {
  const data = workerData as RestoreWorkerData
  const encrypted = data.encrypted || (await isEncryptedFile(data.inputPath))
  const zipPath = encrypted ? join(data.outputDir, 'restored.zip') : data.inputPath

  if (encrypted) {
    if (!data.password) throw new Error('This backup is encrypted. Enter the backup password.')
    await decryptBackup(data.inputPath, zipPath, data.password)
  }

  await extractZip(zipPath, data.outputDir)
  const preview = validateRestoredDatabase(data.outputDir, data.currentSchemaVersion)
  preview.extractedSize = await directorySize(data.outputDir)
  parentPort?.postMessage({ type: 'done', preview })
}

void main().catch((error) => {
  parentPort?.postMessage({
    type: 'error',
    error:
      error instanceof Error && /authenticate|Unsupported state|bad decrypt/i.test(error.message)
        ? 'Could not decrypt the backup. Check the password and try again.'
        : error instanceof Error
          ? error.message
          : 'Restore worker failed'
  })
})
