// 附件区 — + 按钮 / Add file 浮层 / 文件读取与分类 / 附件 chip
// 文件内容在渲染进程内用 File API 读取,无需 IPC/Node;发送时由 Chat.buildBody 编码

import { useRef, useState } from 'react'
import type { Attachment } from '@shared/types'

// ---- 分类规则 ----
const TEXT_EXT = new Set([
  'txt', 'md', 'markdown', 'json', 'csv', 'tsv', 'py', 'js', 'ts', 'jsx', 'tsx',
  'html', 'css', 'scss', 'xml', 'yaml', 'yml', 'log', 'ini', 'toml', 'sql',
  'c', 'cpp', 'h', 'hpp', 'java', 'rs', 'go', 'rb', 'php', 'sh', 'bat', 'ps1',
  'tex', 'env', 'gitignore', 'dockerfile',
])
const TEXT_MAX = 200 * 1024 // 超过不进正文,归 binary
const IMAGE_MAX = 5 * 1024 * 1024
const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'])
const IMAGE_MIME = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml',
])

function extOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i === -1 ? '' : name.slice(i + 1).toLowerCase()
}

function bytesToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(bin)
}

export function formatSize(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

/** 文件分类:image → base64 data URL;text → 全文;binary → 仅元数据 */
function classify(file: File): Promise<Attachment> {
  const ext = extOf(file.name)
  const base: Attachment = {
    id: crypto.randomUUID(),
    name: file.name,
    mime: file.type || 'application/octet-stream',
    size: file.size,
    kind: 'binary',
    content: '',
  }
  const isImage = IMAGE_MIME.has(file.type) || IMAGE_EXT.has(ext)
  const isTextLike = TEXT_EXT.has(ext)
  if (isImage && file.size <= IMAGE_MAX) {
    // 超限(>5MB)则退回 binary,不注入
    return file.arrayBuffer().then((buf) => ({
      ...base,
      kind: 'image' as const,
      content: `data:${file.type || 'image/png'};base64,${bytesToBase64(buf)}`,
    }))
  }
  if (isTextLike && file.size <= TEXT_MAX) {
    return file.text().then((t) => ({ ...base, kind: 'text' as const, content: t }))
  }
  return Promise.resolve(base)
}

/**
 * + 按钮 + Add file 浮层 + 隐藏 file input
 * 浮层定位依赖外层胶囊已有 relative;自身 wrapper 提供 relative 锚点
 */
export function AddFileButton({
  disabled,
  onAdd,
}: {
  disabled?: boolean
  onAdd: (atts: Attachment[]) => void
}) {
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  function onPick() {
    setOpen(false)
    inputRef.current?.click()
  }
  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = '' // 允许重复选择同一文件
    if (!files.length) return
    const atts = await Promise.all(files.map(classify))
    onAdd(atts)
  }

  return (
    <div className="relative flex items-end shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        title="添加附件"
        className="w-8 h-8 flex items-center justify-center rounded-full text-lg text-[var(--c-muted)] hover:bg-[var(--c-btn-hover)] hover:text-[var(--c-text)] disabled:opacity-30 transition-colors"
      >
        +
      </button>
      <input ref={inputRef} type="file" multiple hidden onChange={onFiles} />
      {open && (
        <>
          {/* 遮罩:点击关闭浮层 */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          {/* 输入区贴近窗口底部,浮层必须向上弹出才能不被裁切 */}
          <div className="absolute left-0 bottom-full mb-2 z-20 w-36 rounded-lg border border-[var(--c-border)] bg-[var(--c-panel)] shadow-lg py-1">
            <button
              type="button"
              onClick={onPick}
              className="w-full text-left px-3 py-1.5 text-sm text-[var(--c-text)] hover:bg-[var(--c-btn)]"
            >
              📎 Add file
            </button>
          </div>
        </>
      )}
    </div>
  )
}

/** 单个附件 chip(可移除) */
export function AttachmentChip({
  att,
  onRemove,
}: {
  att: Attachment
  onRemove: (id: string) => void
}) {
  const icon = att.kind === 'image' ? '🖼' : att.kind === 'text' ? '📄' : '📎'
  return (
    <span className="inline-flex items-center gap-1 max-w-[220px] px-2 py-1 rounded-full bg-[var(--c-btn)] border border-[var(--c-border)] text-xs text-[var(--c-text)]">
      <span className="flex items-center gap-1 min-w-0">
        <span>{icon}</span>
        <span className="truncate">{att.name}</span>
        <span className="text-[var(--c-faint)] shrink-0">{formatSize(att.size)}</span>
      </span>
      <button
        type="button"
        onClick={() => onRemove(att.id)}
        title="移除附件"
        className="text-[var(--c-muted)] hover:text-red-400 shrink-0 pl-1"
      >
        ×
      </button>
    </span>
  )
}

/** 只读附件标签(用于已发送消息,不可移除) */
export function AttachmentTag({ att }: { att: Attachment }) {
  const icon = att.kind === 'image' ? '🖼' : att.kind === 'text' ? '📄' : '📎'
  return (
    <span className="inline-flex items-center gap-1 text-xs text-[var(--c-muted)]">
      <span>{icon}</span>
      <span className="truncate max-w-[160px]">{att.name}</span>
      <span className="text-[var(--c-faint)]">{formatSize(att.size)}</span>
    </span>
  )
}