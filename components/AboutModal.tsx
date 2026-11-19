'use client'

import Modal from '@/components/Modal'
import FlowgaugeLogo from '@/components/FlowgaugeLogo'

export default function AboutModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="About Flowgauge" hideTitle onClose={onClose}>
      <div className="max-w-md mx-auto">
        <FlowgaugeLogo loop />
        <p className="mt-8 text-center text-gray-700 leading-relaxed">
          Flowgauge was developed by Andy Deighton of <a href="https://ljomi-systems.com" target="_blank" rel="noopener noreferrer">Ljomi Systems Ltd</a>. Why spend
          money on 3rd party software when you can use Flowgauge instead?<br/>
          Recently added:
        </p>
        <ul className="list-disc list-inside mt-2 text-gray-700">
           <li>Throughput Run Chart: items finished per day, week or fortnight against the median, with shift and trend signals, batch-close days marked, and the option to discount them</li>
           <li>Throughput Histogram: how often each day, week or fortnight finished a given number of items, with median and 85% lines</li>
           <li>Cycle Time Histogram: how many items took each number of days, with percentile lines</li>
           <li>Throughput by Item Type: completions per day, week or fortnight stacked by type, as counts or shares</li>
           <li>Monte Carlo forecasts can start from a chosen date, in both How Many and When modes</li>
         </ul>
         <p className="mt-4 text-center text-gray-700 leading-relaxed">
          More features coming soon!
         </p>
      </div>
    </Modal>
  )
}
