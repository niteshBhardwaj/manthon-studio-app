import archiver from 'archiver'
import { createCipheriv, pbkdf2Sync, randomBytes } from 'crypto'
import { createReadStream, createWriteStream } from 'fs'
import { open, stat } from 'fs/promises'
import { pipeline } from 'stream/promises'
import { parentPort, workerData } from 'worker_threads'
import type { BackupManifest, BackupProgress } from './types'

export const ENCRYPTION_MAGIC = Buffer.from('MSBKP01G')
const SALT_LENGTH = 16
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16
const KEY_ITERATIONS = 100_000
const KEY_LENGTH = 32
interface BackupFileEntry {
  path: string
  archivePath: string
  size: number
}

interface BackupWorkerData {
  dbPath: string
  zipPath: string
  outputPath: string
  files: BackupFileEntry[]
  encrypt: boolean
  password?: string
  manifest: BackupManifest
}

function postProgress(progress: BackupProgress): void {
  parentPort?.postMessage({ type: 'progress', progress })
}

async function createZip(data: BackupWorkerData): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(data.zipPath)
    const archive = archiver('zip', { zlib: { level: 9 } })
    const totalInputBytes = Math.max(
      1,
      data.files.reduce((sum, file) => sum + file.size, 0) + data.manifest.assetCount
    )

    output.on('close', resolve)
    output.on('error', reject)
    archive.on('error', reject)
    archive.on('warning', (error) => {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
      reject(error)
    })
    archive.on('progress', (progress) => {
      const processedBytes = progress.fs.processedBytes ?? 0
      postProgress({
        phase: 'packaging',
        percent: Math.min(99, Math.round((processedBytes / totalInputBytes) * 100)),
        message: `Packaging ${progress.entries.processed} of ${progress.entries.total} files`
      })
    })

    archive.pipe(output)
    archive.append(JSON.stringify(data.manifest, null, 2), { name: 'manifest.json' })
    archive.file(data.dbPath, { name: data.manifest.databaseFile })

    for (const file of data.files) {
      archive.file(file.path, { name: file.archivePath })
    }

    void archive.finalize()
  })

  postProgress({ phase: 'packaging', percent: 100, message: 'Backup archive created' })
}

async function encryptZip(data: BackupWorkerData): Promise<void> {
  if (!data.password) throw new Error('Backup encryption requires a password.')

  const salt = randomBytes(SALT_LENGTH)
  const iv = randomBytes(IV_LENGTH)
  const key = pbkdf2Sync(data.password, salt, KEY_ITERATIONS, KEY_LENGTH, 'sha256')
  const placeholderAuthTag = Buffer.alloc(AUTH_TAG_LENGTH)
  const header = Buffer.concat([ENCRYPTION_MAGIC, salt, iv, placeholderAuthTag])
  const inputSize = (await stat(data.zipPath)).size
  let encryptedBytes = 0

  const input = createReadStream(data.zipPath)
  input.on('data', (chunk: string | Buffer) => {
    encryptedBytes += Buffer.byteLength(chunk)
    postProgress({
      phase: 'encrypting',
      percent: Math.min(99, Math.round((encryptedBytes / Math.max(1, inputSize)) * 100)),
      message: 'Encrypting backup archive'
    })
  })

  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const output = createWriteStream(data.outputPath)
  await new Promise<void>((resolve, reject) => {
    output.write(header, (error) => {
      if (error) reject(error)
      else resolve()
    })
  })
  await pipeline(input, cipher, output)

  const authTag = cipher.getAuthTag()
  const file = await open(data.outputPath, 'r+')
  try {
    await file.write(authTag, 0, AUTH_TAG_LENGTH, ENCRYPTION_MAGIC.length + SALT_LENGTH + IV_LENGTH)
  } finally {
    await file.close()
  }

  postProgress({ phase: 'encrypting', percent: 100, message: 'Backup encrypted' })
}

async function main(): Promise<void> {
  const data = workerData as BackupWorkerData
  await createZip(data)

  if (data.encrypt) {
    await encryptZip(data)
    const encryptedSize = (await stat(data.outputPath)).size
    parentPort?.postMessage({ type: 'done', outputPath: data.outputPath, size: encryptedSize })
    return
  }

  const zipSize = (await stat(data.zipPath)).size
  parentPort?.postMessage({ type: 'done', outputPath: data.zipPath, size: zipSize })
}

void main().catch((error) => {
  parentPort?.postMessage({
    type: 'error',
    error: error instanceof Error ? error.message : 'Backup worker failed'
  })
})
