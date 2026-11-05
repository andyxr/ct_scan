import { useSyncExternalStore } from 'react'

const subscribe = () => () => {}

/** False during server render and hydration, true in the browser. Recharts measures the DOM, so charts wait for it. */
export function useIsClient(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false)
}
