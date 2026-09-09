'use client'

import { useEffect, useRef, useState } from 'react'
import { Download } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { exportSvgToPng } from '@/lib/png'

type Status = 'idle' | 'exporting' | 'error'

const LABELS: Record<Status, string> = {
  idle: 'Export PNG',
  exporting: 'Exporting...',
  error: 'Export failed',
}

interface ExportPngButtonProps {
  targetRef: React.RefObject<HTMLDivElement | null>
  filename: string
}

export default function ExportPngButton({ targetRef, filename }: ExportPngButtonProps) {
  const [status, setStatus] = useState<Status>('idle')
  const { theme } = useTheme()
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (resetTimer.current !== null) {
        clearTimeout(resetTimer.current)
      }
    }
  }, [])

  const handleClick = async () => {
    const svg = targetRef.current?.querySelector('svg')
    if (!svg) {
      setStatus('error')
      resetTimer.current = setTimeout(() => setStatus('idle'), 3000)
      return
    }

    setStatus('exporting')
    try {
      await exportSvgToPng(svg, filename, theme === 'dark' ? '#1f2937' : '#ffffff')
      setStatus('idle')
    } catch {
      setStatus('error')
      resetTimer.current = setTimeout(() => setStatus('idle'), 3000)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={status === 'exporting'}
      className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 disabled:opacity-50"
    >
      <Download className="w-4 h-4" />
      {LABELS[status]}
    </button>
  )
}
