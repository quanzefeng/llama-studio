// 采样参数区(实时生效)

import { useState } from 'react'
import type { SamplingConfig, Mirostat } from '@shared/types'
import { Field, NumberField, Slider, Select, TextInput } from '../ui/controls'

const MIROSTAT: { value: string; label: string }[] = [
  { value: '0', label: 'off' },
  { value: '1', label: 'mirostat 1' },
  { value: '2', label: 'mirostat 2' },
]

interface Props {
  sampling: SamplingConfig
  onChange: (patch: Partial<SamplingConfig>) => void
}

const SAMPLER_PRESETS: { value: string; label: string }[] = [
  { value: '', label: '(服务器默认)' },
  { value: 'dry,top_k,typ_p,top_p,min_p,xtc,temperature', label: '标准(全开)' },
  { value: 'top_k,top_p,min_p,temperature', label: '精简' },
  { value: 'penalties,dry,top_n_sigma,top_k,typ_p,top_p,min_p,xtc,temperature', label: 'llama.cpp 完整' },
]

/** 判断某高级采样器是否正在使用(便于高亮提示) */
export default function SamplingParams({ sampling, onChange }: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const advancedActive =
    sampling.typicalP < 1.0 ||
    sampling.xtcProbability > 0 ||
    sampling.dryMultiplier > 0 ||
    sampling.dynatempRange > 0 ||
    sampling.topNSigma >= 0 ||
    sampling.samplerOrder.trim() !== ''
    return (
    <div className="space-y-3">
      <Field label="temperature 温度" hint="0-2">
        <Slider value={sampling.temperature} onChange={(v) => onChange({ temperature: v })} min={0} max={2} step={0.05} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="top_k 候选数" hint="0-200">
          <NumberField value={sampling.topK} onChange={(v) => onChange({ topK: v })} min={0} max={200} />
        </Field>
        <Field label="top_p 核采样" hint="0-1">
          <Slider value={sampling.topP} onChange={(v) => onChange({ topP: v })} min={0} max={1} step={0.01} />
        </Field>
        <Field label="min_p 最小概率" hint="0-1">
          <Slider value={sampling.minP} onChange={(v) => onChange({ minP: v })} min={0} max={1} step={0.01} />
        </Field>
        <Field label="repeat_penalty 重复惩罚" hint="1-2">
          <Slider value={sampling.repeatPenalty} onChange={(v) => onChange({ repeatPenalty: v })} min={1} max={2} step={0.01} />
        </Field>
        <Field label="repeat_last_n 重复窗口" hint="惩罚范围 token 数">
          <NumberField value={sampling.repeatLastN} onChange={(v) => onChange({ repeatLastN: v })} min={0} />
        </Field>
        <Field label="seed 随机种子" hint="-1=随机">
          <NumberField value={sampling.seed} onChange={(v) => onChange({ seed: v })} />
        </Field>
        <Field label="mirostat 熵控制">
          <Select value={String(sampling.mirostat)} onChange={(v) => onChange({ mirostat: Number(v) as Mirostat })} options={MIROSTAT} />
        </Field>
        <Field label="n_predict 生成上限" hint="-1=无限">
          <NumberField value={sampling.nPredict} onChange={(v) => onChange({ nPredict: v })} />
        </Field>
      </div>

      {/* 高级采样器(per-request,仅在开启时注入请求体) */}
      <div className="pt-2 border-t border-[var(--c-border)]">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="flex items-center gap-1 text-xs text-[var(--c-muted)] hover:text-[var(--c-text)]"
        >
          <span className={showAdvanced ? '' : 'rotate-0'}>
            {showAdvanced ? '▾' : '▸'}
          </span>
          高级采样
          {advancedActive && (
            <span className="ml-1 w-1.5 h-1.5 rounded-full c-accent-gradient-bg" />
          )}
        </button>
        {showAdvanced && (
          <div className="mt-2 space-y-3">
            <Field label="typical_p 局部典型" hint="1.0=关闭">
              <Slider
                value={sampling.typicalP}
                onChange={(v) => onChange({ typicalP: v })}
                min={0.5}
                max={1}
                step={0.01}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="xtc_probability" hint="0=关闭">
                <Slider
                  value={sampling.xtcProbability}
                  onChange={(v) => onChange({ xtcProbability: v })}
                  min={0}
                  max={1}
                  step={0.01}
                />
              </Field>
              <Field label="xtc_threshold" hint=">0.5 关闭">
                <Slider
                  value={sampling.xtcThreshold}
                  onChange={(v) => onChange({ xtcThreshold: v })}
                  min={0}
                  max={1}
                  step={0.01}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="dry_multiplier" hint="0=关闭">
                <Slider
                  value={sampling.dryMultiplier}
                  onChange={(v) => onChange({ dryMultiplier: v })}
                  min={0}
                  max={3}
                  step={0.1}
                />
              </Field>
              <Field label="dry_allowed_length">
                <NumberField
                  value={sampling.dryAllowedLength}
                  onChange={(v) => onChange({ dryAllowedLength: v })}
                  min={1}
                />
              </Field>
              <Field label="dry_penalty_last_n" hint="0=关闭">
                <NumberField
                  value={sampling.dryPenaltyLastN}
                  onChange={(v) => onChange({ dryPenaltyLastN: v })}
                  min={0}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="dynatemp_range" hint="0=关闭">
                <Slider
                  value={sampling.dynatempRange}
                  onChange={(v) => onChange({ dynatempRange: v })}
                  min={0}
                  max={2}
                  step={0.05}
                />
              </Field>
              <Field label="dynatemp_exponent">
                <NumberField
                  value={sampling.dynatempExponent}
                  onChange={(v) => onChange({ dynatempExponent: v })}
                  min={0}
                  step={0.25}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="top_n_sigma" hint="<0=关闭">
                <NumberField
                  value={sampling.topNSigma}
                  onChange={(v) => onChange({ topNSigma: v })}
                  step={0.1}
                />
              </Field>
              <Field label="sampler 顺序">
                <Select
                  value={sampling.samplerOrder}
                  onChange={(v) => onChange({ samplerOrder: v })}
                  options={SAMPLER_PRESETS}
                />
              </Field>
            </div>
            <p className="text-[10px] text-[var(--c-faint)]">
              采样器按列出的顺序流水线执行。自定义顺序可参考:
              dry, top_k, typ_p, top_p, min_p, xtc, temperature
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
