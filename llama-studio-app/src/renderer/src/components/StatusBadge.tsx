// 状态灯

import { useStore } from '../store'
import type { ServerStatus } from '@shared/types'

const COLORS: Record<ServerStatus, string> = {
  idle: 'bg-zinc-500',
  starting: 'bg-yellow-500 animate-pulse',
  loading: 'bg-yellow-500 animate-pulse',
  ready: 'bg-green-500',
  error: 'bg-red-500',
  crashed: 'bg-red-600',
}

const LABELS: Record<ServerStatus, string> = {
  idle: '未启动',
  starting: '启动中',
  loading: '加载模型',
  ready: '就绪',
  error: '错误',
  crashed: '已崩溃',
}

export default function StatusBadge() {
  const status = useStore((s) => s.status)
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`w-2 h-2 rounded-full ${COLORS[status]}`} />
      <span className="text-[var(--c-muted)]">{LABELS[status]}</span>
    </div>
  )
}
