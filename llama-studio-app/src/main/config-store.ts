// config-store — 基于 fs 的配置/预设持久化(无外部依赖)
// 数据写在 app.getPath('userData')/data/ 下

import { app } from 'electron'
import { join } from 'path'
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  unlinkSync,
  existsSync,
} from 'fs'
import type { ServerConfig, SamplingConfig, AppPreset } from '../shared/types'
import {
  defaultServerConfig,
  defaultSampling,
} from '../shared/defaults'

const dataDir = join(app.getPath('userData'), 'data')
const presetsDir = join(dataDir, 'presets')
const configPath = join(dataDir, 'config.json')
const samplingPath = join(dataDir, 'sampling.json')

function ensure(): void {
  mkdirSync(presetsDir, { recursive: true })
}

export function loadConfig(): ServerConfig {
  ensure()
  try {
    if (existsSync(configPath)) {
      const parsed = JSON.parse(readFileSync(configPath, 'utf8')) as ServerConfig
      // 合并默认值,防字段缺失
      const def = defaultServerConfig()
      return {
        launch: { ...def.launch, ...parsed?.launch },
        engineDir: parsed?.engineDir ?? def.engineDir,
        cudartDir: parsed?.cudartDir ?? def.cudartDir,
      }
    }
  } catch (e) {
    console.error('[config-store] loadConfig failed', e)
  }
  return defaultServerConfig()
}

export function saveConfig(c: ServerConfig): void {
  ensure()
  writeFileSync(configPath, JSON.stringify(c, null, 2), 'utf8')
}

export function loadSampling(): SamplingConfig {
  ensure()
  try {
    if (existsSync(samplingPath)) {
      return { ...defaultSampling(), ...JSON.parse(readFileSync(samplingPath, 'utf8')) }
    }
  } catch (e) {
    console.error('[config-store] loadSampling failed', e)
  }
  return defaultSampling()
}

export function saveSampling(s: SamplingConfig): void {
  ensure()
  writeFileSync(samplingPath, JSON.stringify(s, null, 2), 'utf8')
}

export function listPresets(): string[] {
  ensure()
  return readdirSync(presetsDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''))
}

export function loadPreset(name: string): AppPreset {
  ensure()
  const p = join(presetsDir, `${name}.json`)
  if (!existsSync(p)) throw new Error(`预设不存在: ${name}`)
  return JSON.parse(readFileSync(p, 'utf8')) as AppPreset
}

export function savePreset(name: string, preset: AppPreset): void {
  ensure()
  writeFileSync(join(presetsDir, `${name}.json`), JSON.stringify(preset, null, 2), 'utf8')
}

export function deletePreset(name: string): void {
  ensure()
  const p = join(presetsDir, `${name}.json`)
  if (existsSync(p)) unlinkSync(p)
}
