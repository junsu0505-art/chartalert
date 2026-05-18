'use client'

import React from 'react'

export type DrawingTool = 'cursor' | 'trendline' | 'horizontal' | 'delete'

export interface DrawingToolbarProps {
  currentTool: DrawingTool
  onToolChange: (tool: DrawingTool) => void
  onClearAll: () => void
}

// Inline SVG icons — no external icon dependency required
const CursorIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M3 2L3 12L6.5 9L8.5 14L10 13.5L8 8.5L12 8.5L3 2Z"
      fill="currentColor"
    />
  </svg>
)

const TrendlineIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden="true"
  >
    <line x1="2" y1="13" x2="14" y2="3" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="2" cy="13" r="1.5" fill="currentColor" />
    <circle cx="14" cy="3" r="1.5" fill="currentColor" />
  </svg>
)

const HorizontalIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden="true"
  >
    <line x1="1" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 1" />
    <circle cx="1" cy="8" r="1.5" fill="currentColor" />
    <circle cx="15" cy="8" r="1.5" fill="currentColor" />
  </svg>
)

const DeleteIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden="true"
  >
    <path d="M6 2H10L11 4H5L6 2Z" fill="currentColor" />
    <rect x="3" y="4" width="10" height="1.5" rx="0.5" fill="currentColor" />
    <path
      d="M4.5 5.5L5 13.5H11L11.5 5.5H4.5Z"
      stroke="currentColor"
      strokeWidth="1"
      fill="none"
    />
    <line x1="7" y1="7" x2="7" y2="12" stroke="currentColor" strokeWidth="1" />
    <line x1="9" y1="7" x2="9" y2="12" stroke="currentColor" strokeWidth="1" />
  </svg>
)

const ClearAllIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden="true"
  >
    <line x1="2" y1="2" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" />
    <line x1="14" y1="2" x2="2" y2="14" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1" />
  </svg>
)

interface ToolButtonProps {
  label: string
  isActive?: boolean
  onClick: () => void
  children: React.ReactNode
  title: string
}

function ToolButton({ label, isActive = false, onClick, children, title }: ToolButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={isActive}
      title={title}
      onClick={onClick}
      className={[
        'flex items-center justify-center w-8 h-8 rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
        isActive
          ? 'bg-blue-600 text-white'
          : 'text-gray-400 hover:bg-gray-700 hover:text-white',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

const TOOLS: { id: DrawingTool; label: string; title: string; Icon: React.FC }[] = [
  { id: 'cursor', label: '커서', title: '선택 (커서)', Icon: CursorIcon },
  { id: 'trendline', label: '추세선', title: '추세선 그리기', Icon: TrendlineIcon },
  { id: 'horizontal', label: '수평선', title: '수평선 그리기', Icon: HorizontalIcon },
  { id: 'delete', label: '삭제', title: '드로잉 삭제 모드', Icon: DeleteIcon },
]

export function DrawingToolbar({
  currentTool,
  onToolChange,
  onClearAll,
}: DrawingToolbarProps) {
  return (
    <div
      role="toolbar"
      aria-label="드로잉 도구"
      className="flex flex-col gap-1 p-1 bg-gray-900 border border-gray-700 rounded-md"
    >
      {TOOLS.map(({ id, label, title, Icon }) => (
        <ToolButton
          key={id}
          label={label}
          title={title}
          isActive={currentTool === id}
          onClick={() => onToolChange(id)}
        >
          <Icon />
        </ToolButton>
      ))}

      <div className="h-px bg-gray-700 my-1" role="separator" aria-orientation="horizontal" />

      <ToolButton
        label="전체 삭제"
        title="모든 드로잉 삭제"
        onClick={onClearAll}
      >
        <ClearAllIcon />
      </ToolButton>
    </div>
  )
}

export default DrawingToolbar
