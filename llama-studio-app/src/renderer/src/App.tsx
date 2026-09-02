import { useEffect, useState } from 'react'
import ControlPanel from './pages/ControlPanel'
import Chat from './pages/Chat'
import LogConsole from './pages/LogConsole'
import ParamGuide from './pages/ParamGuide'
import StatusBadge from './components/StatusBadge'
import { useStore } from './store'

type Tab = 'control' | 'chat' | 'log' | 'guide'

const TABS: { id: Tab; label: string }[] = [
  { id: 'control', label: '控制台' },
  { id: 'chat', label: '对话' },
  { id: 'log', label: '日志' },
  { id: 'guide', label: '参数详解' },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('control')
  const theme = useStore((s) => s.theme)
  const toggleTheme = useStore((s) => s.toggleTheme)
  const loadFromDisk = useStore((s) => s.loadFromDisk)
  const addLog = useStore((s) => s.addLog)
  const setStatus = useStore((s) => s.setStatus)

  useEffect(() => {
    void loadFromDisk()
    const offLog = window.api.llama.onLog((line) => addLog(line))
    const offStatus = window.api.llama.onStatus((s) => setStatus(s))
    return () => {
      offLog()
      offStatus()
    }
  }, [loadFromDisk, addLog, setStatus])

  // 主题 class 挂到 <html>,让 body 也能读到 CSS 变量
  useEffect(() => {
    const el = document.documentElement
    el.classList.remove('theme-dark', 'theme-light')
    el.classList.add(theme === 'dark' ? 'theme-dark' : 'theme-light')
  }, [theme])

  return (
    <div className="h-screen flex flex-col bg-[var(--c-bg)] text-[var(--c-text)]">
      <header className="flex items-center gap-2 px-4 h-12 border-b border-[var(--c-border)] shrink-0">
        <span className="font-bold tracking-tight">Llama Studio</span>
        <nav className="flex gap-1 ml-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1 rounded text-sm transition ${
                tab === t.id
                  ? 'bg-[var(--c-btn-hover)] text-[var(--c-text)]'
                  : 'text-[var(--c-muted)] hover:bg-[var(--c-btn)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <StatusBadge />
          <button
            onClick={toggleTheme}
            title="切换深/浅色"
            className="px-2 py-1 rounded text-sm bg-[var(--c-btn)] hover:bg-[var(--c-btn-hover)]"
          >
            {theme === 'dark' ? '☀ 浅色' : '🌙 深色'}
          </button>
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        {tab === 'control' ? (
          <ControlPanel />
        ) : tab === 'chat' ? (
          <Chat />
        ) : tab === 'log' ? (
          <LogConsole />
        ) : (
          <ParamGuide />
        )}
      </main>
    </div>
  )
}
