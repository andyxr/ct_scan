---
name: Flowgauge
description: A delivery-flow analyser drawn as a quality office's log sheet.
colors:
  ledger-stock: "#f2efe4"
  ledger-stock-deep: "#e8e4d5"
  ledger-stock-raised: "#faf8f1"
  printed-rule: "#c9c3ad"
  printed-rule-strong: "#a8a08a"
  press-ink: "#191813"
  press-ink-soft: "#55513f"
  press-ink-faint: "#7d7863"
  process-red: "#a8321f"
  process-red-deep: "#7d2416"
  ledger-green: "#2f6b4f"
  operator-blue: "#24527a"
  pencil-amber: "#9a6a15"
typography:
  display:
    fontFamily: "Roboto Condensed, Arial Narrow, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.08em"
  headline:
    fontFamily: "Roboto Condensed, Arial Narrow, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.2em"
  title:
    fontFamily: "Roboto Condensed, Arial Narrow, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "0.14em"
  body:
    fontFamily: "Roboto Condensed, Arial Narrow, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Roboto Condensed, Arial Narrow, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "0.1em"
  figure:
    fontFamily: "Roboto Mono, ui-monospace, monospace"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "normal"
    fontFeature: "tabular-nums lining-nums"
rounded:
  all: "0"
spacing:
  rule-pitch: "30px"
  field-x: "12px"
  field-y: "8px"
  panel: "24px"
components:
  sheet-banner:
    backgroundColor: "{colors.press-ink}"
    textColor: "{colors.ledger-stock}"
    rounded: "{rounded.all}"
    padding: "12px 16px"
  sheet-field:
    textColor: "{colors.ledger-stock}"
    typography: "{typography.label}"
    rounded: "{rounded.all}"
    padding: "4px 8px"
  sheet-panel:
    backgroundColor: "transparent"
    textColor: "{colors.press-ink}"
    rounded: "{rounded.all}"
    padding: "{spacing.panel}"
  reading:
    backgroundColor: "transparent"
    textColor: "{colors.press-ink}"
    typography: "{typography.figure}"
    rounded: "{rounded.all}"
    padding: "8px 12px"
  nav-tab:
    backgroundColor: "{colors.ledger-stock-raised}"
    textColor: "{colors.press-ink-soft}"
    rounded: "{rounded.all}"
    padding: "6px 12px"
  nav-tab-active:
    backgroundColor: "{colors.operator-blue}"
    textColor: "{colors.ledger-stock-raised}"
    rounded: "{rounded.all}"
    padding: "6px 12px"
  entry-field:
    backgroundColor: "{colors.ledger-stock-deep}"
    textColor: "{colors.press-ink}"
    rounded: "{rounded.all}"
    padding: "24px"
---

# Design System: Flowgauge

## Overview

**Creative North Star: "The Quality Office Log Sheet"**

Flowgauge is drawn as the ruled form a quality office pins by the production line: ledger stock under a printed rule, hairline borders, square corners, and ink that only ever means something. Shewhart invented the control chart and Flowgauge implements his limits, so the world and the mathematics share a lineage — this is not a paper texture applied to a dashboard, it is the artefact the analysis actually comes from.

The system refuses two neighbouring defaults: the dark analytics dashboard with neon accents and card tiles, and its clean-SaaS opposite. Nothing floats on a neutral ground here. A sheet has edges, a header and a footer rule, and every panel sits *on* the printing rather than hovering above it. Density is high and deliberate; whitespace is the unfilled part of a form, not luxury.

The surface is read aloud. The primary user is a delivery coach presenting to a team on a shared screen, and every chart is a future PNG in someone else's deck — so type holds at projection distance, figures are monospaced and tabular, and the export path carries the stock and the mono face with it rather than reverting to a white tile.

**Key Characteristics:**
- Ledger stock with a continuous 30px printed rule, visible in every margin
- Zero radius everywhere; a printed form has no rounded corners
- Three working inks with fixed meanings, and nothing else coloured
- Every number set in monospace with tabular lining figures
- Hairline rules and 2px field boundaries instead of shadows

## Colors

A warm ledger ground carrying near-black press ink, with three saturated working inks that are permitted only where they carry meaning.

### Primary
- **Operator Blue** (`{colors.operator-blue}`): anything the user set by hand — active analysis tab, the 85th percentile line, the process line on the behaviour chart, the 50% confidence mark, zoom selection wash, native control accent, and the focus ring.

### Secondary
- **Process Red** (`{colors.process-red}`): deviation, always. Upper and lower process limits, special-cause points and their halo, the 95th percentile, the 95% confidence mark, out-of-range readings. **Process Red Deep** (`{colors.process-red-deep}`) strokes the signal dot so a red point still reads as a mark, not a blur.
- **Ledger Green** (`{colors.ledger-green}`): the process describing itself. Central line, median moving range, the 75th percentile, the 85% confidence mark, and the default scatter point.

### Tertiary
- **Pencil Amber** (`{colors.pencil-amber}`): the operator's annotation over the record — sprint length overlay, moving-range trace, caution blocks. It is commentary on the sheet, never a finding from it.

### Neutral
- **Ledger Stock** (`{colors.ledger-stock}`): the page itself, and the ground for maximised chart views.
- **Ledger Stock Raised** (`{colors.ledger-stock-raised}`): a filled field — tooltips, entry boxes, the knocked-back plot band, and the PNG export background.
- **Ledger Stock Deep** (`{colors.ledger-stock-deep}`): recessed fill for control strips and scrollbar tracks.
- **Printed Rule** (`{colors.printed-rule}`) and **Printed Rule Strong** (`{colors.printed-rule-strong}`): the sheet's ruling and its hairline borders; the chart grid uses the lighter of the two.
- **Press Ink** (`{colors.press-ink}`), **Soft** (`{colors.press-ink-soft}`), **Faint** (`{colors.press-ink-faint}`): the text ramp, from headings through axis labels to placeholders.

### Named Rules

**The Three Inks Rule.** Red means deviation, green means the process, blue means the operator's hand. A colour never carries a second meaning, and a fourth working ink is never introduced. If a new element needs colour, it must map to one of the three or take ink.

**The Meaningless Hue Rule.** Hues with no role on a log sheet are folded into a working ink rather than allowed through: purple and orange resolve to operator blue and pencil amber respectively, so a stray utility class still lands inside the world.

**The Series Separability Rule.** Item-type series vary in hue *and* lightness, never by hue alone, so the scatterplot stays readable under common colour-vision deficiencies and in greyscale print. Eight inks cycle: ledger green, operator blue, pencil amber, aniline violet (`#6b3f6e`), verdigris (`#1f6f74`), process red, olive (`#4f6b23`), sienna (`#8a4b2a`).

## Typography

**Display Font:** Roboto Condensed (with Arial Narrow, sans-serif)
**Body Font:** Roboto Condensed (with Arial Narrow, sans-serif)
**Label/Mono Font:** Roboto Mono (with ui-monospace, monospace)

**Character:** A condensed grotesque sets the form's own field names — compressed, uppercase, tracked out, the way a printed form labels what goes where. Every number defects to mono, because a column of figures only reads as a column when the digits align.

### Hierarchy
- **Wordmark** (700, 1.5rem, tracking 0.2em, uppercase): "FLOWGAUGE" in the banner, reversed out of press ink.
- **Panel Heading** (700, 1.5rem, tracking 0.08em, uppercase): each analysis title, sitting on a heading rule that runs to the margin.
- **Section Title** (700, 0.875rem, tracking 0.14em, uppercase): subsections within a panel — "Moving Range", "Forecast Results", "Available Analyses".
- **Body** (400, 0.875rem, line-height 1.5): explanatory prose and findings. Measure runs wide inside a panel; the surrounding rule carries the structure.
- **Field Label** (700, 0.6875rem, tracking 0.1em, uppercase): reading labels, stamped banner fields, footer marks.
- **Figure** (700, 1.125rem, mono, tabular lining): every recorded value.

### Named Rules

**The Mono Figures Rule.** Any number a user reads as data sets in Roboto Mono with `tabular-nums lining-nums` — readings, inputs, selects, code, and all Recharts axis text. SVG chart text is outside the body cascade and is targeted explicitly; a chart whose axes fall back to the sans face has broken the rule.

**The Export Parity Rule.** The PNG export names the same mono family and tabular figures the screen uses, resolved from the live custom property. An exported chart that renders in a different face than the screen it was taken from is a defect, not a cosmetic difference.

## Layout

The sheet is a full-height column: ink banner, then a flexible ruled body, then a footer rule that closes the page at the foot of the viewport rather than floating under short content.

The printed rule is the spine — a 30px repeating horizontal line at 55% rule opacity, crossed by a vertical line at 28%, painted on the body so it shows in every margin the panels do not cover. Panels do not erase it; they box a region of it.

Content sits in a centred container with 16px side padding and 32px vertical padding. Readings rows are CSS grids that carry the opening rules on the container (`border-l border-t`) with each cell closing its own right and bottom edge, so boxes share edges the way a printed table does — two to five columns depending on how many readings a chart produces.

Chart panels have fixed heights by analysis (scatterplot 48rem, behaviour chart 20rem with a 16rem moving-range companion, forecast 20rem, correlation 24rem) and take the full viewport when maximised for projection.

## Elevation & Depth

This system has no shadows in the conventional sense. Depth on paper is a crease, not a float.

Where Tailwind's shadow utilities land, they are rebound to a single hairline offset down and right in the rule colour (`1px 1px 0 0 #a8a08a`, doubling to `2px 2px 0 0` on hover) — the impression of one sheet resting on another, never a soft grey halo. Layering is otherwise tonal: raised stock for a filled field, deep stock for a recessed strip, and rule weight for hierarchy.

Field boundaries carry the structure instead. A panel is bounded by 2px press-ink rules top and bottom with hairline rule-strong sides; a plot band is a knocked-back fill at 82% raised stock with a 1px rule outline.

### Named Rules

**The Crease-Not-Float Rule.** Depth is expressed by rule weight and tonal fill. If an element needs to feel lifted, give it a heavier boundary rule, never a blur.

## Shapes

Square, without exception. Every radius token is `0`, so any `rounded-*` utility anywhere in the codebase resolves flat. Borders do the work radius would: 1px hairlines for ordinary divisions, 2px press ink for a field's top and bottom boundary, 1px currentColor for a stamped field that must read against whatever ground it sits on.

The one non-orthogonal gesture in the system is the rubber stamp — a 2px boxed uppercase mono label rotated -2.5° at 92% opacity, for status marked onto the sheet rather than printed with it.

## Components

### Sheet Banner
The form's printed title bar: solid press ink, full width, reversed-out stock text, closed by a 2px ink rule. Carries the wordmark, a standing descriptor, and the stamped fields for the loaded file.

### Stamped Field
- **Style:** 1px `currentColor` box, uppercase mono, 0.04em tracking, 4px/8px padding
- **Use:** a fact recorded on the sheet — item count, date span, type count, the About action
- **Behaviour:** fields appear only once there is an entry; a form does not print empty values

### Sheet Panel
- **Corner Style:** square (0)
- **Background:** transparent — the stock's ruling continues through the panel
- **Border:** 2px press ink top and bottom, 1px rule-strong left and right
- **Internal Padding:** 24px
- **Shadow Strategy:** none; see Elevation & Depth

### Reading
- **Style:** hairline-bounded grid cell; uppercase label at 0.6875rem over a mono figure at 1.125rem
- **Ink:** defaults to press ink; takes a working ink when the value carries that meaning (red for control limits and special causes, green for the central line and conservative confidence)
- **Optional note:** a small-caps qualifier under the figure, for what a confidence level means

### Navigation
- **Style:** inline row of bordered tabs, 6px/12px padding, square, each with a 16px Lucide icon
- **Default:** raised stock ground, soft ink text, rule-strong border
- **Active:** operator blue ground, raised-stock text, blue border
- **Disabled:** stock-deep ground, faint ink, not-allowed cursor, reason surfaced on the row itself
- **Trailing:** "Upload different file" as an underlined text action pushed to the right margin

### Inputs / Fields
- **Style:** 1px rule-strong border, square, mono tabular value, 4px/8px padding
- **Focus:** 2px operator-blue outline at 1px offset (global `:focus-visible`)
- **Native controls:** `accent-color` is operator blue, so checkboxes and range inputs sit inside the world

### Entry Field (upload targets)
- **Style:** 1px press-ink border, 50%-opacity stock-deep fill, 24px padding, centred
- **Hover:** fill resolves to full stock-deep
- **Dragging:** border and fill shift to operator blue
- **Character:** a ruled box waiting to be filled in, never a dashed card

### Analyses Index
The picker is a numbered list of ruled rows, not a card grid: a two-digit mono index, a 20px icon in operator blue, an uppercase title over a body description, and an arrow that slides right on hover. Unavailable rows state their reason inline in process red rather than hiding it in a tooltip.

### Chart Furniture
- **Grid:** 3-3 dashed in printed rule
- **Axis text:** mono tabular in soft ink
- **Reference lines:** 2px, dashed by role, labelled in their own ink
- **Scatter points:** 5px radius, growing by √count where items stack; mixed-type stacks take soft ink
- **Signal marks:** 5px red dot with a dark-red stroke plus an expanding halo, so a special cause is marked by size and motion as well as colour

### Named Rules

**The Browser Surfaces Rule.** Selection, caret, focus ring, placeholder and scrollbars are themed from the palette — blue selection wash at 22%, rule-strong scrollbar thumbs on a stock-deep track with a hairline border. Default browser chrome belongs to no design system.

## Do's and Don'ts

### Do:
- **Do** restyle by rebinding tokens in `app/globals.css`. Utilities across every component resolve through `:root`, so a whole-app change is a single-file change.
- **Do** set every user-readable number in mono with tabular lining figures, including SVG chart text.
- **Do** map any new coloured element to one of the three working inks, or leave it in ink.
- **Do** bound regions with rule weight — 2px press ink for a field boundary, 1px hairline for a division.
- **Do** keep the printed rule visible through panels; a panel boxes the ruling, it does not cover it.
- **Do** vary hue *and* lightness when adding a series colour, and check it in greyscale.
- **Do** carry the sheet into the PNG export — raised-stock ground and the mono face, resolved live.
- **Do** honour `prefers-reduced-motion` for every animation; existing ones degrade to a static state that still marks the signal.

### Don't:
- **Don't** introduce a radius anywhere. Every `rounded-*` resolves to 0 and should stay that way.
- **Don't** add a soft or coloured shadow. Depth is a hairline crease and tonal fill.
- **Don't** let a working ink drift from its meaning, or add a fourth.
- **Don't** use same-size cards of icon-plus-heading-plus-text as page structure; the analyses index is ruled rows for this reason.
- **Don't** float a panel on a neutral fill. Transparent ground, ruled boundary.
- **Don't** let grey text sit on a coloured ground — tint the ink from that ground instead (the SLE block uses `#6a4a0f` on amber stock).
- **Don't** substitute a Unicode glyph for an icon. Icons come from Lucide at a consistent stroke.
- **Don't** hard-code an export background or font; both resolve from the live tokens.
