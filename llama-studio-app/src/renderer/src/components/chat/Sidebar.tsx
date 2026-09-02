// 会话侧边栏 — Apple 风格极简导航

import { useStore } from '../../store'

export default function Sidebar() {
  const conversations = useStore((s) => s.conversations)
  const activeId = useStore((s) => s.activeId)
  const newChat = useStore((s) => s.newChat)
  const selectChat = useStore((s) => s.selectChat)
  const deleteChat = useStore((s) => s.deleteChat)

  return (
    <aside className="w-56 shrink-0 border-r border-[var(--c-border)] flex flex-col" style={{ background: 'var(--c-bg)' }}>
      <div className="px-3 pt-4 pb-2">
        <button
          onClick={newChat}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-[13px] font-medium text-[var(--c-muted)] bg-[var(--c-btn)] hover:bg-[var(--c-btn-hover)] rounded-xl transition-colors"
        >
          <span className="text-[var(--c-faint)] text-base">＋</span>
          <span>New Chat</span>
        </button>
      </div>
      <div className="flex-1 overflow-auto px-2 pb-3 space-y-0.5">
        {conversations.length === 0 && (
          <p className="text-[12px] text-[var(--c-faint)] px-2 py-2">No conversations yet</p>
        )}
        {conversations.map((c) => (
          <div
            key={c.id}
            onClick={() => selectChat(c.id)}
            className={`group flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] cursor-pointer transition-colors ${
              c.id === activeId
                ? 'bg-[var(--c-btn-hover)] text-[var(--c-text)]'
                : 'text-[var(--c-muted)] hover:bg-[var(--c-btn)]'
            }`}
          >
            <span className="flex-1 truncate">{c.title || 'New Chat'}</span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                deleteChat(c.id)
              }}
              className="opacity-0 group-hover:opacity-100 text-[var(--c-faint)] hover:text-red-400 transition-opacity"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </aside>
  )
}
