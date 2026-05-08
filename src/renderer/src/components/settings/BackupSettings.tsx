import { type JSX, useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  Clock,
  Cloud,
  CloudOff,
  HardDrive,
  Loader2,
  RefreshCw,
  RotateCcw,
  Shield,
  Trash2,
  UploadCloud
} from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { cn } from '../../lib/utils'

interface BackupInfo {
  id: string
  name: string
  size: number
  createdAt: string
  encrypted: boolean
}

interface BackupProgress {
  phase: string
  percent: number
  message?: string
}

interface BackupSettingsState {
  autoBackupEnabled: boolean
  autoBackupIntervalHours: number
  encryptBackups: boolean
  autoSyncGeneratedVideos: boolean
  lastBackupAt: number | null
  lastBackupSize: number | null
  lastBackupDriveFileId: string | null
  driveQuota?: {
    usage: number
    limit: number | null
    usageInDrive: number
  } | null
}

interface AuthStatus {
  authenticated: boolean
  email: string | null
}

type BusyAction = 'connect' | 'disconnect' | 'backup' | 'restore' | 'delete' | 'refresh' | null

const DEFAULT_SETTINGS: BackupSettingsState = {
  autoBackupEnabled: false,
  autoBackupIntervalHours: 24,
  encryptBackups: false,
  autoSyncGeneratedVideos: false,
  lastBackupAt: null,
  lastBackupSize: null,
  lastBackupDriveFileId: null,
  driveQuota: null
}

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

function formatDate(value: string | number | null | undefined): string {
  if (!value) return 'Never'
  const date = typeof value === 'number' ? new Date(value) : new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date)
}

function ProgressBar({ progress }: { progress: BackupProgress | null }): JSX.Element | null {
  if (!progress) return null

  return (
    <div className="space-y-2 rounded-lg border border-border-subtle bg-bg-secondary/40 p-3">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="capitalize text-text-secondary">{progress.phase}</span>
        <span className="font-medium text-text-primary">{Math.round(progress.percent)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-bg-primary">
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${Math.max(0, Math.min(100, progress.percent))}%` }}
        />
      </div>
      {progress.message ? <p className="text-[11px] text-text-muted">{progress.message}</p> : null}
    </div>
  )
}

export function BackupSettings(): JSX.Element {
  const [auth, setAuth] = useState<AuthStatus>({ authenticated: false, email: null })
  const [settings, setSettings] = useState<BackupSettingsState>(DEFAULT_SETTINGS)
  const [backups, setBackups] = useState<BackupInfo[]>([])
  const [password, setPassword] = useState('')
  const [restorePasswords, setRestorePasswords] = useState<Record<string, string>>({})
  const [backupProgress, setBackupProgress] = useState<BackupProgress | null>(null)
  const [restoreProgress, setRestoreProgress] = useState<BackupProgress | null>(null)
  const [busy, setBusy] = useState<BusyAction>('refresh')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const quotaRatio = useMemo(() => {
    const quota = settings.driveQuota
    if (!quota?.limit) return 0
    return Math.min(quota.usage / quota.limit, 1)
  }, [settings.driveQuota])

  const loadBackupState = async (): Promise<void> => {
    if (!window.manthan) return
    setBusy((current) => current ?? 'refresh')
    try {
      const [nextAuth, nextSettings] = await Promise.all([
        window.manthan.isGoogleAuthenticated(),
        window.manthan.getBackupSettings()
      ])
      setAuth(nextAuth)
      setSettings({ ...DEFAULT_SETTINGS, ...nextSettings })
      if (nextAuth.authenticated) {
        setBackups(await window.manthan.listBackups())
      } else {
        setBackups([])
      }
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Could not load backup settings.')
    } finally {
      setBusy((current) => (current === 'refresh' ? null : current))
    }
  }

  useEffect(() => {
    void loadBackupState()
    const unsubscribeBackup = window.manthan?.onBackupProgress((payload) => {
      setBackupProgress(payload)
    })
    const unsubscribeRestore = window.manthan?.onRestoreProgress((payload) => {
      setRestoreProgress(payload)
    })

    return () => {
      unsubscribeBackup?.()
      unsubscribeRestore?.()
    }
  }, [])

  const updateSettings = async (
    next: Partial<BackupSettingsState> & { sessionPassword?: string }
  ): Promise<void> => {
    const optimistic = { ...settings, ...next }
    delete (optimistic as { sessionPassword?: string }).sessionPassword
    setSettings(optimistic)
    const saved = await window.manthan.setBackupSettings(next)
    setSettings({ ...DEFAULT_SETTINGS, ...saved })
  }

  const handleConnect = async (): Promise<void> => {
    setBusy('connect')
    setStatusMessage(null)
    try {
      await window.manthan.authenticateGoogle()
      await loadBackupState()
      setStatusMessage('Google Drive connected.')
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Google Drive connection failed.')
    } finally {
      setBusy(null)
    }
  }

  const handleDisconnect = async (): Promise<void> => {
    if (!window.confirm('Disconnect Google Drive backups from this device?')) return
    setBusy('disconnect')
    setStatusMessage(null)
    try {
      await window.manthan.disconnectGoogle()
      await loadBackupState()
      setStatusMessage('Google Drive disconnected.')
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Could not disconnect Google Drive.')
    } finally {
      setBusy(null)
    }
  }

  const handleBackupNow = async (): Promise<void> => {
    if (settings.encryptBackups && !password.trim()) {
      setStatusMessage('Enter a backup password before creating an encrypted backup.')
      return
    }

    setBusy('backup')
    setBackupProgress({ phase: 'packaging', percent: 0, message: 'Starting backup' })
    setStatusMessage(null)
    try {
      const result = await window.manthan.createBackup({
        encrypt: settings.encryptBackups,
        password: settings.encryptBackups ? password : undefined
      })
      setStatusMessage(`Backup uploaded: ${formatBytes(result.size)}.`)
      await loadBackupState()
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Backup failed.')
    } finally {
      setBusy(null)
    }
  }

  const handleRestore = async (backup: BackupInfo): Promise<void> => {
    const restorePassword = restorePasswords[backup.id] ?? ''
    if (backup.encrypted && !restorePassword.trim()) {
      setStatusMessage('Enter the password for this encrypted backup.')
      return
    }

    setBusy('restore')
    setRestoreProgress({ phase: 'downloading', percent: 0, message: 'Starting restore' })
    setStatusMessage(null)
    try {
      const result = await window.manthan.restoreBackup(
        backup.id,
        backup.encrypted ? restorePassword : undefined
      )
      if (result.canceled) {
        setStatusMessage('Restore canceled.')
      } else {
        setStatusMessage(
          `Restored ${result.restoredProjects} project(s), ${result.restoredGenerations} generation(s), and ${result.restoredAssets} asset(s).`
        )
      }
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Restore failed.')
    } finally {
      setBusy(null)
    }
  }

  const handleDelete = async (backup: BackupInfo): Promise<void> => {
    if (!window.confirm(`Delete ${backup.name} from Google Drive?`)) return
    setBusy('delete')
    setStatusMessage(null)
    try {
      await window.manthan.deleteBackup(backup.id)
      setBackups((current) => current.filter((item) => item.id !== backup.id))
      setStatusMessage('Backup deleted.')
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Could not delete backup.')
    } finally {
      setBusy(null)
    }
  }

  const connected = auth.authenticated

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-border-subtle bg-bg-elevated/30 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg border',
                connected
                  ? 'border-success/30 bg-success/10 text-success'
                  : 'border-border-subtle bg-bg-secondary text-text-muted'
              )}
            >
              {connected ? <Cloud className="h-5 w-5" /> : <CloudOff className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text-primary">
                {connected ? `Connected as ${auth.email ?? 'Google user'}` : 'Not connected'}
              </p>
              <p className="text-xs text-text-muted">Manthan Studio Backups</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {connected ? (
              <Button
                variant="outline"
                size="sm"
                disabled={busy === 'disconnect'}
                onClick={() => void handleDisconnect()}
              >
                {busy === 'disconnect' ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CloudOff className="mr-1.5 h-3.5 w-3.5" />
                )}
                Disconnect
              </Button>
            ) : (
              <Button size="sm" disabled={busy === 'connect'} onClick={() => void handleConnect()}>
                {busy === 'connect' ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Cloud className="mr-1.5 h-3.5 w-3.5" />
                )}
                Connect
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              disabled={busy === 'refresh'}
              onClick={() => void loadBackupState()}
            >
              <RefreshCw
                className={cn('mr-1.5 h-3.5 w-3.5', busy === 'refresh' && 'animate-spin')}
              />
              Refresh
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr,280px]">
        <div className="space-y-4 rounded-lg border border-border-subtle bg-bg-elevated/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                <UploadCloud className="h-4 w-4 text-text-muted" />
                Backup
              </div>
              <p className="mt-1 text-xs text-text-muted">
                Last backup: {formatDate(settings.lastBackupAt)}
                {settings.lastBackupSize ? ` (${formatBytes(settings.lastBackupSize)})` : ''}
              </p>
            </div>
            <Button
              size="sm"
              disabled={!connected || busy === 'backup'}
              onClick={() => void handleBackupNow()}
            >
              {busy === 'backup' ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <UploadCloud className="mr-1.5 h-3.5 w-3.5" />
              )}
              Backup Now
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex items-start gap-3 rounded-lg border border-border-subtle bg-bg-secondary/30 p-3">
              <input
                type="checkbox"
                className="mt-1"
                checked={settings.encryptBackups}
                onChange={(event) =>
                  void updateSettings({
                    encryptBackups: event.target.checked,
                    sessionPassword: event.target.checked ? password : ''
                  })
                }
              />
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-sm text-text-primary">
                  <Shield className="h-4 w-4 text-text-muted" />
                  Encrypt backups
                </span>
                <span className="mt-1 block text-xs leading-5 text-text-muted">
                  Password required during restore.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3 rounded-lg border border-border-subtle bg-bg-secondary/30 p-3">
              <input
                type="checkbox"
                className="mt-1"
                checked={settings.autoBackupEnabled}
                onChange={(event) =>
                  void updateSettings({ autoBackupEnabled: event.target.checked })
                }
              />
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-sm text-text-primary">
                  <Clock className="h-4 w-4 text-text-muted" />
                  Auto-backup
                </span>
                <span className="mt-2 flex items-center gap-2">
                  <Input
                    type="number"
                    min="1"
                    value={settings.autoBackupIntervalHours}
                    disabled={!settings.autoBackupEnabled}
                    onChange={(event) =>
                      void updateSettings({
                        autoBackupIntervalHours: Number(event.target.value) || 24
                      })
                    }
                    className="h-8 w-20 rounded-md border border-border-subtle bg-bg-input text-xs"
                  />
                  <span className="text-xs text-text-muted">hours</span>
                </span>
              </span>
            </label>
          </div>

          {settings.encryptBackups ? (
            <Input
              type="password"
              value={password}
              onChange={(event) => {
                const nextPassword = event.target.value
                setPassword(nextPassword)
                void updateSettings({ sessionPassword: nextPassword })
              }}
              placeholder="Backup password"
              className="h-10 rounded-lg border border-border-subtle bg-bg-input text-xs"
            />
          ) : null}

          <label className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-bg-secondary/30 p-3">
            <span className="min-w-0">
              <span className="text-sm text-text-primary">Auto-backup generated videos</span>
              <span className="mt-1 block text-xs text-text-muted">Sync video outputs individually.</span>
            </span>
            <input
              type="checkbox"
              checked={settings.autoSyncGeneratedVideos}
              onChange={(event) =>
                void updateSettings({ autoSyncGeneratedVideos: event.target.checked })
              }
            />
          </label>

          <ProgressBar progress={backupProgress} />
        </div>

        <div className="space-y-4 rounded-lg border border-border-subtle bg-bg-elevated/30 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <HardDrive className="h-4 w-4 text-text-muted" />
            Google Drive
          </div>
          {settings.driveQuota ? (
            <>
              <div className="h-2 overflow-hidden rounded-full bg-bg-primary">
                <div
                  className={cn('h-full rounded-full', quotaRatio > 0.9 ? 'bg-error' : 'bg-accent')}
                  style={{ width: `${Math.max(1, quotaRatio * 100)}%` }}
                />
              </div>
              <p className="text-xs leading-5 text-text-muted">
                {formatBytes(settings.driveQuota.usage)} of{' '}
                {settings.driveQuota.limit ? formatBytes(settings.driveQuota.limit) : 'unlimited'}{' '}
                used.
              </p>
            </>
          ) : (
            <p className="text-xs leading-5 text-text-muted">
              Connect Google Drive to show storage usage.
            </p>
          )}
          {connected ? (
            <div className="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2 text-xs text-success">
              <CheckCircle2 className="h-4 w-4" />
              Ready for backups
            </div>
          ) : null}
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-border-subtle bg-bg-elevated/30 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <RotateCcw className="h-4 w-4 text-text-muted" />
            Restore
          </div>
          <span className="text-xs text-text-muted">{backups.length} backup(s)</span>
        </div>

        <ProgressBar progress={restoreProgress} />

        <div className="overflow-hidden rounded-lg border border-border-subtle">
          <table className="w-full text-left text-xs">
            <thead className="bg-bg-secondary/60 text-text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Backup</th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Size</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {backups.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-text-muted">
                    {connected ? 'No backups found.' : 'Connect Google Drive to list backups.'}
                  </td>
                </tr>
              ) : (
                backups.map((backup) => (
                  <tr key={backup.id} className="border-t border-border-subtle text-text-secondary">
                    <td className="max-w-[220px] px-3 py-3">
                      <div className="truncate text-text-primary">{backup.name}</div>
                      {backup.encrypted ? (
                        <div className="mt-1 flex items-center gap-1 text-[11px] text-text-muted">
                          <Shield className="h-3 w-3" />
                          Encrypted
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">{formatDate(backup.createdAt)}</td>
                    <td className="px-3 py-3">{formatBytes(backup.size)}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {backup.encrypted ? (
                          <Input
                            type="password"
                            value={restorePasswords[backup.id] ?? ''}
                            onChange={(event) =>
                              setRestorePasswords((current) => ({
                                ...current,
                                [backup.id]: event.target.value
                              }))
                            }
                            placeholder="Password"
                            className="h-8 w-28 rounded-md border border-border-subtle bg-bg-input text-[11px]"
                          />
                        ) : null}
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={busy === 'restore'}
                          onClick={() => void handleRestore(backup)}
                        >
                          {busy === 'restore' ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          ) : (
                            <RotateCcw className="mr-1 h-3 w-3" />
                          )}
                          Restore
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy === 'delete'}
                          onClick={() => void handleDelete(backup)}
                        >
                          <Trash2 className="mr-1 h-3 w-3" />
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {statusMessage ? (
        <p className="rounded-lg border border-border-subtle bg-bg-secondary/40 px-3 py-2 text-xs text-text-secondary">
          {statusMessage}
        </p>
      ) : null}
    </div>
  )
}
