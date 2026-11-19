'use client'

import type { BatchCloseScan } from '@/lib/batchCloses'

interface BatchCloseDiscountControlProps {
  scan: BatchCloseScan
  discount: boolean
  onChange: (discount: boolean) => void
  className?: string
}

/** The discount-batch-closes checkbox. Renders nothing when the file has no batch closes. */
export default function BatchCloseDiscountControl({ scan, discount, onChange, className = '' }: BatchCloseDiscountControlProps) {
  if (scan.closes.length === 0) return null
  return (
    <label className={`flex items-start gap-2 text-sm text-gray-700 ${className}`}>
      <input
        type="checkbox"
        checked={discount}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1"
      />
      <span>
        Discount batch closes: count the {scan.closes.length === 1 ? 'day' : `${scan.closes.length} days`} that
        {' '}{scan.closes.length === 1 ? 'looks' : 'look'} like work recorded late in bulk ({scan.closes.map(close => close.date).join(', ')}) as
        {' '}{scan.cap} {scan.cap === 1 ? 'item' : 'items'}, the most a normal day reaches
      </span>
    </label>
  )
}
