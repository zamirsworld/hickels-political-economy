// Stage 9a: the lever engine. Pure functions shared by the app and scripts/check-layout.ts.
import type { BuiltData, LeverId, StateId } from './types.ts'

/** true = the lever is "on" (right: Democratic socialism's position). */
export type LeverConfig = Record<LeverId, boolean>

export const LEVER_ORDER: LeverId[] = ['invest', 'provision', 'work', 'workplace', 'politics', 'empire', 'energy']

export const PRESETS: { id: string; label: string; note: string; cfg: LeverConfig }[] = [
  { id: 'today', label: 'Today', note: 'Every lever in today’s position.', cfg: all(false) },
  { id: 'alt', label: 'Democratic socialism', note: 'Every lever switched.', cfg: all(true) },
  {
    id: 'socdem',
    label: 'Social democracy, funded by empire',
    note: 'Public services and jobs at home, the imperial arrangement left in place: Hickel’s account of post-war Europe.',
    cfg: { ...all(false), provision: true, work: true },
  },
  {
    id: 'southrise',
    label: 'Southern rise, no movement',
    note: 'The South wins sovereignty, but politics in the core is still captured: Hickel’s warning about the squeeze and the far right.',
    cfg: { ...all(false), empire: true },
  },
]

function all(on: boolean): LeverConfig {
  return Object.fromEntries(LEVER_ORDER.map((id) => [id, on])) as LeverConfig
}

/** Which state a configuration matches exactly, or null for a mixed world. */
export function presetState(cfg: LeverConfig): StateId | null {
  const on = LEVER_ORDER.filter((id) => cfg[id]).length
  return on === 0 ? 'today' : on === LEVER_ORDER.length ? 'alt' : null
}
export const presetOf = (cfg: LeverConfig) => PRESETS.find((p) => LEVER_ORDER.every((id) => p.cfg[id] === cfg[id])) ?? null
export const configFor = (state: StateId): LeverConfig => all(state === 'alt')

type FlowLike = { id: string; from: string; to: string; states: StateId[]; when?: Partial<Record<LeverId, 'left' | 'right'>> }
export function flowActive(f: FlowLike, cfg: LeverConfig) {
  if (!f.when) return true
  return Object.entries(f.when).every(([lever, side]) => cfg[lever as LeverId] === (side === 'right'))
}

/** Active flows, visible nodes (shared nodes always; others when an active flow touches them), running loops. */
export function activeView(data: Pick<BuiltData, 'nodes' | 'flows' | 'loops'>, cfg: LeverConfig) {
  const flows = new Set(data.flows.filter((f) => flowActive(f, cfg)).map((f) => f.id))
  const nodes = new Set(data.nodes.filter((n) => n.states.length === 2).map((n) => n.id))
  for (const f of data.flows) if (flows.has(f.id)) nodes.add(f.from).add(f.to)
  const loops = new Set(data.loops.filter((l) => l.path.every((id) => flows.has(id))).map((l) => l.id))
  return { flows, nodes, loops }
}

/** URL form: "alt", nothing (Today), or "lv=0110001" in LEVER_ORDER. */
export const encodeConfig = (cfg: LeverConfig) => {
  const s = presetState(cfg)
  return s === 'today' ? '' : s === 'alt' ? 'alt' : `lv=${LEVER_ORDER.map((id) => (cfg[id] ? 1 : 0)).join('')}`
}
export function decodeConfig(params: URLSearchParams): LeverConfig {
  const lv = params.get('lv')
  if (lv && /^[01]{7}$/.test(lv)) return Object.fromEntries(LEVER_ORDER.map((id, i) => [id, lv[i] === '1'])) as LeverConfig
  return configFor(params.has('alt') || params.get('state') === 'alt' ? 'alt' : 'today')
}

/** Every one of the 2^7 configurations, for exhaustive checks. */
export const allConfigs = (): LeverConfig[] =>
  Array.from({ length: 1 << LEVER_ORDER.length }, (_, n) =>
    Object.fromEntries(LEVER_ORDER.map((id, i) => [id, !!(n & (1 << i))])) as LeverConfig,
  )
