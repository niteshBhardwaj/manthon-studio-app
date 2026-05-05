// ============================================================
// Manthan Studio — Main Process Entry
// Electron main process: window management, IPC, security
// ============================================================

import { app, shell, BrowserWindow, protocol, net } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registerIpcHandlers, initializeStoredProviders } from './ipc'
import { databaseManager } from './store/db'
import { assetManager } from './store/asset-manager'
import { appStore } from './store/app-store'
import { storageManager } from './store/storage-manager'
import { queueManager } from './queue/queue-manager'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0d0e12',
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    if (is.dev) {
      mainWindow.webContents.openDevTools({ mode: 'detach' })
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

protocol.registerSchemesAsPrivileged([
  { scheme: 'asset', privileges: { secure: true, standard: true, supportFetchAPI: true, bypassCSP: true } }
])

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.manthan.studio')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Register custom protocol for local asset previews
  protocol.handle('asset', (request) => {
    console.log('[asset-protocol] Request URL:', request.url)
    let rawPath = request.url.slice('asset://'.length)
    // Handle cases where the URL parser adds an extra leading slash on Windows
    if (process.platform === 'win32' && rawPath.startsWith('/')) {
      rawPath = rawPath.slice(1)
    }
    rawPath = decodeURIComponent(rawPath)
    const fileUrl = pathToFileURL(rawPath).toString()
    console.log('[asset-protocol] Resolved file URL:', fileUrl)
    return net.fetch(fileUrl)
  })

  // Initialize database & asset storage
  databaseManager.initialize()
  assetManager.initialize()
  storageManager.initialize()
  appStore.initialize()

  // Register all IPC handlers
  registerIpcHandlers()

  // Initialize providers with stored API keys
  await initializeStoredProviders()

  // Initialize persistent queue processing after storage and providers are ready
  queueManager.initialize()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Graceful database shutdown
app.on('before-quit', async () => {
  const policy = storageManager.getRetentionPolicy()
  if (policy.clearCacheOnExit) {
    await storageManager.cleanupCache()
  }
  queueManager.shutdown()
  databaseManager.close()
})
