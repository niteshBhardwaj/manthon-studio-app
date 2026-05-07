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
import { logger } from './logger'

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
    let rawPath = request.url.slice('asset://'.length)
    
    if (process.platform === 'win32') {
      // Remove any leading slashes that might have been added by URL parsing
      rawPath = rawPath.replace(/^\/+/, '')
      
      // If the path starts with a drive letter but no colon (e.g. "c/Users"), restore it
      if (/^[a-zA-Z]\//.test(rawPath)) {
        rawPath = rawPath[0] + ':' + rawPath.slice(1)
      }
    }
    
    rawPath = decodeURIComponent(rawPath)
    
    try {
      const fileUrl = pathToFileURL(rawPath).toString()
      return net.fetch(fileUrl)
    } catch (err) {
      logger.error('Asset', 'Error fetching asset via protocol:', { err, url: request.url })
      return new Response(null, { status: 404 })
    }
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

  logger.info('App', 'Main process initialization complete')
  
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
