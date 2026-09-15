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
      {/* The ink and the text size on the panel are both load-bearing, not
          decoration. A modal is a fixed overlay but still a DOM child of
          whatever opened it, and the About and sprint dialogs open from a
          control inside .sheet-banner — so without these, the banner's
          reversed-out stock ink paints every unclassed child stock-on-stock,
          and its 0.6875rem field-label size shrinks the dialog's prose to 11px.
          Setting both here means a modal never depends on the ground it opened
          from, and anything added to one later inherits a readable default. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={event => event.stopPropagation()}
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-white border border-gray-300 shadow-lg p-8 text-gray-700 text-[1.1rem]"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 p-1 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
        <h2
          id="modal-title"
          className={hideTitle ? 'sr-only' : 'text-xl font-semibold text-gray-900 mb-4 pr-8'}
        >
          {title}
        </h2>
        {children}
      </div>
    </div>
  )
}
