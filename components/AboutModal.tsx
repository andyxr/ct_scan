'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import FlowgaugeLogo from '@/components/FlowgaugeLogo'

export default function AboutModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        onClick={event => event.stopPropagation()}
        className="relative w-full max-w-md rounded-lg bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 shadow-lg p-8"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 p-1 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
        <h2 id="about-title" className="sr-only">About Flowgauge</h2>
        <FlowgaugeLogo loop />
        <p className="mt-8 text-center text-gray-700 dark:text-gray-300 leading-relaxed">
          Flowgauge was developed by Andy Deighton of <a href="https://ljomi-systems.com" target="_blank" rel="noopener noreferrer" className="underline text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200">Ljomi Systems Ltd</a>. Why spend
     
          money on 3rd party software when you can use Flowgauge instead? More
          features coming soon!
        </p>
      </div>
    </div>
  )
}
