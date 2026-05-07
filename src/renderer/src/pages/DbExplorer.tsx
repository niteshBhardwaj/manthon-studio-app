import { useState, useEffect, useCallback, type JSX } from 'react'
import { 
  Database, 
  Play, 
  Table as TableIcon, 
  RefreshCw, 
  Terminal, 
  Info,
  DatabaseZap,
  HardDrive
} from 'lucide-react'

interface DbTable {
  name: string
  row_count: number
}

interface ColumnInfo {
  name: string
  type: string
  notnull: number
  pk: number
}

export function DbExplorer(): JSX.Element {
  const [tables, setTables] = useState<DbTable[]>([])
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [columns, setColumns] = useState<ColumnInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dbPath, setDbPath] = useState('')
  const [logLevel, setLogLevel] = useState('info')

  const refreshTables = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      console.log('[DbExplorer] Refreshing tables...')
      const data = await window.manthan.getDbTables()
      console.log('[DbExplorer] Tables received:', data)
      setTables(data || [])
      
      const path = await window.manthan.getDbPath()
      setDbPath(path)
      
      const level = await window.manthan.getLogLevel()
      setLogLevel(level)
    } catch (err: any) {
      console.error('[DbExplorer] Failed to fetch tables:', err)
      setError(`Failed to fetch tables: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshTables()
  }, [refreshTables])

  const inspectTable = async (tableName: string) => {
    setSelectedTable(tableName)
    setLoading(true)
    setError(null)
    try {
      const info = await window.manthan.getDbTableInfo(tableName)
      setColumns(info)
      
      const sql = `SELECT * FROM ${tableName} LIMIT 50`
      setQuery(sql)
      const data = await window.manthan.queryDb(sql)
      setResults(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const runQuery = async () => {
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    try {
      const data = await window.manthan.queryDb(query)
      setResults(data)
      if (data.length > 0) {
        // Derive columns from results if not selecting a specific table
        const keys = Object.keys(data[0])
        setColumns(keys.map(k => ({ name: k, type: 'any', notnull: 0, pk: 0 })))
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleLogLevelChange = async (level: string) => {
    await window.manthan.setLogLevel(level)
    setLogLevel(level)
  }

  return (
    <div className="flex flex-col h-full bg-[#0d0e12] text-slate-300 font-sans p-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
            <DatabaseZap className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Database Explorer</h1>
            <p className="text-xs text-slate-500 flex items-center gap-2">
              <HardDrive className="w-3 h-3" />
              {dbPath}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-slate-900/50 p-1.5 rounded-lg border border-white/5">
          <span className="text-xs font-medium px-3 text-slate-400">Log Level</span>
          {['debug', 'info', 'warn', 'error'].map(level => (
            <button
              key={level}
              onClick={() => handleLogLevelChange(level)}
              className={`px-3 py-1 rounded-md text-[10px] uppercase tracking-wider font-bold transition-all ${
                logLevel === level 
                  ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' 
                  : 'hover:bg-white/5 text-slate-500'
              }`}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Sidebar - Tables List */}
        <div className="w-72 flex flex-col gap-4">
          <div className="bg-slate-900/40 rounded-2xl border border-white/5 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">Tables</h2>
              <button onClick={refreshTables} className="p-1 hover:bg-white/5 rounded-md text-slate-500">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {tables.map(table => (
                <button
                  key={table.name}
                  onClick={() => inspectTable(table.name)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl transition-all mb-1 ${
                    selectedTable === table.name 
                      ? 'bg-amber-500/10 border border-amber-500/30 text-amber-500' 
                      : 'hover:bg-white/5 border border-transparent text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <TableIcon className="w-4 h-4 opacity-50" />
                    <span className="text-sm font-medium">{table.name}</span>
                  </div>
                  <span className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-slate-500">
                    {table.row_count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Quick Info */}
          <div className="bg-amber-500/5 rounded-2xl border border-amber-500/10 p-4">
            <div className="flex items-center gap-2 mb-2 text-amber-500/80">
              <Info className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Safety Note</span>
            </div>
            <p className="text-xs leading-relaxed text-slate-500">
              This explorer is <strong>read-only</strong>. Only SELECT queries are permitted to prevent accidental data loss.
            </p>
          </div>
        </div>

        {/* Main Workspace */}
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          {/* Query Editor */}
          <div className="bg-[#050507] rounded-2xl border border-white/5 p-4 flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-500">
                <Terminal className="w-4 h-4" />
                <span className="text-xs font-mono">SQL Console</span>
              </div>
              <button 
                onClick={runQuery}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm transition-all disabled:opacity-50"
              >
                <Play className="w-4 h-4 fill-current" />
                Execute Query
              </button>
            </div>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="SELECT * FROM generations ORDER BY created_at DESC LIMIT 10"
              className="w-full h-32 bg-transparent border-none focus:ring-0 text-amber-200/90 font-mono text-sm resize-none placeholder:text-slate-700"
            />
          </div>

          {/* Results Table */}
          <div className="flex-1 bg-slate-900/20 rounded-2xl border border-white/5 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-4">
                <h2 className="text-sm font-bold text-white">Results</h2>
                {loading && <RefreshCw className="w-4 h-4 text-amber-500 animate-spin" />}
                {results.length > 0 && (
                  <span className="text-xs text-slate-500">{results.length} rows returned</span>
                )}
              </div>
              {error && (
                <div className="text-xs text-red-400 bg-red-400/10 px-3 py-1 rounded-full border border-red-400/20">
                  {error}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-auto">
              {results.length > 0 ? (
                <table className="w-full border-collapse text-left">
                  <thead className="sticky top-0 bg-[#0d0e12] z-10">
                    <tr>
                      {columns.map(col => (
                        <th key={col.name} className="px-4 py-3 border-b border-white/10 text-[10px] font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap">
                          {col.name}
                          <span className="block text-[8px] opacity-40 font-mono lowercase mt-0.5">{col.type}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {results.map((row, i) => (
                      <tr key={i} className="hover:bg-white/[0.02] transition-colors group">
                        {columns.map(col => {
                          const val = row[col.name];
                          let displayVal = String(val);
                          if (val === null) displayVal = 'NULL';
                          if (typeof val === 'object') displayVal = JSON.stringify(val);
                          if (displayVal.length > 100) displayVal = displayVal.substring(0, 100) + '...';
                          
                          return (
                            <td key={col.name} className="px-4 py-3 text-xs font-mono text-slate-400 whitespace-nowrap max-w-xs overflow-hidden truncate group-hover:text-amber-200/70 transition-colors">
                              {val === null ? (
                                <span className="text-slate-600 italic">null</span>
                              ) : displayVal}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : !loading && (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-4">
                  <Database className="w-12 h-12 opacity-10" />
                  <p className="text-sm">No data to display. Select a table or run a query.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
