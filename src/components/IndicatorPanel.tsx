'use client'

import React from 'react'

export interface IndicatorConfig {
  rsi: { enabled: boolean; period: number }
  ema: { enabled: boolean; fast: number; slow: number }
  macd: { enabled: boolean; fast: number; slow: number; signal: number }
}

export interface IndicatorPanelProps {
  config: IndicatorConfig
  onChange: (next: IndicatorConfig) => void
}

export const DEFAULT_INDICATOR_CONFIG: IndicatorConfig = {
  rsi: { enabled: false, period: 14 },
  ema: { enabled: false, fast: 12, slow: 26 },
  macd: { enabled: false, fast: 12, slow: 26, signal: 9 },
}

interface NumberInputProps {
  id: string
  label: string
  value: number
  min?: number
  max?: number
  onChange: (value: number) => void
  disabled?: boolean
}

function NumberInput({ id, label, value, min = 1, max = 999, onChange, disabled = false }: NumberInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parseInt(e.target.value, 10)
    if (!isNaN(parsed) && parsed >= min && parsed <= max) {
      onChange(parsed)
    }
  }

  return (
    <div className="flex flex-col gap-0.5">
      <label
        htmlFor={id}
        className="text-xs text-gray-400"
      >
        {label}
      </label>
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={handleChange}
        disabled={disabled}
        aria-label={label}
        className={[
          'w-16 px-2 py-1 text-sm rounded bg-gray-800 border text-white',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
          disabled
            ? 'border-gray-700 text-gray-600 cursor-not-allowed'
            : 'border-gray-600 hover:border-gray-500',
        ].join(' ')}
      />
    </div>
  )
}

interface SectionProps {
  title: string
  checked: boolean
  onToggle: () => void
  children: React.ReactNode
}

function IndicatorSection({ title, checked, onToggle, children }: SectionProps) {
  const checkboxId = `indicator-${title.toLowerCase()}-enabled`

  return (
    <div className="border border-gray-700 rounded-md p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          id={checkboxId}
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          aria-label={`${title} 활성화`}
          className="w-4 h-4 accent-blue-500 cursor-pointer"
        />
        <label
          htmlFor={checkboxId}
          className="text-sm font-medium text-white cursor-pointer select-none"
        >
          {title}
        </label>
      </div>

      {checked && (
        <div className="flex flex-wrap gap-3 pl-6">
          {children}
        </div>
      )}
    </div>
  )
}

export function IndicatorPanel({ config, onChange }: IndicatorPanelProps) {
  const updateRsi = (patch: Partial<IndicatorConfig['rsi']>) => {
    onChange({ ...config, rsi: { ...config.rsi, ...patch } })
  }

  const updateEma = (patch: Partial<IndicatorConfig['ema']>) => {
    onChange({ ...config, ema: { ...config.ema, ...patch } })
  }

  const updateMacd = (patch: Partial<IndicatorConfig['macd']>) => {
    onChange({ ...config, macd: { ...config.macd, ...patch } })
  }

  return (
    <aside
      aria-label="인디케이터 설정"
      className="flex flex-col gap-2 p-3 bg-gray-900 border border-gray-700 rounded-md min-w-[200px]"
    >
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
        인디케이터
      </h2>

      {/* RSI */}
      <IndicatorSection
        title="RSI"
        checked={config.rsi.enabled}
        onToggle={() => updateRsi({ enabled: !config.rsi.enabled })}
      >
        <NumberInput
          id="rsi-period"
          label="기간"
          value={config.rsi.period}
          onChange={(v) => updateRsi({ period: v })}
        />
      </IndicatorSection>

      {/* EMA */}
      <IndicatorSection
        title="EMA"
        checked={config.ema.enabled}
        onToggle={() => updateEma({ enabled: !config.ema.enabled })}
      >
        <NumberInput
          id="ema-fast"
          label="단기"
          value={config.ema.fast}
          onChange={(v) => updateEma({ fast: v })}
        />
        <NumberInput
          id="ema-slow"
          label="장기"
          value={config.ema.slow}
          onChange={(v) => updateEma({ slow: v })}
        />
      </IndicatorSection>

      {/* MACD */}
      <IndicatorSection
        title="MACD"
        checked={config.macd.enabled}
        onToggle={() => updateMacd({ enabled: !config.macd.enabled })}
      >
        <NumberInput
          id="macd-fast"
          label="단기"
          value={config.macd.fast}
          onChange={(v) => updateMacd({ fast: v })}
        />
        <NumberInput
          id="macd-slow"
          label="장기"
          value={config.macd.slow}
          onChange={(v) => updateMacd({ slow: v })}
        />
        <NumberInput
          id="macd-signal"
          label="시그널"
          value={config.macd.signal}
          onChange={(v) => updateMacd({ signal: v })}
        />
      </IndicatorSection>
    </aside>
  )
}

export default IndicatorPanel
