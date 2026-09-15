# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary user is a delivery coach or agile practitioner presenting findings to a
team. They are not alone at a desk: they are sharing a screen in a room or on a
call, walking a team through what the data says about how work actually flows.
Charts are projected, and they are exported as PNGs into decks and reports that
outlive the session.

Two consequences follow, and both are binding. Type and chart marks must stay
legible at projection distance and at a viewer's reduced screen share resolution,
not merely at a laptop's reading distance. And every chart is a future raster in
someone else's document, so the exported image must read correctly away from the
app's own chrome.

## Product Purpose

Flowgauge turns a CSV of completed work items into an honest read on a team's
delivery. The user uploads one row per completed item; the app derives cycle time
from the dates and offers four analyses:

- **Cycle time scatterplot** with 50th/75th/85th/95th percentile lines, optional
  sprint and average overlays, and an SLE (Service Level Expectation) assessment
  that reports status, tail concentration, per-type breakdown and trend.
- **Process behaviour chart** (Wheeler/Shewhart) with central line, process
  limits by the median moving range method, a moving range chart, and signal
  detection for points outside limits and runs of 8+ on one side.
- **Correlation analysis** comparing estimates against actual cycle times.
- **Monte Carlo forecast** sampling historical throughput, answering both
  "how many items by a date" and "when will N items be done", at 50/85/95%
  confidence.

Success is a team seeing something true about their process that they would not
have seen in a burndown, and being able to take the picture away with them.

## Positioning

The app's point of view is that averages and estimates mislead, and that
distribution, variation and probability tell the truth. This shows in the product
itself, not just its output: the scatterplot states what percentage of items a
forecast based on the average would actually be right for; the process behaviour
chart states plainly that a chart with no red points is evidence of stability and
not proof; the SLE panel separates findings derived from the user's data from
general guidance that is not. That refusal to overclaim is the product's
character and must survive any visual change.

## Operating Context

Entirely client-side: the CSV never leaves the browser, parsed with Papaparse in
the page. There is no account, no backend and no persistence, so the whole
experience is one session — upload, choose an analysis, explore, export.

The workflow is linear and shallow: splash, then upload (or demo data), then a
four-way analysis choice, then a single analysis at a time with a persistent nav
between them and an item-type filter across all of them.

Two behaviours shape every screen. Each analysis panel has a **maximised mode**
that takes over the full viewport and hides its explanatory prose, for projecting
the chart alone. Each has a **PNG export** that rasterises the chart region.

## Capabilities and Constraints

- Next.js 15 App Router, React 18, TypeScript strict, Tailwind CSS 4, Recharts 3.2,
  Lucide icons, Papaparse. Vitest for the lib layer.
- The current visual system is implemented as a **Tailwind token remap** in
  `app/globals.css`: `:root` rebinds `--color-gray-*`, `--color-blue-*` and every
  `--radius-*`, so existing utility classes across all components resolve to the
  new values without being edited. Shadows are overridden per utility because
  `.shadow-md` inlines its value. Any replacement world should use this same
  mechanism rather than editing classes across twenty components.
- Chart colours live in `lib/colours.ts` (item-type palette) and inline in the
  analysis components (percentile lines, control limits, signal marks).
- Columns are detected flexibly: header matching ignores case, spaces, underscores
  and hyphens, and accepts common alternatives. Dates are detected per value, so
  DD/MM/YYYY and ISO timestamps both parse.
- `estimate` is optional and gates correlation analysis; `item_type` is optional
  and adds a filter and per-type colouring.
- Reduced-motion is already honoured for every existing animation, and must stay
  honoured.

## Brand Commitments

- The name **Flowgauge** stays.
- The mark stays: five bars springing up like a histogram filling in, with the
  wordmark beneath. It appears on the boot splash, where the bars loop.
- The product's voice is plain, specific and unwilling to overclaim. It names its
  own limits in the interface copy. Keep that.

## Evidence on Hand

- `lib/demoData.ts` provides 30 sample items with estimates and types across three
  months, used by the "Use demo data" path.
- All analytical copy in the app is derived from real computation over the user's
  file. There are no testimonials, customers, benchmarks, pricing or deployment
  claims anywhere in the product, and none may be invented.

## Product Principles

1. **The distribution is the message.** Percentiles, variation and probability
   lead; averages and single numbers are shown with their limits stated.
2. **Never overclaim.** Where the data cannot support a conclusion, the interface
   says so. Findings derived from the user's data stay visibly separate from
   general guidance.
3. **Every chart is a future export.** A chart must read correctly at projection
   distance and as a PNG in a document that carries none of the app's chrome.
4. **The file is the session.** No account, no persistence, nothing leaves the
   browser; the path from CSV to insight stays short and linear.
5. **Motion confirms, never decorates.** Existing animation exists to answer
   "which point is the pointer on" and "where is the signal", and is silenced
   under reduced-motion.

## Accessibility & Inclusion

Chart series must stay distinguishable for common colour-vision deficiencies:
the existing item-type palette deliberately varies hue *and* lightness rather
than relying on a red/green split, and any replacement palette must do the same.
Signals on the process behaviour chart are marked by more than colour alone
(radius and a halo) and must remain so. Reduced-motion is honoured throughout.
