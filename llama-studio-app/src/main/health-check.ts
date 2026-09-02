// health-check — 轮询 llama-server 的 /health,直到 ready 或超时

import type { ServerStatus } from '../shared/types'

interface Opts {
  timeoutMs?: number
  intervalMs?: number
  onStatus?: (s: ServerStatus) => void
  isAlive?: () => boolean
}

/**
 * 轮询 http://host:port/health
 * - loading model → onStatus('loading'),继续轮询
 * - ok/ready → onStatus('ready'),resolve
 * - 连接拒绝 → 继续轮询直到超时
 * - 超时 → reject
 */
export async function pollHealth(
  host: string,
  port: number,
  opts: Opts = {}
): Promise<void> {
  const timeoutMs = opts.timeoutMs ?? 60000
  const intervalMs = opts.intervalMs ?? 500
  const url = `http://${host}:${port}/health`
  const deadline = Date.now() + timeoutMs

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (Date.now() >= deadline) {
      throw new Error(
        `健康检查超时(${timeoutMs}ms)。llama-server 未就绪。请查看日志面板。`
      )
    }
    if (opts.isAlive && !opts.isAlive()) {
      throw new Error('llama-server 进程已退出,停止健康检查')
    }
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) })
      if (res.ok) {
        const body = (await res.json().catch(() => ({}))) as { status?: string }
        const st = (body?.status ?? '').toLowerCase()
        if (st === 'ok' || st === 'ready') {
          opts.onStatus?.('ready')
          return
        }
        if (st.includes('loading') || st.includes('init')) {
          opts.onStatus?.('loading')
        } else {
          // 未知 status 但 HTTP 200,保守视为就绪
          opts.onStatus?.('ready')
          return
        }
      }
    } catch {
      // 连接拒绝 / 超时,继续轮询
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
}
