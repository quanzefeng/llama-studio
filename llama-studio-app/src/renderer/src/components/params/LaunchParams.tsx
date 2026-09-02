// 启动参数区

import { useState } from 'react'
import type { LaunchConfig, CacheType, SpecType, RopeScaling } from '@shared/types'
import { Field, NumberField, Slider, Select, FilePicker, Toggle, TextInput } from '../ui/controls'

const CACHE_TYPES: { value: string; label: string }[] = [
  { value: 'f16', label: 'f16 (高精度)' },
  { value: 'q8_0', label: 'q8_0 (推荐)' },
  { value: 'q4_0', label: 'q4_0 (省显存)' },
  { value: 'q5_0', label: 'q5_0' },
]

const SPEC_TYPES: { value: string; label: string }[] = [
  { value: 'none', label: '关闭' },
  { value: 'draft-mtp', label: 'draft-mtp (推测解码)' },
]

const ROPE_SCALING: { value: string; label: string }[] = [
  { value: 'none', label: '跟随模型' },
  { value: 'linear', label: 'linear (线性)' },
  { value: 'yarn', label: 'yarn (长上下文)' },
]

interface Props {
  launch: LaunchConfig
  onChange: (patch: Partial<LaunchConfig>) => void
}

export default function LaunchParams({ launch, onChange }: Props) {
  const [ggufChoices, setGgufChoices] = useState<string[]>([])
  const [pickError, setPickError] = useState('')

  async function pickFile() {
    setPickError('')
    const f = await window.api.dialog.pickFile(['gguf'])
    if (f) {
      setGgufChoices([])
      onChange({ modelPath: f })
    }
  }

  async function pickDir() {
    setPickError('')
    const d = await window.api.dialog.pickFolder()
    if (!d) return
    const list = await window.api.dialog.listGgufInDir(d)
    if (list.length === 0) {
      setPickError('该目录下没有 .gguf 文件')
      setGgufChoices([])
      return
    }
    setGgufChoices(list)
    onChange({ modelPath: list[0] })
  }

  async function pickMmproj() {
    const f = await window.api.dialog.pickFile()
    if (f) onChange({ mmprojPath: f })
  }

  const showDraft = launch.specType === 'draft-mtp'

  return (
    <div className="space-y-3">
      <Field label="-m 模型路径">
        <FilePicker
          value={launch.modelPath}
          onChange={(v) => onChange({ modelPath: v })}
          onPick={pickFile}
          placeholder="选择或粘贴 .gguf 路径"
        />
      </Field>
      <div className="flex items-center gap-2 -mt-1">
        <button
          onClick={pickDir}
          className="text-xs px-2 py-0.5 rounded bg-[var(--c-btn)] hover:bg-[var(--c-btn-hover)]"
        >
          选目录(列出 .gguf)
        </button>
        {pickError && <span className="text-xs text-red-400">{pickError}</span>}
      </div>
      {ggufChoices.length > 1 && (
        <Field label="目录内 .gguf">
          <Select
            value={launch.modelPath}
            onChange={(v) => onChange({ modelPath: v })}
            options={ggufChoices.map((p) => ({ value: p, label: p.split('\\').pop() ?? p }))}
          />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="-ngl GPU 层" hint="0-999">
          <Slider value={launch.ngl} onChange={(v) => onChange({ ngl: v })} min={0} max={999} step={1} />
        </Field>
        <Field label="--threads 线程数" hint="CPU 计算线程">
          <NumberField value={launch.threads} onChange={(v) => onChange({ threads: v })} min={1} />
        </Field>
        <Field label="-c 上下文长度" hint="KV 缓存 token 数">
          <NumberField value={launch.contextSize} onChange={(v) => onChange({ contextSize: v })} min={512} step={512} />
        </Field>
        <Field label="-np 并行槽" hint="并发请求数">
          <NumberField value={launch.parallelSlots} onChange={(v) => onChange({ parallelSlots: v })} min={1} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="--cache-type-k K 缓存" hint="精度/显存权衡">
          <Select value={launch.cacheTypeK} onChange={(v) => onChange({ cacheTypeK: v as CacheType })} options={CACHE_TYPES} />
        </Field>
        <Field label="--cache-type-v V 缓存" hint="精度/显存权衡">
          <Select value={launch.cacheTypeV} onChange={(v) => onChange({ cacheTypeV: v as CacheType })} options={CACHE_TYPES} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <Toggle label="-fa 闪存注意力" checked={launch.flashAttn} onChange={(v) => onChange({ flashAttn: v })} />
        <Toggle label="--mlock 锁内存" checked={launch.mlock} onChange={(v) => onChange({ mlock: v })} />
        <Toggle label="-nkvo KV 缓存 offload" checked={launch.nkvo} onChange={(v) => onChange({ nkvo: v })} />
        <Toggle label="--jinja 对话模板" checked={launch.jinja} onChange={(v) => onChange({ jinja: v })} />
        <Field label="--n-cpu-moe MoE 专家 CPU 层" hint="0=off">
          <NumberField value={launch.nCpuMoe} onChange={(v) => onChange({ nCpuMoe: v })} min={0} />
        </Field>
      </div>

      <Field label="--mmproj 多模态投影" hint="可选,视觉模型">
        <FilePicker
          value={launch.mmprojPath}
          onChange={(v) => onChange({ mmprojPath: v })}
          onPick={pickMmproj}
          placeholder="视觉模型才填"
        />
      </Field>

      <Field label="--spec-type 推测解码" hint="draft-mtp 需模型含 MTP 层">
        <Select value={launch.specType} onChange={(v) => onChange({ specType: v as SpecType })} options={SPEC_TYPES} />
      </Field>
      {showDraft && (
        <div className="grid grid-cols-2 gap-3 pl-3 border-l-2 border-[var(--c-border)]">
          <Field label="--spec-draft-n-max 草案层数">
            <NumberField value={launch.specDraftNMax} onChange={(v) => onChange({ specDraftNMax: v })} min={1} />
          </Field>
          <Field label="--spec-draft-p-min 接受阈值" hint="0-1">
            <Slider value={launch.draftPMin} onChange={(v) => onChange({ draftPMin: v })} min={0} max={1} step={0.01} />
          </Field>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="--host 监听地址" hint="默认本机">
          <TextInput value={launch.host} onChange={(v) => onChange({ host: v })} />
        </Field>
        <Field label="--port 端口" hint="HTTP 端口">
          <NumberField value={launch.port} onChange={(v) => onChange({ port: v })} min={1} max={65535} />
        </Field>
      </div>

      {/* 长上下文 / RoPE 缩放(改长 -c 后一般要配合) */}
      <div className="pt-2 border-t border-[var(--c-border)] space-y-3">
        <Field label="--rope-scaling 上下文缩放" hint="长上下文 32K+ 推荐 yarn">
          <Select
            value={launch.ropeScaling}
            onChange={(v) => onChange({ ropeScaling: v as RopeScaling })}
            options={ROPE_SCALING}
          />
        </Field>
        {launch.ropeScaling !== 'none' && (
          <div className="grid grid-cols-2 gap-3 pl-3 border-l-2 border-[var(--c-border)]">
            <Field label="--rope-scale 放大倍数" hint=">1 生效">
              <NumberField
                value={launch.ropeScale}
                onChange={(v) => onChange({ ropeScale: v })}
                min={0}
                step={0.25}
              />
            </Field>
            {launch.ropeScaling === 'yarn' && (
              <>
                <Field label="--yarn-orig-ctx 原始上下文">
                  <NumberField
                    value={launch.yarnOrigCtx}
                    onChange={(v) => onChange({ yarnOrigCtx: v })}
                    min={0}
                    step={256}
                  />
                </Field>
                <Field label="--yarn-ext-factor" hint="-1=默认">
                  <NumberField
                    value={launch.yarnExtFactor}
                    onChange={(v) => onChange({ yarnExtFactor: v })}
                    step={0.1}
                  />
                </Field>
                <Field label="--yarn-attn-factor" hint="-1=默认">
                  <NumberField
                    value={launch.yarnAttnFactor}
                    onChange={(v) => onChange({ yarnAttnFactor: v })}
                    step={0.1}
                  />
                </Field>
                <Field label="--yarn-beta-slow" hint="-1=默认">
                  <NumberField
                    value={launch.yarnBetaSlow}
                    onChange={(v) => onChange({ yarnBetaSlow: v })}
                    step={0.1}
                  />
                </Field>
                <Field label="--yarn-beta-fast" hint="-1=默认">
                  <NumberField
                    value={launch.yarnBetaFast}
                    onChange={(v) => onChange({ yarnBetaFast: v })}
                    step={0.1}
                  />
                </Field>
              </>
            )}
          </div>
        )}
      </div>

      {/* 吞吐 batch */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="-b batch-size" hint="推断吞吐">
          <NumberField value={launch.batchSize} onChange={(v) => onChange({ batchSize: v })} min={16} step={16} />
        </Field>
        <Field label="-ub ubatch-size" hint="物理批">
          <NumberField value={launch.ubatchSize} onChange={(v) => onChange({ ubatchSize: v })} min={16} step={16} />
        </Field>
      </div>

      {/* 多 GPU */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="-mg 主 GPU" hint="索引起 0">
          <NumberField value={launch.mainGpu} onChange={(v) => onChange({ mainGpu: v })} min={0} />
        </Field>
        <Field label="-ts 各卡比例" hint="如 0.6,0.4">
          <TextInput value={launch.tensorSplit} onChange={(v) => onChange({ tensorSplit: v })} />
        </Field>
      </div>
    </div>
  )
}
