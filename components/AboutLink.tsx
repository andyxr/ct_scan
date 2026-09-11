'use client'

import { useState } from 'react'
import AboutModal from '@/components/AboutModal'

export default function AboutLink() {
  const [open, setOpen] = useState(false)

  return (
    <div className="fixed top-8 right-8 z-50 pl-3 bg-gray-50">
      {open && <AboutModal onClose={() => setOpen(false)} />}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-gray-700 hover:text-gray-900 underline"
      >
        About
      </button>
    </div>
  )
}
