// 日志面板

import { useStore } from '../store'

export default function LogConsole() {
  const logs = useStore((s) => s.logs)
  const clear = useStore((s) => s.clearLogs)
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--c-border)]">
        <span className="text-sm text-[var(--c-muted)]">llama-server 日志</span>
        <button onClick={clear} className="text-xs px-2 py-1 rounded hover:bg-[var(--c-btn)]">
          清空
        </button>
      </div>
      <div className="flex-1 overflow-auto p-2 font-mono text-xs text-[var(--c-text)] bg-[var(--c-code)]">
        {logs.length === 0 ? (
          <p className="text-[var(--c-faint)]">无日志</p>
        ) : (
          logs.map((l, i) => (
            <div key={i} className="whitespace-pre-wrap break-all">
              {l}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
