// 控制面板 — 组合 启动参数 / 采样 / 预设 / 命令预览 / 操作按钮

import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { BUILTIN_PRESETS, getBuiltinPreset } from '../data/builtinPresets'
import type { AppPreset, ReasoningIntensity, ServerConfig, SamplingConfig } from '@shared/types'
import { buildCommandLine } from '@shared/arg-builder'
import LaunchParams from '../components/params/LaunchParams'
import SamplingParams from '../components/params/SamplingParams'

const BUILTIN_PREFIX = 'builtin|'

export default function ControlPanel() {
  const config = useStore((s) => s.config)
  const sampling = useStore((s) => s.sampling)
  const status = useStore((s) => s.status)
  const dirty = useStore((s) => s.dirty)
  const setLaunch = useStore((s) => s.setLaunch)
  const setSampling = useStore((s) => s.setSampling)
  const setConfig = useStore((s) => s.setConfig)
  const setStatus = useStore((s) => s.setStatus)
  const markClean = useStore((s) => s.markClean)
  const markDirty = useStore((s) => s.markDirty)
  const loadFromDisk = useStore((s) => s.loadFromDisk)

  const [presets, setPresets] = useState<string[]>([])
  const [selectedPreset, setSelectedPreset] = useState('')
  const [banner, setBanner] = useState('')
  const [copied, setCopied] = useState(false)
  const [showSave, setShowSave] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saveDesc, setSaveDesc] = useState('')

  useEffect(() => {
    if (status === 'ready') markClean()
  }, [status, markClean])
  useEffect(() => {
    if (status === 'error') setBanner('启动失败 — 请查看日志面板的详细错误')
  }, [status])

  // 加载预设前的内存快照:撤销按钮恢复到它,避免丢手动调参(未保存到磁盘的状态)
  const prePresetRef = useRef<{ config: ServerConfig; sampling: SamplingConfig } | null>(null)

  const refreshPresets = async () => {
    try {
      setPresets(await window.api.config.listPresets())
    } catch (e) {
      setBanner(`加载预设列表失败: ${(e as Error).message}`)
    }
  }
  useEffect(() => {
    void refreshPresets()
  }, [])

  const cmd = buildCommandLine(config.engineDir, config.launch)

  async function start() {
    setBanner('')
    setStatus('starting')
    try {
      await window.api.config.save(config)
      await window.api.sampling.save(sampling)
      await window.api.llama.start(config)
    } catch (e) {
      setBanner(`启动失败: ${(e as Error).message}`)
    }
  }
  async function stop() {
    setBanner('')
    try {
      await window.api.llama.stop()
    } catch (e) {
      setBanner(`停止失败: ${(e as Error).message}`)
    }
  }
  async function restart() {
    setBanner('')
    setStatus('starting')
    try {
      await window.api.config.save(config)
      await window.api.llama.restart(config)
    } catch (e) {
      setBanner(`重启失败: ${(e as Error).message}`)
    }
  }

  // ---- 预设:统一应用(内置/自定义),保留当前机引擎路径,launch 变更联动重启提示 ----
  function applyPreset(p: AppPreset) {
    // 首次应用预设前快照当前手动状态,供「撤销改动」恢复
    if (prePresetRef.current == null) {
      prePresetRef.current = { config, sampling }
    }
    const launchChanged = JSON.stringify(config.launch) !== JSON.stringify(p.config.launch)
    // engineDir/cudartDir 是本机路径,不随预设覆盖
    setConfig({ ...p.config, engineDir: config.engineDir, cudartDir: config.cudartDir })
    setSampling(p.sampling)
    if (launchChanged) markDirty()
  }
  async function loadPreset() {
    if (!selectedPreset) return
    setBanner('')
    try {
      if (selectedPreset.startsWith(BUILTIN_PREFIX)) {
        const p = getBuiltinPreset(selectedPreset.slice(BUILTIN_PREFIX.length))
        if (p) applyPreset(p)
      } else {
        applyPreset(await window.api.config.loadPreset(selectedPreset))
      }
    } catch (e) {
      setBanner(`加载预设失败: ${(e as Error).message}`)
    }
  }
  async function confirmSave() {
    const name = saveName.trim()
    if (!name) return
    try {
      const exists = presets.includes(name)
      if (exists && !window.confirm(`预设「${name}」已存在,覆盖?`)) return
      const preset: AppPreset = {
        name,
        description: saveDesc.trim() || undefined,
        // 剥离本机路径,换机/分享加载不串
        config: { ...config, engineDir: '', cudartDir: '' },
        sampling,
      }
      await window.api.config.savePreset(name, preset)
      setShowSave(false)
      setSaveName('')
      setSaveDesc('')
      await refreshPresets()
      setSelectedPreset(name)
    } catch (e) {
      setBanner(`保存预设失败: ${(e as Error).message}`)
    }
  }
  async function deletePreset() {
    const name = selectedPreset.startsWith(BUILTIN_PREFIX)
      ? selectedPreset.slice(BUILTIN_PREFIX.length)
      : selectedPreset
    if (!name) return
    if (selectedPreset.startsWith(BUILTIN_PREFIX)) return // 内置不可删
    if (!window.confirm(`删除预设「${name}」?`)) return
    try {
      await window.api.config.deletePreset(name)
      setSelectedPreset('')
      await refreshPresets()
    } catch (e) {
      setBanner(`删除预设失败: ${(e as Error).message}`)
    }
  }
  /** 撤销预设:恢复加载前快照,并退回「选择预设」空状态 */
  function undoPreset() {
    if (prePresetRef.current) {
      setConfig(prePresetRef.current.config)
      setSampling(prePresetRef.current.sampling)
      prePresetRef.current = null
    } else {
      void loadFromDisk()
    }
    setSelectedPreset('')
    markClean()
    setShowSave(false)
  }
  async function copyCmd() {
    try {
      await navigator.clipboard.writeText(cmd)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  const busy = status === 'starting' || status === 'loading'
  const running = status === 'ready'
  const isBuiltin = selectedPreset.startsWith(BUILTIN_PREFIX)
  const [selectedInfo, setSelectedInfo] = useState('')

  // 选中预设 → 展示描述(内置直接取,自定义异步读)
  useEffect(() => {
    if (!selectedPreset) {
      setSelectedInfo('')
      return
    }
    if (selectedPreset.startsWith(BUILTIN_PREFIX)) {
      setSelectedInfo(
        getBuiltinPreset(selectedPreset.slice(BUILTIN_PREFIX.length))?.description ?? '',
      )
      return
    }
    let cancelled = false
    window.api.config
      .loadPreset(selectedPreset)
      .then((p) => {
        if (!cancelled) setSelectedInfo(p.description ?? '')
      })
      .catch(() => {
        /* 保留空描述 */
      })
    return () => {
      cancelled = true
    }
  }, [selectedPreset])

  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      {banner && (
        <div className="p-2 rounded bg-red-950/60 border border-red-800 text-red-200 text-sm">
          {banner}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <section className="rounded-lg border border-[var(--c-border)] bg-[var(--c-panel)] p-3">
          <h2 className="text-sm font-semibold text-[var(--c-text)] mb-3">
            启动配置
            <span className="text-xs text-[var(--c-faint)] ml-2">(改了需重启)</span>
          </h2>
          <LaunchParams launch={config.launch} onChange={setLaunch} />
        </section>

        <section className="space-y-4">
          <div className="rounded-lg border border-[var(--c-border)] bg-[var(--c-panel)] p-3">
            <h2 className="text-sm font-semibold text-[var(--c-text)] mb-3">
              采样
              <span className="text-xs text-[var(--c-faint)] ml-2">(实时生效,无需重启)</span>
            </h2>
            <SamplingParams sampling={sampling} onChange={setSampling} />
          </div>

          <div className="rounded-lg border border-[var(--c-border)] bg-[var(--c-panel)] p-3">
            <h2 className="text-sm font-semibold text-[var(--c-text)] mb-3">预设</h2>
            <div className="flex gap-1 items-center">
              <select
                value={selectedPreset}
                onChange={(e) => setSelectedPreset(e.target.value)}
                className="flex-1 min-w-0 bg-[var(--c-input)] border border-[var(--c-border)] rounded px-2 py-1 text-sm focus:outline-none focus:border-[var(--c-muted)]"
              >
                <option value="">(选择预设)</option>
                <optgroup label="内置模板">
                  {BUILTIN_PRESETS.map((p) => (
                    <option key={BUILTIN_PREFIX + p.name} value={BUILTIN_PREFIX + p.name}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="我的预设">
                  {presets.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </optgroup>
              </select>
              <button
                onClick={loadPreset}
                disabled={!selectedPreset}
                className="px-2 py-1 text-sm rounded bg-[var(--c-btn)] hover:bg-[var(--c-btn-hover)] disabled:opacity-40"
              >
                加载
              </button>
              <button
                onClick={deletePreset}
                disabled={!selectedPreset || isBuiltin}
                className="px-2 py-1 text-sm rounded bg-[var(--c-btn)] hover:bg-[var(--c-btn-hover)] disabled:opacity-40"
              >
                删除
              </button>
              <button
                onClick={() => {
                  setSaveName('')
                  setSaveDesc('')
                  setShowSave(true)
                }}
                className="px-2 py-1 text-sm rounded bg-blue-700 hover:bg-blue-600"
              >
                保存
              </button>
            </div>
            {selectedInfo && (
              <p className="text-xs text-[var(--c-faint)] mt-1.5">{selectedInfo}</p>
            )}

            {/* 撤销预设 — 恢复加载前参数并退回选择态 */}
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={undoPreset}
                disabled={!dirty}
                className="px-2 py-1 text-sm rounded bg-[var(--c-btn)] hover:bg-[var(--c-btn-hover)] disabled:opacity-40"
              >
                ↺ 撤销预设
              </button>
              <span className="text-[10px] text-[var(--c-faint)]">
                恢复加载预设前参数,并退回(选择预设)
              </span>
            </div>

            {/* 保存预设对话框 */}
            {showSave && (
              <div className="mt-3 rounded-md border border-[var(--c-border)] bg-[var(--c-bg)]/60 p-3 space-y-2">
                <input
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="预设名称(必填)"
                  autoFocus
                  className="w-full bg-[var(--c-input)] border border-[var(--c-border)] rounded px-2 py-1 text-sm focus:outline-none focus:border-[var(--c-muted)]"
                />
                <input
                  value={saveDesc}
                  onChange={(e) => setSaveDesc(e.target.value)}
                  placeholder="一句话说明(可选,加载时展示)"
                  className="w-full bg-[var(--c-input)] border border-[var(--c-border)] rounded px-2 py-1 text-sm focus:outline-none focus:border-[var(--c-muted)]"
                />
                <p className="text-[10px] text-[var(--c-faint)]">
                  预设保存当前启动配置 + 采样参数(不含本机引擎路径,换机加载不串)
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={confirmSave}
                    disabled={!saveName.trim()}
                    className="px-3 py-1 text-sm rounded bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40"
                  >
                    保存
                  </button>
                  <button
                    onClick={() => setShowSave(false)}
                    className="px-3 py-1 text-sm rounded bg-[var(--c-btn)] hover:bg-[var(--c-btn-hover)]"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 推理强度 — 预设下方独立卡片 */}
          <div className="rounded-lg border border-[var(--c-border)] bg-[var(--c-panel)] p-3">
            <h2 className="text-sm font-semibold text-[var(--c-text)] mb-3">
              推理强度
              <span className="text-xs text-[var(--c-faint)] ml-2">(思考预算,Max 不限)</span>
            </h2>
            <select
              value={sampling.reasoningIntensity}
              onChange={(e) =>
                setSampling({ reasoningIntensity: e.target.value as ReasoningIntensity })
              }
              className="w-full bg-[var(--c-input)] border border-[var(--c-border)] rounded px-2 py-1 text-sm focus:outline-none focus:border-[var(--c-muted)]"
            >
              <option value="low">Low (≤1024)</option>
              <option value="medium">Medium (≤2048)</option>
              <option value="high">High (≤8192)</option>
              <option value="max">Max (不限)</option>
            </select>
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-[var(--c-border)] bg-[var(--c-code)] p-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-[var(--c-text)]">命令预览</h2>
          <button
            onClick={copyCmd}
            className="text-xs px-2 py-0.5 rounded bg-[var(--c-btn)] hover:bg-[var(--c-btn-hover)]"
          >
            {copied ? '已复制' : '复制'}
          </button>
        </div>
        <pre className="text-xs text-[var(--c-text)] whitespace-pre-wrap break-all font-mono">
          {cmd}
        </pre>
      </section>

      <div className="flex flex-wrap items-center gap-2 sticky bottom-0 bg-[var(--c-bg)] py-2 -mx-4 px-4 border-t border-[var(--c-border)]">
        <button
          onClick={start}
          disabled={busy}
          className="px-4 py-2 rounded text-sm font-medium bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40"
        >
          ▶ 启动
        </button>
        <button
          onClick={stop}
          disabled={!running && !busy}
          className="px-4 py-2 rounded text-sm bg-[var(--c-btn)] hover:bg-[var(--c-btn-hover)] disabled:opacity-40"
        >
          ⏹ 停止
        </button>
        {dirty && running && (
          <button
            onClick={restart}
            className="px-4 py-2 rounded text-sm font-medium bg-amber-700 hover:bg-amber-600"
          >
            ↻ 应用并重启
          </button>
        )}
        {dirty && (
          <span className="text-xs text-amber-400">
            启动参数有改动,{running ? '需重启生效;' : ''}可在「预设」卡片撤销
          </span>
        )}
      </div>
    </div>
  )
}
