// Stage 9b: the ripple. A qualitative model of Hickel's argument — not an economic simulation.
// Each condition box has a value in [-1, 1] (vicious → virtuous). Switches push their direct targets
// (weight 2, + when on, − when off); boxes push each other along signed, sourced influences (weight 1).
// Values settle by repeated squashed summation; the ripple order is the shortest path from a switch.
import type { LeverConfig } from './levers.ts'
import type { LeverId } from './types.ts'

export type Influence = {
  from: string // a node id, or "lever:<id>"
  to: string
  sign: 1 | -1
  weight: number
  label: string
  when?: Partial<Record<LeverId, 'left' | 'right'>>
}

// Tuned so a single switch visibly moves its targets and the effect fades with distance
// across the map: steeper gains saturate every box at ±1.
const GAIN = 0.3
const ITERATIONS = 60

const leverOf = (from: string) => (from.startsWith('lever:') ? (from.slice(6) as LeverId) : null)
export const influenceActive = (inf: Influence, cfg: LeverConfig) =>
  !inf.when || Object.entries(inf.when).every(([id, side]) => cfg[id as LeverId] === (side === 'right'))

/** Settled condition values for a lever configuration. */
export function conditionValues(nodeIds: string[], influences: Influence[], cfg: LeverConfig) {
  const active = influences.filter((i) => influenceActive(i, cfg))
  let v = new Map(nodeIds.map((id) => [id, 0]))
  for (let k = 0; k < ITERATIONS; k++) {
    const next = new Map<string, number>()
    for (const id of nodeIds) {
      let sum = 0
      for (const inf of active) {
        if (inf.to !== id) continue
        const lever = leverOf(inf.from)
        const input = lever ? (cfg[lever] ? 1 : -1) : (v.get(inf.from) ?? 0)
        sum += inf.sign * inf.weight * input
      }
      // damped update so mutual influences (e.g. capital ↔ state) settle instead of oscillating
      next.set(id, 0.5 * (v.get(id) ?? 0) + 0.5 * Math.tanh(GAIN * sum))
    }
    v = next
  }
  return v
}

/** Steps outward from a switch: 1 = its direct targets, 2 = what they influence, … (active influences only). */
export function rippleSteps(lever: LeverId, influences: Influence[], cfg: LeverConfig) {
  const active = influences.filter((i) => influenceActive(i, cfg))
  const step = new Map<string, number>()
  let frontier = active.filter((i) => i.from === `lever:${lever}`).map((i) => i.to)
  frontier.forEach((id) => step.set(id, 1))
  for (let k = 2; frontier.length; k++) {
    const next: string[] = []
    for (const id of frontier)
      for (const inf of active)
        if (inf.from === id && !step.has(inf.to)) {
          step.set(inf.to, k)
          next.push(inf.to)
        }
    frontier = next
  }
  return step
}

/** Seven display levels: −3 … +3 (|v| < 0.2 is neutral). */
export const level = (v: number) => {
  const a = Math.abs(v)
  const n = a < 0.2 ? 0 : a < 0.5 ? 1 : a < 0.8 ? 2 : 3
  return Math.sign(v) * n
}
