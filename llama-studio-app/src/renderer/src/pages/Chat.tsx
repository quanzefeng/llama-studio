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

// 消息行 — Apple iMessage 风格:用户右对齐气泡 / 助手左对齐纯文本
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

  if (isUser) {
    // 用户消息 — 右对齐浅灰气泡
    return (
      <div className="flex justify-end py-2 px-4">
        <div className="max-w-[75%] flex flex-col items-end gap-1.5">
          {atts.length > 0 && (
            <div className="flex flex-wrap gap-2 justify-end">
              {atts.map((a) => (
                <AttachmentTag key={a.id} att={a} />
              ))}
            </div>
          )}
          <div className="bg-[var(--c-btn)] text-[var(--c-text)] text-[15px] leading-relaxed px-4 py-2.5 rounded-2xl rounded-br-md">
            {msg.content}
          </div>
        </div>
      </div>
    )
  }

  // 助手消息 — 左对齐,推理块 + Markdown
  return (
    <div className="flex justify-start py-3 px-6">
      <div className="max-w-[720px] w-full">
        {!hasReasoning ? null : (
          <div className="text-xs text-[var(--c-faint)] mb-2 whitespace-pre-wrap leading-relaxed">
            💭 {msg.reasoning}
          </div>
        )}
        <div className="text-[var(--c-text)] text-[15px] leading-[1.65]">
          <Markdown content={msg.content || ''} />
          {streaming && !hasReasoning && !msg.content && (
            <span className="whitespace-pre-wrap" aria-hidden>▍</span>
          )}
        </div>
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

  /* ── Shared composer — reused in empty & non-empty states ── */
  function renderComposer() {
    const modelName = config.launch.modelPath
      ? (config.launch.modelPath.split(/[/\\]/).pop() ?? '')
      : ''

    return (
      <>
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2.5">
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

        {/* 输入框容器 — 上行 textarea,下行工具栏 */}
        <div
          className="rounded-[20px] border border-[var(--c-border)] bg-[var(--c-input)] overflow-hidden"
          style={{
            boxShadow:
              '0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
          }}
        >
          {/* 上行: textarea */}
          <div className="px-4 pt-4 pb-0">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={!ready}
              placeholder={ready ? 'Type a message...' : 'Model not ready'}
              rows={1}
              className="w-full bg-transparent text-[15px] resize-none focus:outline-none text-[var(--c-text)] placeholder:text-[var(--c-muted)] disabled:opacity-50 leading-[1.6] min-h-[28px]"
            />
          </div>

          {/* 下行: 工具栏 */}
          <div className="flex items-center justify-between px-4 pb-3 pt-1">
            {/* 左侧: 加号按钮 */}
            <AddFileButton
              disabled={!ready || streaming}
              onAdd={(list) =>
                setAttachments((prev) => [...prev, ...list])
              }
              className="w-8 h-8 rounded-full border border-[var(--c-border)] bg-[var(--c-btn)] hover:bg-[var(--c-btn-hover)]"
            />

            {/* 右侧: 模型标签 + 灯泡 + 发送按钮 */}
            <div className="flex items-center gap-2">
              {/* 立方体图标 + 模型名 */}
              {modelName && (
                <span
                  className="flex items-center gap-1.5 text-[var(--c-muted)] text-xs font-medium select-none"
                  title={config.launch.modelPath || undefined}
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                    <line x1="12" y1="22.08" x2="12" y2="12" />
                  </svg>
                  <span className="max-w-[80px] truncate">{modelName}</span>
                </span>
              )}

              {/* 黄色灯泡 */}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0"
              >
                <path d="M9 18h6" />
                <path d="M10 22h4" />
                <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5.76.76 1.23 1.52 1.41 2.5" />
              </svg>

              {streaming ? (
                <button
                  onClick={stop}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-red-500 hover:bg-red-400 text-white text-sm shrink-0 transition-colors"
                >
                  ⏹
                </button>
              ) : (
                <button
                  onClick={send}
                  disabled={!ready || (!input.trim() && attachments.length === 0)}
                  title="Send"
                  className="w-8 h-8 flex items-center justify-center rounded-full text-white shrink-0 transition-all disabled:opacity-25"
                  style={{
                    background: '#404040',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="12" y1="19" x2="12" y2="5" />
                    <polyline points="5 12 12 5 19 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <div className="h-full flex bg-[var(--c-bg)]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {messages.length === 0 ? (
          /* ── Empty state: centered vertical stack (title → subtitle → composer) ── */
          <div className="flex-1 flex flex-col items-center justify-center px-6">
            <h2
              className="text-[var(--c-text)] font-semibold tracking-tight"
              style={{ fontSize: '30px', lineHeight: 1.2 }}
            >
              Hello there
            </h2>
            <p className="text-[var(--c-muted)] text-[15px] mt-3">
              Type a message or upload files to get started
            </p>
            <div className="w-full max-w-[720px] mt-7">
              {renderComposer()}
            </div>
          </div>
        ) : (
          <>
            {/* ── Messages scroll area ── */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-auto flex justify-center"
              onScroll={(e) => {
                const el = e.currentTarget
                pinnedRef.current =
                  el.scrollHeight - el.scrollTop - el.clientHeight < 40
              }}
            >
              <div className="w-full max-w-[800px] py-8">
                {messages.map((m, i) => (
                  <MessageRow
                    key={i}
                    msg={m}
                    streaming={streaming && i === messages.length - 1}
                  />
                ))}
              </div>
            </div>

            {/* ── Bottom-fixed composer ── */}
            <div className="px-6 pb-5 pt-1">
              <div className="max-w-[720px] mx-auto">{renderComposer()}</div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
