'use client'

import Modal from '@/components/Modal'
import type { BatchCloseScan } from '@/lib/batchCloses'

interface BatchCloseModalProps {
  scan: BatchCloseScan
  onDiscount: () => void
  /** Also what closing the dialog any other way means. */
  onKeep: () => void
}

/**
 * Asked once per file: the flagged days are a judgement call only the team can
 * make, so the forecast never discounts them without being told to.
 */
export default function BatchCloseModal({ scan, onDiscount, onKeep }: BatchCloseModalProps) {
  const { closes, limit, cap } = scan
  const many = closes.length > 1

  return (
    <Modal title={many ? `${closes.length} days look like batch closes` : 'One day looks like a batch close'} onClose={onKeep}>
      <div className="space-y-5 text-gray-700 leading-relaxed">
        <p>
          On {many ? 'these days' : 'this day'} far more items were closed than this team normally finishes in a day.
          That usually means work was finished earlier and recorded late, all at once, rather than a real burst of delivery.
          A normal day here tops out at about {limit.toFixed(1)} items.
        </p>

        <table className="w-full text-left text-base">
          <thead>
            <tr className="border-b border-gray-300 text-sm text-gray-600">
              <th className="py-1 pr-4 font-semibold">Date</th>
              <th className="py-1 pr-4 font-semibold text-right">Closed</th>
              <th className="py-1 font-semibold">Items</th>
            </tr>
          </thead>
          <tbody>
            {closes.map(close => (
              <tr key={close.timestamp} className="border-b border-gray-200 align-top">
                <td className="py-2 pr-4 whitespace-nowrap">{close.date}</td>
                <td className="py-2 pr-4 text-right">{close.count}</td>
                <td className="py-2 font-mono text-sm break-words">{close.itemIds.join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p>
          The Monte Carlo forecast samples past days at random. Left as recorded, it treats {many ? 'these days' : 'this day'} as
          something the team could repeat, which inflates the forecast. Discounting counts {many ? 'each of these days' : 'this day'} as
          {' '}{cap} {cap === 1 ? 'item' : 'items'}, the normal limit, in forecasts only. Every other chart keeps the data exactly as recorded,
          and you can change this later in the Monte Carlo panel.
        </p>

        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onKeep}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Keep as recorded
          </button>
          <button
            type="button"
            onClick={onDiscount}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Discount for forecasts
          </button>
        </div>
      </div>
    </Modal>
  )
}
