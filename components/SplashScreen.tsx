'use client'

import { useEffect, useState } from 'react'

/** How long the overlay stays up before it starts fading out. */
const HOLD_MS = 1500
const FADE_MS = 400

/**
 * Boot animation: a small bar chart springs up in the centre of the screen,
 * painted over the app, then fades out and unmounts itself.
 */
export default function SplashScreen({ onDone }: { onDone?: () => void }) {
  const [leaving, setLeaving] = useState(false)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    const fade = setTimeout(() => setLeaving(true), HOLD_MS)
    const end = setTimeout(() => {
      setGone(true)
      onDone?.()
    }, HOLD_MS + FADE_MS)
    return () => {
      clearTimeout(fade)
      clearTimeout(end)
    }
  }, [onDone])

  if (gone) return null

  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-50 flex items-center justify-center bg-gray-50 dark:bg-black transition-opacity duration-[400ms] ${
        leaving ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="flex flex-col items-center gap-6">
        <StackMark />
        <span className="splash-word text-lg font-semibold tracking-[0.3em] text-gray-900 dark:text-gray-100 uppercase">
          Flowgauge
        </span>
      </div>
      <style jsx global>{`
        @keyframes splash-word-in {
          from { opacity: 0; transform: translateY(6px); letter-spacing: 0.5em; }
          to   { opacity: 1; transform: none; letter-spacing: 0.3em; }
        }
        .splash-word {
          animation: splash-word-in 700ms cubic-bezier(0.22, 1, 0.36, 1) 400ms both;
        }

        @keyframes splash-bar {
          0%   { transform: scaleY(0.15); opacity: 0; }
          60%  { transform: scaleY(1.15); opacity: 1; }
          100% { transform: scaleY(1); opacity: 1; }
        }
        .splash-bar {
          transform-origin: bottom;
          animation: splash-bar 700ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }

        @media (prefers-reduced-motion: reduce) {
          .splash-word, .splash-bar {
            animation-duration: 1ms !important;
            animation-iteration-count: 1 !important;
          }
        }
      `}</style>
    </div>
  )
}

/** Bars springing up one after another, like a histogram filling in. */
function StackMark() {
  const bars = [26, 46, 34, 64, 44]
  return (
    <div className="flex h-20 items-end gap-2">
      {bars.map((h, i) => (
        <span
          key={i}
          className="splash-bar w-4 rounded-md bg-blue-600 dark:bg-blue-400"
          style={{ height: h, animationDelay: `${110 * i}ms` }}
        />
      ))}
    </div>
  )
}
