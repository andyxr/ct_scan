'use client'

import Modal from '@/components/Modal'
import FlowgaugeLogo from '@/components/FlowgaugeLogo'

export default function AboutModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="About Flowgauge" hideTitle onClose={onClose}>
      <div className="max-w-md mx-auto">
        <FlowgaugeLogo loop />
        <p className="mt-8 text-center text-gray-700 dark:text-gray-300 leading-relaxed">
          Flowgauge was developed by Andy Deighton of Ljomi Systems Ltd. Why spend
          money on 3rd party software when you can use Flowgauge instead? More
          features coming soon!
        </p>
      </div>
    </Modal>
  )
}
