// ============================================================
// Manthan Studio — Centralized Logging System
// Level-gated, category-tagged, and dev-mode aware logger
// ============================================================

import { app } from 'electron'
import { is } from '@electron-toolkit/utils'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent'
export type LogCategory = 'DB' | 'IPC' | 'Queue' | 'Provider' | 'Asset' | 'Storage' | 'App' | 'Migration'

const LEVEL_WEIGHTS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4
}

class Logger {
  private level: LogLevel = 'info'
  private isDev: boolean

  constructor() {
    this.isDev = is.dev || !app.isPackaged
    this.level = this.isDev ? 'debug' : 'warn'
  }

  setLevel(level: LogLevel): void {
    this.level = level
    this.info('App', `Log level set to: ${level}`)
  }

  getLevel(): LogLevel {
    return this.level
  }

  debug(category: LogCategory, message: string, data?: unknown): void {
    this.log('debug', category, message, data)
  }

  info(category: LogCategory, message: string, data?: unknown): void {
    this.log('info', category, message, data)
  }

  warn(category: LogCategory, message: string, data?: unknown): void {
    this.log('warn', category, message, data)
  }

  error(category: LogCategory, message: string, data?: unknown): void {
    this.log('error', category, message, data)
  }

  private log(level: LogLevel, category: LogCategory, message: string, data?: unknown): void {
    if (LEVEL_WEIGHTS[level] < LEVEL_WEIGHTS[this.level]) {
      return
    }

    const timestamp = new Date().toISOString().split('T')[1].split('Z')[0] // 12:34:56.789
    const prefix = `[${timestamp}] [${category}]`
    
    const maskedMessage = this.maskSensitiveData(message)
    const maskedData = data ? this.maskSensitiveData(data) : undefined

    const logFn = this.getLogFn(level)
    
    if (maskedData) {
      logFn(`${prefix} ${maskedMessage}`, maskedData)
    } else {
      logFn(`${prefix} ${maskedMessage}`)
    }
  }

  private getLogFn(level: LogLevel): (...args: any[]) => void {
    switch (level) {
      case 'debug': return console.debug || console.log
      case 'info': return console.info || console.log
      case 'warn': return console.warn
      case 'error': return console.error
      default: return console.log
    }
  }

  private maskSensitiveData(input: any): any {
    if (typeof input === 'string') {
      // Mask API keys (common patterns like AIza..., sk-..., etc.)
      return input.replace(/(AIza[0-9A-Za-z-_]{35})|(sk-[0-9A-Za-z]{32,})/g, (match) => {
        return match.substring(0, 4) + '***' + match.substring(match.length - 4)
      })
    }

    if (input && typeof input === 'object') {
      const masked: any = Array.isArray(input) ? [] : {}
      for (const key in input) {
        if (Object.prototype.hasOwnProperty.call(input, key)) {
          const lowerKey = key.toLowerCase()
          if (lowerKey.includes('key') || lowerKey.includes('token') || lowerKey.includes('secret') || lowerKey.includes('password')) {
            masked[key] = '***MASKED***'
          } else {
            masked[key] = this.maskSensitiveData(input[key])
          }
        }
      }
      return masked
    }

    return input
  }
}

export const logger = new Logger()
