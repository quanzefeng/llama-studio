import { create } from 'zustand'
import type {
  ServerConfig,
  SamplingConfig,
  ServerStatus,
  LaunchConfig,
  Theme,
  Conversation,
  ChatMessage,
  Attachment,
} from '@shared/types'
import { defaultServerConfig, defaultSampling } from '@shared/defaults'

const THEME_KEY = 'llama-studio-theme'
const CONV_KEY = 'llama-studio-conversations'

function loadTheme(): Theme {
  try {
    const t = localStorage.getItem(THEME_KEY)
    if (t === 'dark') return 'dark' // 用户显式存过偏好则尊重
    return 'light' // 默认浅色(SaaS 主视觉)
  } catch {
    return 'light'
  }
}

function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(CONV_KEY)
    return raw ? (JSON.parse(raw) as Conversation[]) : []
  } catch {
    return []
  }
}

function persistConversations(convs: Conversation[]): void {
  try {
    // 落盘前降级附件内容(内存态保留完整载荷,发送链路不受影响)
    localStorage.setItem(CONV_KEY, JSON.stringify(convs.map(downgradeConversation)))
  } catch (e) {
    console.error('persist conversations failed', e)
  }
}

/** 附件内容降级:仅 text 且 ≤64KB 保留全文;image/binary 只存元数据(防 localStorage 5MB 上限) */
function downgradeAttachments(atts?: Attachment[]): Attachment[] | undefined {
  if (!atts || atts.length === 0) return atts
  return atts.map((a) =>
    a.kind === 'text' && a.content.length <= 64 * 1024
      ? a
      : { ...a, content: '' },
  )
}

/** 持久化前对整条会话降级附件内容 */
function downgradeConversation(c: Conversation): Conversation {
  return {
    ...c,
    messages: c.messages.map((m) => ({
      ...m,
      attachments: downgradeAttachments(m.attachments),
    })),
  }
}

function newId(): string {
  return (globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random()}`)
}

/** 采样参数自动保存防抖(用户改温度/推理强度等即落盘,无需等点启动) */
let samplingSaveTimer: ReturnType<typeof setTimeout> | null = null

interface AppState {
  // ---- config / server ----
  config: ServerConfig
  sampling: SamplingConfig
  status: ServerStatus
  logs: string[]
  dirty: boolean
  setLaunch: (patch: Partial<LaunchConfig>) => void
  setConfig: (c: ServerConfig) => void
  setSampling: (patch: Partial<SamplingConfig>) => void
  setStatus: (s: ServerStatus) => void
  addLog: (line: string) => void
  clearLogs: () => void
  markClean: () => void
  markDirty: () => void
  loadFromDisk: () => Promise<void>
  persist: () => Promise<void>

  // ---- theme ----
  theme: Theme
  toggleTheme: () => void

  // ---- conversations ----
  conversations: Conversation[]
  activeId: string | null
  newChat: () => void
  selectChat: (id: string) => void
  deleteChat: (id: string) => void
  /** 添加用户消息 + 预占一个空 assistant 消息;若无活跃会话则新建;返回写入的会话 id */
  addUserMessage: (content: string, attachments?: Attachment[]) => string
  /** 按 convId 定位会话,用解析后的完整 content/reasoning 覆盖该会话最后一条 assistant 消息(流式增量用) */
  setActiveAssistant: (convId: string, patch: { content?: string; reasoning?: string; tokens?: number; durationMs?: number; tokensPerSec?: number }) => void
  /** 流式结束后落盘 */
  finalizeActive: (convId?: string) => void
  /** 删除指定会话中的某条消息 */
  deleteMessage: (convId: string, msgIndex: number) => void
  /** 在会话末尾追加一条空的 assistant 消息(重新生成用) */
  appendAssistantPlaceholder: (convId: string) => void
}

export const useStore = create<AppState>((set, get) => ({
  config: defaultServerConfig(),
  sampling: defaultSampling(),
  status: 'idle',
  logs: [],
  dirty: false,

  setLaunch: (patch) =>
    set((s) => ({
      config: { ...s.config, launch: { ...s.config.launch, ...patch } },
      dirty: s.status !== 'idle' ? true : s.dirty,
    })),

  setConfig: (c) => set({ config: c, dirty: false }),

  setSampling: (patch) => {
    set((s) => ({ sampling: { ...s.sampling, ...patch } }))
    // 防抖自动保存,500ms 内连续改动只写一次
    if (samplingSaveTimer != null) clearTimeout(samplingSaveTimer)
    samplingSaveTimer = setTimeout(() => {
      try {
        void window.api.sampling.save(get().sampling).catch((e) => {
          console.error('[store] auto-save sampling failed', e)
        })
      } catch (e) {
        console.error('[store] auto-save sampling failed', e)
      }
    }, 500)
  },

  setStatus: (status) => set({ status }),

  addLog: (line) => set((s) => ({ logs: [...s.logs, line].slice(-2000) })),
  clearLogs: () => set({ logs: [] }),
  markClean: () => set({ dirty: false }),
  markDirty: () => set({ dirty: true }),

  loadFromDisk: async () => {
    const [config, sampling] = await Promise.all([
      window.api.config.load(),
      window.api.sampling.load(),
    ])
    set({ config, sampling, dirty: false })
  },

  persist: async () => {
    const { config, sampling } = get()
    await Promise.all([
      window.api.config.save(config),
      window.api.sampling.save(sampling),
    ])
  },

  // ---- theme ----
  theme: loadTheme(),
  toggleTheme: () =>
    set((s) => {
      const next: Theme = s.theme === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem(THEME_KEY, next)
      } catch {
        /* ignore */
      }
      return { theme: next }
    }),

  // ---- conversations ----
  conversations: loadConversations(),
  activeId: null,

  newChat: () => {
    const conv: Conversation = {
      id: newId(),
      title: '新对话',
      createdAt: Date.now(),
      messages: [],
    }
    set((s) => {
      const convs = [conv, ...s.conversations]
      persistConversations(convs)
      return { conversations: convs, activeId: conv.id }
    })
  },

  selectChat: (id) => set({ activeId: id }),

  deleteChat: (id) =>
    set((s) => {
      const convs = s.conversations.filter((c) => c.id !== id)
      const activeId = s.activeId === id ? null : s.activeId
      persistConversations(convs)
      return { conversations: convs, activeId }
    }),

  addUserMessage: (content, attachments) => {
    let targetId: string = ''
    set((s) => {
      let convs = s.conversations
      let activeId = s.activeId
      const active = convs.find((c) => c.id === activeId)
      if (!active) {
        const conv: Conversation = {
          id: newId(),
          title: content.slice(0, 24) || '新对话',
          createdAt: Date.now(),
          messages: [],
        }
        convs = [conv, ...convs]
        activeId = conv.id
      }
      targetId = activeId!
      const convs2 = convs.map((c) => {
        if (c.id !== activeId) return c
        const title =
          c.messages.length === 0 ? content.slice(0, 24) || '新对话' : c.title
        const messages: ChatMessage[] = [
          ...c.messages,
          {
            role: 'user',
            content,
            ...(attachments && attachments.length > 0 ? { attachments } : {}),
          },
          { role: 'assistant', content: '', reasoning: '' },
        ]
        return { ...c, title, messages }
      })
      persistConversations(convs2)
      return { conversations: convs2, activeId }
    })
    return targetId
  },

  setActiveAssistant: (convId, patch) =>
    set((s) => {
      const convs = s.conversations.map((c) => {
        if (c.id !== convId) return c
        const msgs = [...c.messages]
        const last = msgs[msgs.length - 1]
        if (last && last.role === 'assistant') {
          msgs[msgs.length - 1] = {
            ...last,
            content: patch.content ??= last.content,
            reasoning: patch.reasoning ??= last.reasoning,
            tokens: patch.tokens ?? last.tokens,
            durationMs: patch.durationMs ?? last.durationMs,
            tokensPerSec: patch.tokensPerSec ?? last.tokensPerSec,
          }
        }
        return { ...c, messages: msgs }
      })
      // 不落盘(流式高频),由 finalizeActive 落盘
      return { conversations: convs }
    }),

  finalizeActive: (_convId?: string) => {
    const { conversations } = get()
    persistConversations(conversations)
  },

  deleteMessage: (convId, msgIndex) =>
    set((s) => {
      const convs = s.conversations.map((c) => {
        if (c.id !== convId) return c
        const msgs = c.messages.filter((_, i) => i !== msgIndex)
        return { ...c, messages: msgs }
      })
      persistConversations(convs)
      return { conversations: convs }
    }),

  appendAssistantPlaceholder: (convId) =>
    set((s) => {
      const convs = s.conversations.map((c) => {
        if (c.id !== convId) return c
        return {
          ...c,
          messages: [
            ...c.messages,
            { role: 'assistant' as const, content: '', reasoning: '' },
          ],
        }
      })
      return { conversations: convs }
    }),
}))
