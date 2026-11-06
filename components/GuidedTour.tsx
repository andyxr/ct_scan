'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Compass, X } from 'lucide-react'
import { TOUR_STEPS, type TourStep } from '@/lib/tour'

/** Breathing room between the spotlight's ring and the element it frames. */
const SPOTLIGHT_PAD = 6

/** Toast position, shared by the tour and its offer so one replaces the other in place. */
const TOAST_POSITION = 'fixed bottom-4 left-4 right-4 z-[70] sm:left-auto sm:w-[25rem]'

const BUTTON_PRIMARY = 'px-3 py-1.5 text-sm font-bold bg-blue-600 text-white border border-blue-600 hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2'
const BUTTON_SECONDARY = 'px-3 py-1.5 text-sm border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'
const BUTTON_QUIET = 'text-sm text-gray-600 underline hover:text-gray-900'

const queryTour = (name: string) => document.querySelector<HTMLElement>(`[data-tour="${name}"]`)

const sameRect = (a: DOMRect | null, b: DOMRect) =>
  a !== null && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height

/**
 * Each frame, sets the step's control (once), finds its target and reports
 * where it sits. Polling rather than observing because the targets arrive by
 * dynamic import and move on scroll, resize and data load alike; one cheap
 * rect read per frame covers all of them.
 */
function useStepTarget(step: TourStep): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    let frame = 0
    let ensured = !step.ensure
    let scrolled = false

    const tick = () => {
      if (!ensured && step.ensure) {
        const control = queryTour(step.ensure.target)
        if (control) {
          if (control.dataset.tourState !== step.ensure.state) control.click()
          ensured = true
        }
      }

      const el = step.target ? queryTour(step.target) : null
      const next = el?.getBoundingClientRect()
      if (el && next && next.height > 0) {
        if (!scrolled) {
          scrolled = true
          const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
          el.scrollIntoView({
            behavior: reduce ? 'auto' : 'smooth',
            block: next.height > window.innerHeight * 0.6 ? 'start' : 'center',
          })
        }
        setRect(prev => (sameRect(prev, next) ? prev : next))
      } else {
        setRect(null)
      }
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [step])

  return rect
}

/**
 * Tours always run in the Default theme, so every step looks the way its copy
 * describes. The stored theme is untouched; the attribute alone is swapped and
 * put back on exit, unless the user picked another theme mid-tour.
 */
function useDefaultTheme() {
  useEffect(() => {
    const root = document.documentElement
    const previous = root.dataset.theme
    root.dataset.theme = 'default'
    return () => {
      if (root.dataset.theme !== 'default') return
      if (previous) root.dataset.theme = previous
      else delete root.dataset.theme
    }
  }, [])
}

interface GuidedTourProps {
  index: number
  onNavigate: (index: number) => void
  onEnd: () => void
}

/**
 * The guided tour: a toast carrying each step's copy, and a spotlight that dims
 * the page around the element the step is about. The spotlight never takes
 * pointer events, so the user can try a control while its step is up.
 */
export default function GuidedTour({ index, onNavigate, onEnd }: GuidedTourProps) {
  const step = TOUR_STEPS[index]
  const last = index === TOUR_STEPS.length - 1
  const rect = useStepTarget(step)
  const nextRef = useRef<HTMLButtonElement>(null)

  useDefaultTheme()

  useEffect(() => {
    nextRef.current?.focus({ preventScroll: true })
  }, [index])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') return onEnd()
      // Arrow keys belong to whatever field has focus: a date or number input needs them.
      const field = event.target instanceof HTMLElement && event.target.closest('input, select, textarea')
      if (field) return
      if (event.key === 'ArrowRight') onNavigate(Math.min(index + 1, TOUR_STEPS.length - 1))
      if (event.key === 'ArrowLeft') onNavigate(Math.max(index - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, onNavigate, onEnd])

  return createPortal(
    <>
      {rect ? <Spotlight rect={rect} /> : <div aria-hidden className="tour-dim pointer-events-none fixed inset-0 z-[60]" />}

      <section
        role="dialog"
        aria-modal="false"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        className={`${TOAST_POSITION} tour-toast border-2 border-gray-900 bg-white text-gray-700 shadow-lg`}
      >
        <header className="sheet-banner flex items-center gap-2 px-3 py-1.5">
          <Compass className="h-4 w-4" aria-hidden="true" />
          <span className="sheet-figure text-[0.6875rem] uppercase tracking-[0.12em]">
            Guided tour · {index + 1} of {TOUR_STEPS.length}
          </span>
          <button
            type="button"
            onClick={onEnd}
            aria-label="Close tour"
            className="ml-auto p-0.5 hover:opacity-75"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        {/* Keyed so each step re-runs the entrance and is announced afresh. */}
        <div key={step.id} aria-live="polite" className="tour-step px-4 pt-3">
          <h2 id="tour-title" className="text-lg font-bold tracking-[0.06em] text-gray-900">{step.title}</h2>
          <p id="tour-body" className="mt-1 text-sm leading-relaxed">{step.body}</p>
        </div>

        <ol aria-hidden className="mx-4 mt-3 flex gap-1">
          {TOUR_STEPS.map((s, i) => (
            <li key={s.id} className={`h-1 flex-1 ${i <= index ? 'bg-blue-600' : 'bg-gray-200'}`} />
          ))}
        </ol>

        <div className="flex items-center gap-2 px-4 py-3">
          {!last && (
            <button type="button" onClick={onEnd} className={BUTTON_QUIET}>
              Skip tour
            </button>
          )}
          <div className="ml-auto flex gap-2">
            {index > 0 && (
              <button type="button" onClick={() => onNavigate(index - 1)} className={BUTTON_SECONDARY}>
                Back
              </button>
            )}
            <button
              ref={nextRef}
              type="button"
              onClick={() => (last ? onEnd() : onNavigate(index + 1))}
              className={BUTTON_PRIMARY}
            >
              {last ? 'Finish' : index === 0 ? 'Start' : 'Next'}
            </button>
          </div>
        </div>
      </section>
    </>,
    document.body
  )
}

/** A ring around the target, with the rest of the viewport dimmed by its outer shadow. */
function Spotlight({ rect }: { rect: DOMRect }) {
  // Clipped to the viewport: a tall panel would otherwise put its ring off screen.
  const top = Math.max(rect.top - SPOTLIGHT_PAD, 2)
  const left = Math.max(rect.left - SPOTLIGHT_PAD, 2)
  const bottom = Math.min(rect.bottom + SPOTLIGHT_PAD, window.innerHeight - 2)
  const right = Math.min(rect.right + SPOTLIGHT_PAD, window.innerWidth - 2)

  return (
    <div
      aria-hidden
      className="tour-spotlight pointer-events-none fixed z-[60]"
      style={{ top, left, width: Math.max(right - left, 0), height: Math.max(bottom - top, 0) }}
    />
  )
}

interface TourOfferProps {
  onStart: () => void
  onDismiss: () => void
}

/** The opt-in: a toast offering the tour, never a modal that blocks the first look at the app. */
export function TourOffer({ onStart, onDismiss }: TourOfferProps) {
  return createPortal(
    <section
      role="status"
      aria-labelledby="tour-offer-title"
      className={`${TOAST_POSITION} tour-toast border-2 border-gray-900 bg-white text-gray-700 shadow-lg`}
    >
      <div className="flex gap-3 px-4 pt-3">
        <Compass className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" aria-hidden="true" />
        <div>
          <h2 id="tour-offer-title" className="font-bold tracking-[0.06em] text-gray-900">New to Flowgauge?</h2>
          <p className="mt-1 text-sm">A two-minute guided tour shows how to load data and read each chart.</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="ml-auto self-start p-0.5 text-gray-500 hover:text-gray-900"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="flex justify-end gap-2 px-4 py-3">
        <button type="button" onClick={onDismiss} className={BUTTON_SECONDARY}>
          No thanks
        </button>
        <button type="button" onClick={onStart} className={BUTTON_PRIMARY}>
          Take the tour
        </button>
      </div>
    </section>,
    document.body
  )
}
