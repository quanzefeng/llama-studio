// UI 控件原语 — 用 CSS 变量,自动跟随深/浅主题

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
    <label className="flex flex-col gap-1">
      <span className="text-xs text-[var(--c-muted)] flex items-center gap-1">
        {label}
        {hint && <span className="text-[var(--c-faint)]">({hint})</span>}
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
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
      className="bg-[var(--c-input)] border border-[var(--c-border)] rounded px-2 py-1 text-sm focus:outline-none focus:border-[var(--c-muted)] disabled:opacity-50 w-full"
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
    <div className="flex items-center gap-2">
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-emerald-500"
      />
      <span className="text-xs tabular-nums w-14 text-right text-[var(--c-text)]">
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
      className={`relative w-10 h-5 rounded-full transition shrink-0 ${
        checked ? 'bg-emerald-600' : 'bg-[var(--c-btn-hover)]'
      }`}
    >
      <span
        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
          checked ? 'left-5' : 'left-0.5'
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
    <label className="flex items-center justify-between gap-2 text-xs text-[var(--c-muted)] px-1 py-1 rounded hover:bg-[var(--c-btn)]">
      <span className="font-mono">{label}</span>
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
      className="bg-[var(--c-input)] border border-[var(--c-border)] rounded px-2 py-1 text-sm focus:outline-none focus:border-[var(--c-muted)] w-full"
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
    <div className="flex gap-1">
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 min-w-0 bg-[var(--c-input)] border border-[var(--c-border)] rounded px-2 py-1 text-sm focus:outline-none focus:border-[var(--c-muted)] disabled:opacity-50"
      />
      <button
        type="button"
        onClick={onPick}
        disabled={disabled}
        className="px-2 py-1 text-sm rounded bg-[var(--c-btn)] hover:bg-[var(--c-btn-hover)] border border-[var(--c-border)] disabled:opacity-50 shrink-0"
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
      className={`bg-[var(--c-input)] border border-[var(--c-border)] rounded px-2 py-1 text-sm focus:outline-none focus:border-[var(--c-muted)] w-full ${className}`}
    />
  )
}
