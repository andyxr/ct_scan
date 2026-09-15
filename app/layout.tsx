import type { Metadata } from 'next'
import { Roboto_Condensed, Roboto_Mono } from 'next/font/google'
import './globals.css'

/**
 * The sheet's two voices. Condensed grotesque for headings and labels, the way a
 * printed form sets its own field names; mono for every number, because a ledger
 * column only reads as a column when the digits align.
 *
 * Both are exposed as CSS variables so lib/png.ts can name the same families when
 * it rasterises a chart — an export that falls back to Inter would disagree with
 * the screen it was taken from.
 */
const sheetSans = Roboto_Condensed({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-sheet-sans',
})

const sheetMono = Roboto_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-sheet-mono',
})

export const metadata: Metadata = {
  title: 'Flowgauge',
  description: 'Analyse development team metrics from CSV data',
}

/** The design direction this build is auditable against. Emitted into the markup. */
const DIRECTION_CONTRACT = `<!--
THESIS: Flowgauge is the quality office's log sheet — a ruled form filled in at the
line and read for deviation. It refuses the card-tiled analytics dashboard and its
clean-SaaS opposite; nothing here floats on a neutral ground, because a sheet has
edges, a header and a footer rule.
OWN-WORLD: Ledger stock #f2efe4 under a printed 8mm rule, ink #191813, process red
#a8321f for signals and limits, ledger green #2f6b4f for central lines, stamp blue
#24527a. Rules are hairlines, corners are square, every number sets in mono on the
grid. Recognisable with all content removed.
STORY: A coach opens a file, reads the sheet aloud to the team, and leaves with a
PNG that still looks like the sheet it came from.
FIRST VIEWPORT: Full-bleed ruled stock. Sheet header banner across the top carrying
the Flowgauge mark, the file's identity and the item count as stamped fields.
Beneath it the ruled chart field runs to the right margin; the stamp margin holds
status. A footer rule closes the sheet.
FORM: Shop-floor control chart, candidate 2 of 7, chosen by the user over the roll's
assignment. Seed key f5f6d0c2.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish
review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
-->`

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${sheetSans.variable} ${sheetMono.variable}`}>
      <body>
        {/*
          The contract ships as a real HTML comment in the emitted markup. A JSX
          comment is compiled away and never reaches the served page, leaving
          nothing for a later reader to audit this build against.
        */}
        <div dangerouslySetInnerHTML={{ __html: DIRECTION_CONTRACT }} />
        {children}
      </body>
    </html>
  )
}