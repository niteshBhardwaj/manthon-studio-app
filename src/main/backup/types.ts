export type BackupProgressPhase =
  | 'packaging'
  | 'encrypting'
  | 'uploading'
  | 'downloading'
  | 'decrypting'
  | 'extracting'
  | 'restoring'

export interface BackupProgress {
  phase: BackupProgressPhase
  percent: number
  message?: string
}

export interface BackupSettings {
  autoBackupEnabled: boolean
  autoBackupIntervalHours: number
  encryptBackups: boolean
  autoSyncGeneratedVideos: boolean
  lastBackupAt: number | null
  lastBackupSize: number | null
  lastBackupDriveFileId: string | null
  driveQuota?: DriveQuota | null
}

export interface DriveQuota {
  usage: number
  limit: number | null
  usageInDrive: number
}

export interface GoogleAuthStatus {
  authenticated: boolean
  email: string | null
  hasConfig: boolean
  clientId?: string | null
}

export interface BackupInfo {
  id: string
  name: string
  size: number
  createdAt: string
  encrypted: boolean
}

export interface CreateBackupOptions {
  encrypt: boolean
  password?: string
}

export interface CreateBackupResult {
  backupId: string
  size: number
  timestamp: string
  driveFileId: string
}

export interface RestoreResult {
  restoredGenerations: number
  restoredAssets: number
  restoredProjects: number
  canceled?: boolean
}

export interface BackupManifest {
  app: 'manthan-studio'
  version: 1
  createdAt: string
  schemaVersion: number
  assetCount: number
  databaseFile: string
}
