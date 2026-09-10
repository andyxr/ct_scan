'use client'

/**
 * The Flowgauge mark: five bars springing up like a histogram filling in,
 * with the wordmark beneath. `loop` keeps the bars cycling forever; without
 * it they spring up once, as on the boot splash.
 */
export default function FlowgaugeLogo({ loop = false }: { loop?: boolean }) {
  const bars = [26, 46, 34, 64, 44]
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex h-20 items-end gap-2">
        {bars.map((h, i) => (
          <span
            key={i}
            className={`${loop ? 'splash-bar-loop' : 'splash-bar'} w-4 rounded-md bg-blue-600 dark:bg-blue-400`}
            style={{ height: h, animationDelay: `${110 * i}ms` }}
          />
        ))}
      </div>
      <span className="splash-word text-lg font-semibold tracking-[0.3em] text-gray-900 dark:text-gray-100 uppercase">
        Flowgauge
      </span>
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

        @keyframes splash-bar-loop {
          0%   { transform: scaleY(0.15); opacity: 0; }
          20%  { transform: scaleY(1.15); opacity: 1; }
          30%  { transform: scaleY(1); opacity: 1; }
          75%  { transform: scaleY(1); opacity: 1; }
          90%  { transform: scaleY(0.15); opacity: 0; }
          100% { transform: scaleY(0.15); opacity: 0; }
        }
        .splash-bar-loop {
          transform-origin: bottom;
          animation: splash-bar-loop 2800ms cubic-bezier(0.34, 1.56, 0.64, 1) infinite both;
        }

        @media (prefers-reduced-motion: reduce) {
          .splash-word, .splash-bar, .splash-bar-loop {
            animation-duration: 1ms !important;
            animation-iteration-count: 1 !important;
          }
        }
      `}</style>
    </div>
  )
}
