'use client'

import Modal from '@/components/Modal'

export interface SprintExplainerFacts {
  sprintDays: number
  centralLine: number
  p85: number
  upperProcessLimit: number
  withinCount: number
  totalCount: number
  outsideLimitsCount: number
  runSignalCount: number
}

const days = (n: number) => `${n.toFixed(1)} days`

/**
 * Reads the sprint line against the process limits and says what the
 * comparison means, filling in the numbers from the chart on screen.
 */
export default function SprintExplainerModal({ facts, onClose }: { facts: SprintExplainerFacts; onClose: () => void }) {
  const { sprintDays, centralLine, p85, upperProcessLimit, withinCount, totalCount, outsideLimitsCount, runSignalCount } = facts
  const sprintBelowMean = sprintDays < centralLine
  const minorityWithin = totalCount > 0 && withinCount / totalCount < 0.5
  const stable = runSignalCount === 0 && outsideLimitsCount <= Math.max(2, Math.round(totalCount * 0.05))

  return (
    <Modal title="What the sprint line tells you" onClose={onClose}>
      <div className="space-y-5 text-gray-700 leading-relaxed">
        <Section heading="The sprint against the process">
          The amber line marks a {sprintDays}-day sprint. The Central Line for this process is {days(centralLine)},
          the 85th percentile is {days(p85)}, and the upper process limit is {days(upperProcessLimit)}.
          {' '}{withinCount} of {totalCount} items finished within a sprint.
          {sprintBelowMean
            ? ' The sprint boundary sits below the mean of the process it is meant to contain.'
            : ' The sprint boundary sits above the mean, but the limits, not the sprint, describe how long work really takes.'}
          {' '}The process limits describe what the system does. The sprint length is unrelated to any of them.
        </Section>

        <Section heading="Predictability comes from the process, not the timebox">
          {stable
            ? `With ${runSignalCount === 0 ? 'no run signals' : `${runSignalCount} run signals`} and ${outsideLimitsCount} ${outsideLimitsCount === 1 ? 'point' : 'points'} outside the limits, the chart says this system is predictable. `
            : `With ${runSignalCount} run ${runSignalCount === 1 ? 'signal' : 'signals'} and ${outsideLimitsCount} ${outsideLimitsCount === 1 ? 'point' : 'points'} outside the limits, the chart shows where predictability is being lost. `}
          Predictability comes from managing flow, not from the timebox. The limits would be exactly the same if
          every sprint boundary were erased. If it feels like sprints are what make the team predictable, ask which
          feature of this chart the sprint produced.
        </Section>

        <Section heading="Look for the sprint's fingerprints">
          If the timebox were shaping the work, it would show. Cycle times would cluster just under {sprintDays} days,
          or completions would bunch on sprint end dates. Check the Cycle Time scatterplot for a wall at the sprint
          line, and the Monte Carlo daily throughput for a spike at each sprint end. If those patterns are there, the
          sprint is adding variability by batching starts and rushing finishes. If they are absent, the sprint is not
          doing anything to the work at all. Either way, the process limits describe the work and the sprint does not.
        </Section>

        <Section heading="What the timebox is for">
          Sprints are usually defended as a container for commitment.
          {minorityWithin
            ? ` This process cannot honour a ${sprintDays}-day commitment for most items, so the sprint is not a container.`
            : ` Most items here do fit inside ${sprintDays} days, but the ones that do not are the ones a commitment is measured on.`}
          {' '}What the sprint reliably provides is a review cadence. Keeping it for demos and retrospectives is
          fine. Using it as a unit of work is not what the data supports.
        </Section>

        <Section heading="Replace the timebox promise with the process promise">
          Instead of &ldquo;we will finish these ten items this sprint&rdquo;, offer &ldquo;85% of items finish
          within {Math.ceil(p85)} days&rdquo;, and use the Monte Carlo forecast for any date that matters. A
          {' '}{sprintDays}-day horizon is just one row of that table, which is the point: {sprintDays} days was
          never special.
        </Section>
      </div>
    </Modal>
  )
}

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="font-semibold text-gray-900 mb-1">{heading}</h3>
      <p>{children}</p>
    </section>
  )
}
