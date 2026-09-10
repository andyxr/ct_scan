'use client'

import { useEffect, useState } from 'react'
import FlowgaugeLogo from '@/components/FlowgaugeLogo'

/** How long the overlay stays up before it starts fading out. */
const HOLD_MS = 1500
const FADE_MS = 400

/**
 * Boot animation: the logo springs up in the centre of the screen, painted
 * over the app, then fades out and unmounts itself.
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
      <FlowgaugeLogo />
    </div>
  )
}
