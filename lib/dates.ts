/** Date helpers shared by the controls that let the operator pick an as-of day. */

/** YYYY-MM-DD from local date parts. toISOString would shift the day by the timezone offset. */
export function toInputValue(epoch: number): string {
  const date = new Date(epoch)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Local midnight for a YYYY-MM-DD input. new Date(str) would read it as UTC. */
export function fromInputValue(value: string): number | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime()
}

/** Today at local midnight. */
export function todayMs(): number {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
}
