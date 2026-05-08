// ============================================================
// Manthan Studio — API Logs Page
// Developer tool to inspect intercepted API payloads (Dry Run)
// ============================================================

import { type JSX, useEffect, useState } from 'react'
import { Terminal, Trash2, Search, Calendar, Cpu, Code2, ChevronRight, Copy, Check } from 'lucide-react'
import { cn } from '../lib/utils'

interface ApiLog {
  id: string
  job_id: string | null
  provider: string
  method: string
  payload: string
  created_at: number
}

export function ApiLogsPage(): JSX.Element {
  const [logs, setLogs] = useState<ApiLog[]>([])
  const [search, setSearch] = useState('')
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    })
  }

  const formatDateTime = (ts: number) => {
    return new Date(ts).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
  }

  const fetchLogs = async () => {
    try {
      const data = await window.manthan.listApiLogs(100)
      setLogs(data)
    } catch (e) {
      console.error('Failed to fetch API logs', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [])

  const handleClear = async () => {
    if (confirm('Are you sure you want to clear all API logs?')) {
      await window.manthan.clearApiLogs()
      setLogs([])
      setSelectedLogId(null)
    }
  }

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const filteredLogs = logs.filter(log => 
    log.provider.toLowerCase().includes(search.toLowerCase()) ||
    log.method.toLowerCase().includes(search.toLowerCase()) ||
    log.payload.toLowerCase().includes(search.toLowerCase())
  )

  const selectedLog = logs.find(l => l.id === selectedLogId)

  return (
    <div className="h-full flex flex-col bg-bg-primary overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-6 border-b border-border-subtle bg-bg-secondary/30">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-accent/10 text-accent ring-1 ring-accent/20">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-text-primary tracking-tight">API Dry-Run Logs</h1>
            <p className="text-sm text-text-muted">Inspect raw payloads intercepted during development</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-focus-within:text-accent transition-colors" />
            <input 
              type="text"
              placeholder="Search logs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 bg-bg-tertiary/50 border border-border-subtle rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent w-64 transition-all"
            />
          </div>
          <button 
            onClick={handleClear}
            disabled={logs.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-sm font-medium transition-colors border border-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-4 h-4" />
            Clear All
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* List View */}
        <div className={cn(
          "h-full border-r border-border-subtle bg-bg-primary/50 transition-all duration-300",
          selectedLogId ? "w-1/3" : "w-full"
        )}>
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-text-muted">
              <Terminal className="w-12 h-12 mb-4 opacity-20" />
              <p>No logs found. Enable Dry-Run and submit a prompt.</p>
            </div>
          ) : (
            <div className="overflow-y-auto h-full scrollbar-thin scrollbar-thumb-white/10">
              {filteredLogs.map(log => {
                const isActive = selectedLogId === log.id
                return (
                  <button
                    key={log.id}
                    onClick={() => setSelectedLogId(log.id)}
                    className={cn(
                      "w-full text-left px-6 py-4 border-b border-border-subtle transition-all group",
                      isActive ? "bg-accent/5 border-l-4 border-l-accent" : "hover:bg-bg-hover/30 border-l-4 border-l-transparent"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 bg-bg-tertiary rounded text-[10px] font-bold uppercase tracking-wider text-text-secondary border border-border-subtle">
                          {log.provider}
                        </span>
                        <span className="text-xs font-mono text-accent">{log.method}</span>
                      </div>
                      <span className="text-[10px] text-text-muted font-mono">
                        {formatTime(log.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-text-primary line-clamp-1 font-mono opacity-80 group-hover:opacity-100 transition-opacity">
                      {log.payload.substring(0, 100)}...
                    </p>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Detail View */}
        <div className={cn(
          "h-full flex-1 bg-bg-secondary/10 flex flex-col transition-all",
          selectedLogId ? "translate-x-0 opacity-100" : "translate-x-full opacity-0 absolute pointer-events-none"
        )}>
          {selectedLog && (
            <>
              <div className="px-8 py-6 border-b border-border-subtle bg-bg-primary/50 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-lg font-semibold text-text-primary">{selectedLog.method}</h2>
                    <span className="px-2 py-0.5 bg-accent/10 text-accent text-[11px] font-bold rounded-full border border-accent/20">
                      {selectedLog.provider}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-text-muted font-mono">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDateTime(selectedLog.created_at)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5" />
                      Log ID: {selectedLog.id.split('-')[0]}...
                    </span>
                    {selectedLog.job_id && (
                      <span className="flex items-center gap-1.5 px-1.5 py-0.5 bg-bg-tertiary rounded border border-border-subtle">
                        Job: {selectedLog.job_id.split('-')[0]}...
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleCopy(selectedLog.payload, selectedLog.id)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-bg-tertiary hover:bg-bg-hover text-text-secondary rounded-lg text-xs font-medium transition-all border border-border-subtle"
                  >
                    {copiedId === selectedLog.id ? (
                      <><Check className="w-3.5 h-3.5 text-emerald-400" /> Copied</>
                    ) : (
                      <><Copy className="w-3.5 h-3.5" /> Copy JSON</>
                    )}
                  </button>
                  <button 
                    onClick={() => setSelectedLogId(null)}
                    className="p-1.5 hover:bg-bg-hover rounded-lg text-text-muted transition-colors"
                  >
                    <ChevronRight className="w-5 h-5 rotate-180" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-8 font-mono text-sm">
                <div className="bg-bg-tertiary/30 rounded-2xl border border-border-subtle overflow-hidden relative group">
                  <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="px-2 py-1 rounded bg-black/40 text-[10px] text-white/50 border border-white/5 backdrop-blur-sm">
                      JSON
                    </div>
                  </div>
                  <pre className="p-6 overflow-x-auto text-text-secondary scrollbar-thin scrollbar-thumb-white/10 selection:bg-accent/30">
                    {JSON.stringify(JSON.parse(selectedLog.payload), null, 2)}
                  </pre>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
