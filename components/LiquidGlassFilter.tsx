/**
 * The lens for the Liquid Glass theme, referenced from globals.css as
 * `backdrop-filter: url(#lg-refract)`. Low-frequency noise drives a displacement
 * map, so the backdrop seen through a pane bends the way thick glass does; the
 * blur that follows in the CSS frosts it. Inert unless a rule references it.
 *
 * Only Chromium applies an SVG filter as a backdrop-filter, so the boot script in
 * lib/theme.ts sets `data-glass-refract` there and the CSS gates the warp on it.
 */
export default function LiquidGlassFilter() {
  return (
    <svg aria-hidden="true" width="0" height="0" style={{ position: 'absolute' }}>
      <filter id="lg-refract" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.006 0.009" numOctaves="2" seed="7" result="noise" />
        <feGaussianBlur in="noise" stdDeviation="2" result="softNoise" />
        <feDisplacementMap in="SourceGraphic" in2="softNoise" scale="46" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  )
}
