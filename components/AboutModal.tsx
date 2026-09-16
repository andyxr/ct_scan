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
          Recently addded:
        </p>
        <ul className="list-disc list-inside mt-2 text-gray-700 leading-relaxed">
           <li>Aging work in progress chart</li>
           <li>Scatterplot item colouring</li>
           <li>Zooming in on a date range in the scatterplot</li>
           <li>Zooming in on a sequence range in the PBC</li>
         </ul>
         <p className="mt-4 text-center text-gray-700 leading-relaxed">
          More features coming soon!
         </p>
      </div>
    </Modal>
  )
}
