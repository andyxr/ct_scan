/**
 * The pens for the Paper theme, referenced from globals.css as `filter: url(#...)`.
 * Inert unless a rule references them, so other themes pay nothing.
 *
 * - `paper-pen` draws a chart stroke twice with slow, slightly different wanders,
 *   the way a sketched line is gone over. Displacement stays within ±3.5px so a
 *   point still sits on its value.
 * - `paper-hatch` turns a solid fill (bars, bands) into coloured diagonal strokes
 *   inside a wobbly outline, keeping the series colour. Strokes and outline are
 *   boosted in alpha, so a fill drawn translucent still reads as a firm pen.
 * - `paper-sketch` wobbles HTML borders drawn on pseudo-elements.
 *
 * Chart filters use userSpaceOnUse with a viewport-sized region: a horizontal
 * reference line has a zero-height bounding box, which would clip it to nothing
 * under the default objectBoundingBox region. Noise is in user space too, so a
 * chart redraws with the same hand each time rather than shimmering.
 *
 * lib/png.ts copies any referenced filter into an exported chart, so a PNG keeps
 * the hand-drawn look.
 */
const HATCH_TILE =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><path d="M-2,2 l4,-4 M0,10 l10,-10 M8,12 l4,-4" stroke="#000" stroke-width="2.2" stroke-linecap="round"/></svg>'
  )

export default function PaperFilters() {
  return (
    <svg aria-hidden="true" width="0" height="0" style={{ position: 'absolute' }}>
      <defs>
        <filter
          id="paper-pen"
          filterUnits="userSpaceOnUse"
          x="-5%"
          y="-5%"
          width="110%"
          height="110%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="2" seed="3" result="wander" />
          <feTurbulence type="fractalNoise" baseFrequency="0.016" numOctaves="2" seed="9" result="wander2" />
          <feDisplacementMap in="SourceGraphic" in2="wander" scale="7" xChannelSelector="R" yChannelSelector="G" result="first" />
          <feDisplacementMap in="SourceGraphic" in2="wander2" scale="7" xChannelSelector="G" yChannelSelector="R" result="second" />
          <feComponentTransfer in="second" result="ghost">
            <feFuncA type="linear" slope="0.55" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode in="ghost" />
            <feMergeNode in="first" />
          </feMerge>
        </filter>

        <filter
          id="paper-hatch"
          filterUnits="userSpaceOnUse"
          x="-5%"
          y="-5%"
          width="110%"
          height="110%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="2" seed="3" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="7" xChannelSelector="R" yChannelSelector="G" result="shape" />
          <feImage href={HATCH_TILE} x="0" y="0" width="10" height="10" result="tile" />
          <feTile in="tile" result="tiled" />
          <feDisplacementMap in="tiled" in2="noise" scale="6" xChannelSelector="G" yChannelSelector="R" result="hatch" />
          <feComposite in="shape" in2="hatch" operator="in" result="hatched" />
          <feComponentTransfer in="hatched" result="strokes">
            <feFuncA type="linear" slope="2.2" />
          </feComponentTransfer>
          <feMorphology in="shape" operator="erode" radius="1.5" result="inner" />
          <feComposite in="shape" in2="inner" operator="out" result="edge" />
          <feComponentTransfer in="edge" result="outline">
            <feFuncA type="linear" slope="2.5" />
          </feComponentTransfer>
          <feComponentTransfer in="shape" result="wash">
            <feFuncA type="linear" slope="0.12" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode in="wash" />
            <feMergeNode in="strokes" />
            <feMergeNode in="outline" />
          </feMerge>
        </filter>

        <filter id="paper-sketch" x="-3%" y="-3%" width="106%" height="106%">
          <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="11" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="4" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  )
}
