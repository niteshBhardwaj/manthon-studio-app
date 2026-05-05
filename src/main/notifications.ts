import { Notification, app, nativeImage, type NativeImage } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'
import { appStore } from './store/app-store'
import type { QueueJob } from './queue/types'

function notificationsEnabled(): boolean {
  return appStore.getPreferences().notificationsEnabled !== false
}

function getNotificationIcon(): NativeImage | undefined {
  const iconPath = join(app.getAppPath(), 'resources', 'icon.png')
  if (existsSync(iconPath)) {
    return nativeImage.createFromPath(iconPath)
  }
  return undefined
}

function canNotify(): boolean {
  return notificationsEnabled() && Notification.isSupported()
}

export function notifyJobComplete(job: QueueJob): void {
  if (!canNotify()) return

  new Notification({
    title: `Generation complete`,
    body: `${job.type[0].toUpperCase()}${job.type.slice(1)} ready: ${job.model}`,
    icon: getNotificationIcon(),
    silent: false
  }).show()
}

export function notifyJobFailed(job: QueueJob): void {
  if (!canNotify()) return

  new Notification({
    title: 'Generation failed',
    body: job.error ? `Failed: ${job.error}` : `${job.type} generation failed`,
    icon: getNotificationIcon(),
    silent: false
  }).show()
}

export function notifyBatchComplete(count: number): void {
  if (!canNotify() || count < 1) return

  new Notification({
    title: 'Queue finished',
    body: `All ${count} queued job${count === 1 ? '' : 's'} completed`,
    icon: getNotificationIcon(),
    silent: false
  }).show()
}

export function notifyBudgetWarning(spent: number, limit: number): void {
  if (!canNotify()) return

  new Notification({
    title: 'Budget warning',
    body: `You've spent $${spent.toFixed(2)} of $${limit.toFixed(2)}`,
    icon: getNotificationIcon(),
    silent: false
  }).show()
}
