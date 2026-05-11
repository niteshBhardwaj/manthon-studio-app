import { BrowserWindow } from 'electron'
import { google, type drive_v3 } from 'googleapis'
import type { OAuth2Client } from 'google-auth-library'
import { createServer, type Server } from 'http'
import type { AddressInfo } from 'net'
import { randomBytes } from 'crypto'
import { keyStore } from '../store/key-store'
import { logger } from '../logger'
import type { DriveQuota, GoogleAuthStatus } from './types'

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
const EMAIL_SCOPE = 'https://www.googleapis.com/auth/userinfo.email'
const PROFILE_SCOPE = 'https://www.googleapis.com/auth/userinfo.profile'
const BACKUP_FOLDER_NAME = 'Manthan Studio Backups'
const CALLBACK_PATH = '/oauth2callback'
const AUTH_TIMEOUT_MS = 5 * 60 * 1000

function getEffectiveConfig(): { clientId: string | null; clientSecret: string | null } {
  const stored = keyStore.getGoogleDriveConfig()
  const clientId =
    stored.clientId ??
    process.env.MANTHAN_GOOGLE_CLIENT_ID ??
    process.env.GOOGLE_DRIVE_CLIENT_ID ??
    process.env.GOOGLE_CLIENT_ID ??
    null
  const clientSecret =
    stored.clientSecret ??
    process.env.MANTHAN_GOOGLE_CLIENT_SECRET ??
    process.env.GOOGLE_DRIVE_CLIENT_SECRET ??
    process.env.GOOGLE_CLIENT_SECRET ??
    null

  return { clientId, clientSecret }
}

function getOAuthConfig(): { clientId: string; clientSecret: string } {
  const { clientId, clientSecret } = getEffectiveConfig()

  if (!clientId || !clientSecret) {
    throw new Error(
      'Google Drive backup requires a Client ID and Client Secret. Please configure them in Settings.'
    )
  }

  return { clientId: clientId!, clientSecret: clientSecret! }
}

function escapeDriveQuery(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

class GoogleAuthManager {
  async authenticate(): Promise<{ accessToken: string; email: string | null; folderId: string }> {
    const state = randomBytes(16).toString('hex')
    const callback = await this.createCallbackServer(state)
    const redirectUri = `http://127.0.0.1:${callback.port}${CALLBACK_PATH}`
    const client = this.createOAuthClient(redirectUri)
    const authUrl = client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [DRIVE_SCOPE, EMAIL_SCOPE, PROFILE_SCOPE],
      state
    })

    const authWindow = new BrowserWindow({
      width: 560,
      height: 720,
      title: 'Connect Google Drive',
      show: true,
      parent: BrowserWindow.getFocusedWindow() ?? undefined,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true
      }
    })

    try {
      await authWindow.loadURL(authUrl)
      const code = await this.waitForCode(callback.server, callback.codePromise, authWindow)
      const { tokens } = await client.getToken(code)
      if (!tokens.refresh_token) {
        throw new Error(
          'Google did not return a refresh token. Disconnect the app in Google Account permissions, then connect again.'
        )
      }

      client.setCredentials(tokens)
      const oauth2 = google.oauth2({ version: 'v2', auth: client })
      const userInfo = await oauth2.userinfo.get()
      const email = userInfo.data.email ?? null
      keyStore.saveGoogleDriveCredentials({
        refreshToken: tokens.refresh_token,
        accountEmail: email
      })

      const folderId = await this.ensureBackupFolder(client)
      keyStore.setGoogleDriveFolderId(folderId)
      const accessToken = tokens.access_token ?? (await this.getAccessToken())
      return { accessToken, email, folderId }
    } finally {
      callback.server.close()
      if (!authWindow.isDestroyed()) authWindow.close()
    }
  }

  async getAccessToken(): Promise<string> {
    const client = this.createAuthorizedClient()
    const response = await client.getAccessToken()
    const token = typeof response === 'string' ? response : response?.token
    if (!token) throw new Error('Unable to refresh Google Drive access token.')
    return token
  }

  async getDriveClient(): Promise<drive_v3.Drive> {
    const client = this.createAuthorizedClient()
    await client.getAccessToken()
    return google.drive({ version: 'v3', auth: client })
  }

  async isAuthenticated(): Promise<GoogleAuthStatus & { hasConfig: boolean; clientId?: string | null }> {
    const config = getEffectiveConfig()
    const hasConfig = !!(config.clientId && config.clientSecret)
    const refreshToken = keyStore.getGoogleDriveRefreshToken()

    if (!refreshToken) return { authenticated: false, email: null, hasConfig, clientId: config.clientId }

    try {
      await this.getAccessToken()
      return {
        authenticated: true,
        email: keyStore.getGoogleDriveAccountEmail(),
        hasConfig,
        clientId: config.clientId
      }
    } catch (error) {
      logger.warn('Backup', 'Stored Google Drive token could not be refreshed:', error)
      return {
        authenticated: false,
        email: keyStore.getGoogleDriveAccountEmail(),
        hasConfig,
        clientId: config.clientId
      }
    }
  }

  async disconnect(): Promise<{ success: boolean }> {
    const refreshToken = keyStore.getGoogleDriveRefreshToken()
    if (refreshToken) {
      try {
        const client = this.createOAuthClient('http://127.0.0.1')
        await client.revokeToken(refreshToken)
      } catch (error) {
        logger.warn('Backup', 'Failed to revoke Google Drive refresh token:', error)
      }
    }

    keyStore.clearGoogleDriveCredentials()
    return { success: true }
  }

  async getBackupFolderId(): Promise<string> {
    const client = this.createAuthorizedClient()
    await client.getAccessToken()
    return this.ensureBackupFolder(client)
  }

  async getStorageQuota(): Promise<DriveQuota | null> {
    try {
      const drive = await this.getDriveClient()
      const response = await drive.about.get({
        fields: 'storageQuota(limit,usage,usageInDrive)'
      })
      const quota = response.data.storageQuota
      if (!quota) return null

      return {
        usage: Number(quota.usage ?? 0),
        limit: quota.limit ? Number(quota.limit) : null,
        usageInDrive: Number(quota.usageInDrive ?? 0)
      }
    } catch (error) {
      logger.warn('Backup', 'Failed to load Google Drive quota:', error)
      return null
    }
  }

  private createOAuthClient(redirectUri: string): OAuth2Client {
    const { clientId, clientSecret } = getOAuthConfig()
    return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
  }

  private createAuthorizedClient(): OAuth2Client {
    const refreshToken = keyStore.getGoogleDriveRefreshToken()
    if (!refreshToken) throw new Error('Google Drive is not connected.')

    const client = this.createOAuthClient('http://127.0.0.1')
    client.setCredentials({ refresh_token: refreshToken })
    return client
  }

  private async ensureBackupFolder(client: OAuth2Client): Promise<string> {
    const drive = google.drive({ version: 'v3', auth: client })
    const storedFolderId = keyStore.getGoogleDriveFolderId()

    if (storedFolderId) {
      try {
        const existing = await drive.files.get({
          fileId: storedFolderId,
          fields: 'id,name,trashed'
        })
        if (existing.data.id && !existing.data.trashed) return existing.data.id
      } catch {
        keyStore.setGoogleDriveFolderId(null)
      }
    }

    const listResponse = await drive.files.list({
      q: `mimeType='application/vnd.google-apps.folder' and name='${escapeDriveQuery(
        BACKUP_FOLDER_NAME
      )}' and trashed=false`,
      spaces: 'drive',
      fields: 'files(id,name)',
      pageSize: 10
    })
    const found = listResponse.data.files?.[0]?.id
    if (found) {
      keyStore.setGoogleDriveFolderId(found)
      return found
    }

    const createResponse = await drive.files.create({
      requestBody: {
        name: BACKUP_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
        appProperties: {
          createdBy: 'manthan-studio',
          purpose: 'backups'
        }
      },
      fields: 'id'
    })

    const folderId = createResponse.data.id
    if (!folderId) throw new Error('Google Drive folder creation did not return an id.')
    keyStore.setGoogleDriveFolderId(folderId)
    return folderId
  }

  private async createCallbackServer(
    expectedState: string
  ): Promise<{ server: Server; port: number; codePromise: Promise<string> }> {
    let resolveCode: (code: string) => void = () => undefined
    let rejectCode: (error: Error) => void = () => undefined
    const codePromise = new Promise<string>((resolve, reject) => {
      resolveCode = resolve
      rejectCode = reject
    })

    const server = createServer((request, response) => {
      try {
        const callbackUrl = new URL(request.url ?? '', `http://${request.headers.host}`)
        if (callbackUrl.pathname !== CALLBACK_PATH) {
          response.writeHead(404)
          response.end('Not found')
          return
        }

        const state = callbackUrl.searchParams.get('state')
        const code = callbackUrl.searchParams.get('code')
        const error = callbackUrl.searchParams.get('error')
        if (error) throw new Error(error)
        if (state !== expectedState) throw new Error('OAuth state mismatch.')
        if (!code) throw new Error('OAuth callback did not include a code.')

        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        response.end('<p>Google Drive is connected. You can close this window.</p>')
        resolveCode(code)
      } catch (error) {
        response.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
        response.end('<p>Google Drive connection failed. You can close this window.</p>')
        rejectCode(error instanceof Error ? error : new Error('Google Drive connection failed.'))
      }
    })

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve)
    })

    const address = server.address() as AddressInfo
    return { server, port: address.port, codePromise }
  }

  private waitForCode(
    server: Server,
    codePromise: Promise<string>,
    authWindow: BrowserWindow
  ): Promise<string> {
    const closedPromise = new Promise<string>((_resolve, reject) => {
      authWindow.on('closed', () => reject(new Error('Google Drive connection was canceled.')))
    })
    const timeoutPromise = new Promise<string>((_resolve, reject) => {
      setTimeout(() => reject(new Error('Google Drive connection timed out.')), AUTH_TIMEOUT_MS)
    })

    server.on('close', () => {
      if (!authWindow.isDestroyed()) authWindow.close()
    })

    return Promise.race([codePromise, closedPromise, timeoutPromise])
  }
}

export const googleAuth = new GoogleAuthManager()
