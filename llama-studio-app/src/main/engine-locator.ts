// engine-locator — 引擎路径探测
// 优先级:1) 用户显式配置(存在 llama-server.exe)→ 尊重;2) 打包内置 resources/engines/ → 自动用;
// 3) 均无 → 交给 defaults(开发机本机路径)
// 打包内置目录由 electron-builder extraResources 生成:engines/llama + engines/cudart

import { join } from 'path'
import { existsSync } from 'fs'

export interface EngineDirs {
  engineDir: string
  cudartDir: string
}

/** 打包内置引擎目录;未打包/缺失时返回 null */
export function bundledEngineDirs(): EngineDirs | null {
  try {
    const base = join(process.resourcesPath, 'engines')
    const llama = join(base, 'llama')
    if (existsSync(join(llama, 'llama-server.exe'))) {
      return { engineDir: llama, cudartDir: join(base, 'cudart') }
    }
  } catch {
    /* 忽略 */
  }
  return null
}

/** 用户配置的引擎是否有效(存在 llama-server.exe) */
export function isUserEngineValid(engineDir?: string): boolean {
  return !!engineDir && existsSync(join(engineDir, 'llama-server.exe'))
}