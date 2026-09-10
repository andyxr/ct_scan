'use client'

import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  title: string
  // Visually hidden title, for dialogs whose content already carries a heading.
  hideTitle?: boolean
  onClose: () => void
  children: ReactNode
}

/** Centred dialog over a dimmed page. Closes on Escape, the X, or a backdrop click. */
export default function Modal({ title, hideTitle = false, onClose, children }: ModalProps) {
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
        aria-labelledby="modal-title"
        onClick={event => event.stopPropagation()}
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 shadow-lg p-8"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 p-1 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
        <h2
          id="modal-title"
          className={hideTitle ? 'sr-only' : 'text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 pr-8'}
        >
          {title}
        </h2>
        {children}
      </div>
    </div>
  )
}
