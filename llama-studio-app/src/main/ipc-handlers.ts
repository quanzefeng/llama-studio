// IPC handlers — config/sampling/preset/dialog 已实现,llama:* 接 llama-process

import { ipcMain, dialog, BrowserWindow, type WebContents } from 'electron'
import { readdirSync } from 'fs'
import { join } from 'path'
import type { ServerConfig, SamplingConfig, AppPreset } from '../shared/types'
import {
  loadConfig,
  saveConfig,
  loadSampling,
  saveSampling,
  listPresets,
  loadPreset,
  savePreset,
  deletePreset,
} from './config-store'
import { startServer, stopServer, restartServer, isServerAlive } from './llama-process'
import { pollHealth } from './health-check'

function getWebContents(): WebContents | null {
  return (
    BrowserWindow.getFocusedWindow()?.webContents ??
    BrowserWindow.getAllWindows()[0]?.webContents ??
    null
  )
}

export function registerIpcHandlers(): void {
  // ---- config ----
  ipcMain.handle('config:load', () => loadConfig())
  ipcMain.handle('config:save', (_e, c: ServerConfig) => saveConfig(c))

  // ---- sampling ----
  ipcMain.handle('sampling:load', () => loadSampling())
  ipcMain.handle('sampling:save', (_e, s: SamplingConfig) => saveSampling(s))

  // ---- presets ----
  ipcMain.handle('config:listPresets', () => listPresets())
  ipcMain.handle('config:loadPreset', (_e, name: string) => loadPreset(name))
  ipcMain.handle('config:savePreset', (_e, name: string, preset: AppPreset) =>
    savePreset(name, preset)
  )
  ipcMain.handle('config:deletePreset', (_e, name: string) => deletePreset(name))

  // ---- dialog ----
  ipcMain.handle('dialog:pickFile', async (_e, filters?: string[]) => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null
    const opts = {
      properties: ['openFile' as const],
      filters: filters ? [{ name: 'files', extensions: filters }] : undefined,
    }
    const res = win
      ? await dialog.showOpenDialog(win, opts)
      : await dialog.showOpenDialog(opts)
    return res.canceled || res.filePaths.length === 0 ? null : res.filePaths[0]
  })

  ipcMain.handle('dialog:pickFolder', async () => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null
    const opts = { properties: ['openDirectory' as const] }
    const res = win
      ? await dialog.showOpenDialog(win, opts)
      : await dialog.showOpenDialog(opts)
    return res.canceled || res.filePaths.length === 0 ? null : res.filePaths[0]
  })

  ipcMain.handle('dialog:listGgufInDir', (_e, dir: string) => {
    try {
      return readdirSync(dir)
        .filter((f) => f.toLowerCase().endsWith('.gguf'))
        .map((f) => join(dir, f))
    } catch {
      return []
    }
  })

  // ---- llama process ----
  ipcMain.handle('llama:start', async (_e, config: ServerConfig) => {
    const wc = getWebContents()
    if (!wc) throw new Error('没有可用窗口')
    wc.send('llama:status', 'starting')
    try {
      await startServer(config, wc)
      await pollHealth(config.launch.host, config.launch.port, {
        onStatus: (s) => wc.send('llama:status', s),
        isAlive: () => isServerAlive(),
      })
      wc.send('llama:status', 'ready')
    } catch (err) {
      if ((err as Error).message.includes('进程已退出')) {
        wc.send('llama:log', `[warn] ${(err as Error).message}`)
      } else {
        wc.send('llama:status', 'error')
        wc.send('llama:log', `[error] ${(err as Error).message}`)
      }
    }
  })

  ipcMain.handle('llama:stop', async () => {
    const wc = getWebContents()
    await stopServer()
    wc?.send('llama:status', 'idle')
  })

  ipcMain.handle('llama:restart', async (_e, config: ServerConfig) => {
    const wc = getWebContents()
    if (!wc) throw new Error('没有可用窗口')
    wc.send('llama:status', 'starting')
    try {
      await restartServer(config, wc)
      await pollHealth(config.launch.host, config.launch.port, {
        onStatus: (s) => wc.send('llama:status', s),
        isAlive: () => isServerAlive(),
      })
      wc.send('llama:status', 'ready')
    } catch (err) {
      if ((err as Error).message.includes('进程已退出')) {
        wc.send('llama:log', `[warn] ${(err as Error).message}`)
      } else {
        wc.send('llama:status', 'error')
        wc.send('llama:log', `[error] ${(err as Error).message}`)
      }
    }
  })
}
