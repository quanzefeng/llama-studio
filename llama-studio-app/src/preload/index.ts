// preload — contextBridge 暴露 window.api,renderer 无 Node 访问权
// 通道名必须与 main/ipc-handlers.ts 一致

import { contextBridge, ipcRenderer } from 'electron'
import type { LlamaApi } from '../shared/types'

const api: LlamaApi = {
  llama: {
    start: (config) => ipcRenderer.invoke('llama:start', config),
    stop: () => ipcRenderer.invoke('llama:stop'),
    restart: (config) => ipcRenderer.invoke('llama:restart', config),
    onLog: (cb) => {
      const h = (_e: unknown, line: string) => cb(line)
      ipcRenderer.on('llama:log', h)
      return () => ipcRenderer.removeListener('llama:log', h)
    },
    onStatus: (cb) => {
      const h = (_e: unknown, s: Parameters<typeof cb>[0]) => cb(s)
      ipcRenderer.on('llama:status', h)
      return () => ipcRenderer.removeListener('llama:status', h)
    },
  },
  config: {
    load: () => ipcRenderer.invoke('config:load'),
    save: (c) => ipcRenderer.invoke('config:save', c),
    listPresets: () => ipcRenderer.invoke('config:listPresets'),
    loadPreset: (name) => ipcRenderer.invoke('config:loadPreset', name),
    savePreset: (name, preset) => ipcRenderer.invoke('config:savePreset', name, preset),
    deletePreset: (name) => ipcRenderer.invoke('config:deletePreset', name),
  },
  sampling: {
    load: () => ipcRenderer.invoke('sampling:load'),
    save: (s) => ipcRenderer.invoke('sampling:save', s),
  },
  dialog: {
    pickFile: (filters) => ipcRenderer.invoke('dialog:pickFile', filters),
    pickFolder: () => ipcRenderer.invoke('dialog:pickFolder'),
    listGgufInDir: (dir) => ipcRenderer.invoke('dialog:listGgufInDir', dir),
  },
}

contextBridge.exposeInMainWorld('api', api)
