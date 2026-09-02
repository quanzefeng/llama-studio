// 对话页 — 侧边栏 + 消息流 + SSE 流式 + 思考过程解析 + 多会话 + 附件上传 + 推理强度

import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import type {
  SamplingConfig,
  ChatMessage,
  ReasoningIntensity,
  Attachment,
} from '@shared/types'
import Sidebar from '../components/chat/Sidebar'
import { Markdown } from '../components/chat/Markdown'
import {
  AddFileButton,
  AttachmentChip,
  AttachmentTag,
} from '../components/chat/AttachmentArea'

/** 推理强度 → thinking token 预算(-1 = 不限;llama-server per-request 字段 reasoning_budget_tokens) */
const REASONING_BUDGET: Record<ReasoningIntensity, number> = {
  low: 1024,
  medium: 2048,
  high: 8192,
  max: -1,
}

/** OpenAI multimodal content:带附件 → content parts 数组 */
function toContentParts(m: ChatMessage): string | Array<{ type: string; text?: string; image_url?: { url: string } }> {
  const atts = m.attachments
  if (!atts || atts.length === 0) return m.content
  const parts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
    { type: 'text', text: m.content },
  ]
  for (const att of atts) {
    if (att.kind === 'image' && att.content) {
      parts.push({ type: 'image_url', image_url: { url: att.content } })
      parts.push({ type: 'text', text: `\n[附加图片: ${att.name}]` })
    } else if (att.kind === 'text' && att.content) {
      parts.push({ type: 'text', text: `\n\n[文件: ${att.name}]\n${att.content}` })
    } else {
      // binary 或重启后内容降级为空的附件:仅报文件名
      parts.push({ type: 'text', text: `\n[附加文件: ${att.name}(仅文件名,内容未解析)]` })
    }
  }
  return parts
}

function buildBody(msgs: ChatMessage[], s: SamplingConfig) {
  const body: Record<string, unknown> = {
    model: 'local',
    messages: msgs.map((m) => ({ role: m.role, content: toContentParts(m) })),
    stream: true,
    temperature: s.temperature,
    top_k: s.topK,
    top_p: s.topP,
    min_p: s.minP,
    repeat_penalty: s.repeatPenalty,
    repeat_last_n: s.repeatLastN,
    seed: s.seed,
    mirostat: s.mirostat,
    max_tokens: s.nPredict,
    reasoning_budget_tokens: REASONING_BUDGET[s.reasoningIntensity ?? 'high'],
  }
  // 高级采样器(per-request,为空/禁用态不发)
  if (s.typicalP < 1.0) body.typical_p = s.typicalP
  if (s.xtcProbability > 0) {
    body.xtc_probability = s.xtcProbability
    body.xtc_threshold = s.xtcThreshold
  }
  if (s.dryMultiplier > 0) {
    body.dry_multiplier = s.dryMultiplier
    body.dry_allowed_length = s.dryAllowedLength
    body.dry_penalty_last_n = s.dryPenaltyLastN
  }
  if (s.dynatempRange > 0) {
    body.dynatemp_range = s.dynatempRange
    body.dynatemp_exponent = s.dynatempExponent
  }
  if (s.topNSigma >= 0) body.top_n_sigma = s.topNSigma
  if (s.samplerOrder.trim()) {
    body.samplers = s.samplerOrder
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
  }
  return body
}

/** 从流式累积的 raw 文本里分离 <think> 思考和正文,处理未闭合 */
function parseReasoning(raw: string): { reasoning: string; content: string } {
  // 守卫:仅当去掉首尾空格后以 '<think>' 开头才做标记解析(防止正文含 thinking 子串被误切)
  if (!raw.trimStart().startsWith('<think>')) {
    return { reasoning: '', content: raw }
  }
  let reasoning = ''
  let content = ''
  let i = 0
  const TAG = '<think>'
  const CLOSE = '</think>'
  while (i < raw.length) {
    const open = raw.indexOf(TAG, i)
    if (open === -1) {
      content += raw.slice(i)
      break
    }
    content += raw.slice(i, open)
    const close = raw.indexOf(CLOSE, open + TAG.length)
    if (close === -1) {
      // 未闭合:后续都是思考
      reasoning += raw.slice(open + TAG.length)
      break
    }
    reasoning += raw.slice(open + TAG.length, close)
    i = close + CLOSE.length
  }
  return { reasoning, content }
}

// 消息行:assistant/user 均走 Markdown,推理块(💭)保持纯文本
function MessageRow({
  msg,
  streaming,
}: {
  msg: ChatMessage
  streaming?: boolean
}) {
  const isUser = msg.role === 'user'
  const hasReasoning = !!msg.reasoning && msg.reasoning.trim().length > 0
  const atts = msg.attachments ?? []

  return (
    <div className="py-4 border-b border-[var(--c-border)]">
      {!isUser && hasReasoning && (
        <div className="text-xs text-[var(--c-muted)] mb-1 whitespace-pre-wrap">
          💭 {msg.reasoning}
        </div>
      )}
      {atts.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {atts.map((a) => (
            <AttachmentTag key={a.id} att={a} />
          ))}
        </div>
      )}
      <div className="font-medium text-[var(--c-text)] leading-relaxed">
        <Markdown content={msg.content || ''} />
        {streaming && !hasReasoning && !msg.content && (
          <span className="whitespace-pre-wrap" aria-hidden>▍</span>
        )}
      </div>
    </div>
  )
}

export default function Chat() {
  const config = useStore((s) => s.config)
  const sampling = useStore((s) => s.sampling)
  const status = useStore((s) => s.status)
  const conversations = useStore((s) => s.conversations)
  const activeId = useStore((s) => s.activeId)
  const addUserMessage = useStore((s) => s.addUserMessage)
  const setActiveAssistant = useStore((s) => s.setActiveAssistant)
  const finalizeActive = useStore((s) => s.finalizeActive)

  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const pinnedRef = useRef(true)

  const active = conversations.find((c) => c.id === activeId) ?? null
  const messages = active?.messages ?? []
  const ready = status === 'ready'
  const base = `http://${config.launch.host}:${config.launch.port}`

  useEffect(() => {
    if (pinnedRef.current) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'auto' })
    }
  }, [messages])

  async function send() {
    const text = input.trim()
    // 有文本或附件且模型就绪、非流式中,即可发送
    if ((!text && attachments.length === 0) || !ready || streaming) return
    setInput('')
    const sentAtts = attachments
    setAttachments([])

    // 发给 server 的历史 = 当前消息 + 这条新 user(不含本地预占的空 assistant)
    const history: ChatMessage[] = [
      ...messages,
      { role: 'user', content: text, attachments: sentAtts.length > 0 ? sentAtts : undefined },
    ]
    const convId = addUserMessage(text, sentAtts) // store: 加 user + 空 assistant 占位(UI 立刻显示),返回会话 id
    pinnedRef.current = true
    // 立即滚底,不等 useEffect 触发
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'auto' })
    })
    setStreaming(true)

    const ctrl = new AbortController()
    abortRef.current = ctrl
    let rawBuf = ''
    let reasoningField = ''
    let curContent = ''
    // --- 节流: 累积到本地变量,周期 flush 到 store ---
    let dirty = false
    let intervalId: ReturnType<typeof setInterval> | null = null
    let stopped = false

    function flush() {
      if (stopped || !dirty) return
      dirty = false
      setActiveAssistant(convId, { content: lastContent, reasoning: lastReasoning || undefined })
    }

    let lastReasoning = ''
    let lastContent = ''

    intervalId = setInterval(flush, 50)

    try {
      const res = await fetch(`${base}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildBody(history, sampling)),
        signal: ctrl.signal,
      })
      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status} ${await res.text().catch(() => '')}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          const t = line.trim()
          if (!t.startsWith('data:')) continue
          const data = t.slice(5).trim()
          if (data === '[DONE]') {
            buf = ''
            break
          }
          try {
            const json = JSON.parse(data) as {
              choices?: { delta?: { content?: string; reasoning_content?: string } }[]
            }
            const delta = json.choices?.[0]?.delta
            if (delta) {
              if (delta.content) rawBuf += delta.content
              if (delta.reasoning_content) reasoningField += delta.reasoning_content
              // bug #4: 结构化字段优先,避免标记双重计数
              let reasoning: string | undefined
              let content: string
              if (reasoningField) {
                reasoning = reasoningField
                content = rawBuf
              } else {
                const parsed = parseReasoning(rawBuf)
                reasoning = parsed.reasoning || undefined
                content = parsed.content
              }
              lastReasoning = reasoning ?? ''
              lastContent = content
              curContent = content
              dirty = true
            }
          } catch {
            /* 跳过不完整 JSON 分片 */
          }
        }
      }
    } catch (e) {
      // catch 里先清掉 interval,停止后续 flush
      if (intervalId != null) {
        clearInterval(intervalId)
        intervalId = null
      }
      stopped = true
      const err = e as Error
      if (err.name !== 'AbortError') {
        setActiveAssistant(convId, {
          content: `${curContent}\n\n[错误] ${err.message}`.trim(),
        })
      }
    } finally {
      // 停止 interval,最终 flush 必须在 stopped=true 之前,否则被守卫吞掉
      if (intervalId != null) {
        clearInterval(intervalId)
        intervalId = null
      }
      flush()
      stopped = true
      setStreaming(false)
      abortRef.current = null
      finalizeActive(convId)
    }
  }

  function stop() {
    abortRef.current?.abort()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  return (
    <div className="h-full flex bg-[var(--c-bg)]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* 消息区 — 居中窄列 */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-auto flex justify-center"
          onScroll={(e) => {
            const el = e.currentTarget
            pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
          }}
        >
          <div className="w-full max-w-[800px] px-6 py-6">
            {messages.length === 0 ? (
              <div className="text-[var(--c-faint)] text-sm text-center mt-16">
                {ready
                  ? '输入消息开始对话'
                  : '请先在控制台启动模型,状态变为「就绪」后即可对话'}
              </div>
            ) : (
              messages.map((m, i) => (
                <MessageRow
                  key={i}
                  msg={m}
                  streaming={streaming && i === messages.length - 1}
                />
              ))
            )}
          </div>
        </div>

        {/* 输入区 — 居中窄列 + 圆角 */}
        <div className="border-t border-[var(--c-border)] bg-[var(--c-bg)]">
          <div className="max-w-[800px] mx-auto px-6 py-4">
            {/* 附件 chips 行(待发送) */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {attachments.map((a) => (
                  <AttachmentChip
                    key={a.id}
                    att={a}
                    onRemove={(id) =>
                      setAttachments((prev) => prev.filter((x) => x.id !== id))
                    }
                  />
                ))}
              </div>
            )}
            <div className="flex items-end gap-3 bg-[var(--c-input)] border border-[var(--c-border)] rounded-2xl px-4 py-3">
              <AddFileButton
                disabled={!ready || streaming}
                onAdd={(list) =>
                  setAttachments((prev) => [...prev, ...list])
                }
              />
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                disabled={!ready}
                placeholder={ready ? '输入消息...' : '模型未就绪'}
                rows={1}
                className="flex-1 bg-transparent text-sm resize-none focus:outline-none text-[var(--c-text)] placeholder:text-[var(--c-faint)] disabled:opacity-50"
              />
              {streaming ? (
                <button
                  onClick={stop}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-red-700 hover:bg-red-600 text-white text-sm shrink-0"
                >
                  ⏹
                </button>
              ) : (
                <button
                  onClick={send}
                  disabled={!ready || (!input.trim() && attachments.length === 0)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-emerald-700 hover:bg-emerald-600 text-white text-sm disabled:opacity-30 shrink-0"
                >
                  ↑
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
