// UI 控件原语 — 用 CSS 变量,自动跟随深/浅主题
// SaaS dashboard style: clean inputs, violet focus rings, soft shadows

import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium tracking-wide text-[var(--c-muted)] flex items-center gap-1.5">
        {label}
        {hint && <span className="text-[var(--c-faint)] tracking-normal">({hint})</span>}
      </span>
      {children}
    </label>
  )
}

export function NumberField({
  value,
  onChange,
  min,
  max,
  step,
  disabled,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
}) {
  // 本地字符串态:允许空串/前导 0/自由编辑,避免受控 number 输入框"删不掉 0"的问题
  const [text, setText] = useState<string>(String(value))
  const focused = useRef(false)

  // 外部 value 变化(预设加载/重置等)→ 未聚焦时同步显示
  useEffect(() => {
    if (!focused.current) setText(String(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  function commit(raw: string): void {
    const n = raw.trim() === '' ? 0 : Number(raw)
    if (Number.isNaN(n)) return
    onChange(n)
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onChange={(e) => {
        setText(e.target.value)
        commit(e.target.value)
      }}
      onFocus={() => {
        focused.current = true
      }}
      onBlur={() => {
        focused.current = false
        // 空→0;非法输入→回退到外部 value;否则规范化显示
        const raw = text.trim()
        if (raw === '') {
          const next = '0'
          setText(next)
          onChange(0)
          return
        }
        const n = Number(raw)
        if (Number.isNaN(n)) {
          setText(String(value))
          return
        }
        let v = n
        if (min !== undefined && v < min) v = min
        if (max !== undefined && v > max) v = max
        const norm = String(v)
        if (norm !== text) setText(norm)
        if (v !== value) onChange(v)
      }}
      className="bg-[var(--c-input)] border border-[var(--c-border)] rounded-lg px-3 py-1.5 text-sm font-medium tabular-nums focus:outline-none focus:border-[var(--c-accent-1)] focus:c-accent-glow disabled:opacity-40 w-full"
    />
  )
}

export function Slider({
  value,
  onChange,
  min,
  max,
  step,
}: {
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step: number
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 slider-accent"
      />
      <span className="text-xs tabular-nums font-medium w-14 text-right text-[var(--c-accent-text)]">
        {Number.isInteger(step) ? value : value.toFixed(2)}
      </span>
    </div>
  )
}

export function Switch({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-[22px] rounded-full transition-all shrink-0 ${
        checked ? 'c-accent-gradient-bg shadow-[0_2px_8px_rgba(124,92,255,0.35)]' : 'bg-[var(--c-btn-hover)]'
      }`}
    >
      <span
        className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-all ${
          checked ? 'left-[22px]' : 'left-[3px]'
        }`}
      />
    </button>
  )
}

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs text-[var(--c-muted)] px-2 py-1.5 rounded-lg hover:bg-[var(--c-btn)] cursor-pointer transition-colors">
      <span className="font-mono text-[11px]">{label}</span>
      <Switch checked={checked} onChange={onChange} />
    </label>
  )
}

export function Select({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-[var(--c-input)] border border-[var(--c-border)] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[var(--c-accent-1)] focus:c-accent-glow w-full cursor-pointer"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function FilePicker({
  value,
  onChange,
  onPick,
  placeholder,
  disabled,
  pickLabel = '选择',
}: {
  value: string
  onChange: (v: string) => void
  onPick: () => void
  placeholder?: string
  disabled?: boolean
  pickLabel?: string
}) {
  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 min-w-0 bg-[var(--c-input)] border border-[var(--c-border)] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[var(--c-accent-1)] focus:c-accent-glow disabled:opacity-40"
      />
      <button
        type="button"
        onClick={onPick}
        disabled={disabled}
        className="px-3 py-1.5 text-sm rounded-lg bg-[var(--c-btn)] hover:bg-[var(--c-btn-hover)] border border-[var(--c-border)] disabled:opacity-40 shrink-0 transition-colors font-medium"
      >
        {pickLabel}
      </button>
    </div>
  )
}

export function TextInput({
  value,
  onChange,
  className = '',
}: {
  value: string
  onChange: (v: string) => void
  className?: string
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`bg-[var(--c-input)] border border-[var(--c-border)] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[var(--c-accent-1)] focus:c-accent-glow w-full ${className}`}
    />
  )
}
