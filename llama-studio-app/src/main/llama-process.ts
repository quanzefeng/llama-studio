// llama-process — llama-server.exe 进程生命周期管理
// spawn + DLL PATH + stdout/stderr 转发 + 进程树 kill + 崩溃检测

import { spawn, exec, type ChildProcess } from 'child_process'
import { join } from 'path'
import type { ServerConfig } from '../shared/types'
import { buildArgs } from '../shared/arg-builder'

type Sender = { send: (channel: string, ...args: unknown[]) => void }

let child: ChildProcess | null = null
let intentionalStop = false

function forwardLines(data: Buffer | string, sender: Sender): void {
  const text = typeof data === 'string' ? data : data.toString('utf8')
  for (const line of text.split(/\r?\n/)) {
    const l = line.trimEnd()
    if (l) sender.send('llama:log', l)
  }
}

/** spawn llama-server.exe;resolve 后进程已起来(不等于 /health ready) */
export async function startServer(config: ServerConfig, sender: Sender): Promise<void> {
  if (child) {
    await stopServer()
  }
  intentionalStop = false

  const exe = join(config.engineDir, 'llama-server.exe')
  const args = buildArgs(config.launch)
  // 关键:两个 bin 目录都进 PATH,否则报"找不到 cudart64_12.dll"
  const env = {
    ...process.env,
    PATH: `${config.engineDir};${config.cudartDir};${process.env.PATH ?? ''}`,
  }

  await new Promise<void>((resolve, reject) => {
    let started = false

    try {
      child = spawn(exe, args, { cwd: config.engineDir, env, windowsHide: true })
    } catch (e) {
      return reject(
        new Error(`无法启动 llama-server: ${(e as Error).message}\n请检查引擎路径: ${exe}`)
      )
    }

    child.stdout?.on('data', (d: Buffer) => forwardLines(d, sender))
    child.stderr?.on('data', (d: Buffer) => forwardLines(d, sender))

    child.on('error', (err) => {
      sender.send('llama:log', `[error] ${err.message}`)
      if (!started) reject(err)
      else sender.send('llama:status', 'error')
    })

    child.on('exit', (code, signal) => {
      sender.send('llama:log', `[process] exit code=${code} signal=${signal}`)
      child = null
      if (!intentionalStop) {
        sender.send('llama:status', 'crashed')
      }
      if (!started) {
        reject(
          new Error(
            `llama-server 进程已退出 (code=${code})。查看日志面板的详细输出。常见原因:模型路径错误、显存不足、DLL 缺失。`
          )
        )
      }
    })

    // 进程已 spawn;给 300ms 确认没立即崩,然后视为已启动,交给 health-check
    setTimeout(() => {
      if (child && !intentionalStop) {
        started = true
        resolve()
      }
    }, 300)
  })
}

/** 进程是否还活着(非 null 且未被 killed) */
export function isServerAlive(): boolean {
  return child !== null && !child.killed
}

/** 杀掉整个进程树(Windows taskkill /T,否则留显存) */
export async function stopServer(): Promise<void> {
  intentionalStop = true
  const c = child
  child = null
  if (!c || !c.pid) return

  await new Promise<void>((resolve) => {
    let done = false
    const finish = () => {
      if (!done) {
        done = true
        resolve()
      }
    }
    exec(`taskkill /pid ${c.pid} /T /F`, (err) => {
      if (err) {
        // 兜底:直接 kill 主进程
        try {
          c.kill()
        } catch {
          /* ignore */
        }
      }
      finish()
    })
    // 兜底超时,无论如何 1.5s 后 resolve
    setTimeout(finish, 1500)
  })
}

export async function restartServer(config: ServerConfig, sender: Sender): Promise<void> {
  await stopServer()
  await startServer(config, sender)
}
