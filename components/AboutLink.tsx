'use client'

import { useState } from 'react'
import AboutModal from '@/components/AboutModal'

export default function AboutLink() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {open && <AboutModal onClose={() => setOpen(false)} />}
      {/* Sits inside the sheet's banner, so it is reversed out of the ink rather
          than floating over the stock on its own patch of background. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="sheet-field px-2 py-1 underline decoration-1 underline-offset-2 hover:opacity-75"
      >
        About
      </button>
    </>
  )
}
