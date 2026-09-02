// 会话侧边栏 — 新建 / 选择 / 删除

import { useStore } from '../../store'

export default function Sidebar() {
  const conversations = useStore((s) => s.conversations)
  const activeId = useStore((s) => s.activeId)
  const newChat = useStore((s) => s.newChat)
  const selectChat = useStore((s) => s.selectChat)
  const deleteChat = useStore((s) => s.deleteChat)

  return (
    <aside className="w-56 shrink-0 border-r border-[var(--c-border)] bg-[var(--c-sidebar)] flex flex-col">
      <div className="p-2">
        <button
          onClick={newChat}
          className="w-full px-2 py-1.5 text-sm rounded bg-emerald-700 hover:bg-emerald-600 text-white"
        >
          + 新建对话
        </button>
      </div>
      <div className="flex-1 overflow-auto px-1 pb-2 space-y-0.5">
        {conversations.length === 0 && (
          <p className="text-xs text-[var(--c-faint)] px-2 py-1">暂无对话</p>
        )}
        {conversations.map((c) => (
          <div
            key={c.id}
            onClick={() => selectChat(c.id)}
            className={`group flex items-center gap-1 px-2 py-1.5 rounded text-sm cursor-pointer ${
              c.id === activeId ? 'bg-[var(--c-btn-hover)]' : 'hover:bg-[var(--c-btn)]'
            }`}
          >
            <span className="flex-1 truncate text-[var(--c-text)]">{c.title || '新对话'}</span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                deleteChat(c.id)
              }}
              className="opacity-0 group-hover:opacity-100 text-xs px-1 text-[var(--c-faint)] hover:text-red-400"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </aside>
  )
}
