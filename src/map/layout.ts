// Layout of the map: four circles that don't touch (Global institutions in the middle; North, South and the
// Environment around it), the highways between them, the circles of actors inside, and where each box sits.
import {
  add, angle, data, dir, mul, norm, pairKey, sub, wrap,
  type Flow, type PlaneId, type PlaneModel, type Pt,
} from '../shared/core.ts'

export type Region = 'north' | 'south' | 'environment' | 'global'
type RegionDef = { id: Region; label: string; short: string; blurb: string; c: Pt; r: number; titleAt: number; titleInside?: boolean }

/** Global institutions sit in the middle; the three big circles stand around it with a gap for the highways. */
const HUB: Pt = { x: 630, y: 580 }
const HUB_R = 150
const GAP = 70
const around = (r: number, at: number) => add(HUB, mul(dir(at), HUB_R + GAP + r))
export const REGIONS: RegionDef[] = [
  { id: 'north', label: 'Global North', short: 'North', blurb: 'The core: capital, its governments, citizens and workers. Its growth rests on labor and nature drawn from the other two circles.', c: around(270, 215), r: 270, titleAt: 222 },
  { id: 'south', label: 'Global South', short: 'South', blurb: 'The periphery: Southern states, capital and workers, kept cheap by force, debt and trade, and fighting for sovereign development.', c: around(230, 325), r: 230, titleAt: 318 },
  { id: 'environment', label: 'Environment', short: 'Environment', blurb: 'What the economy takes from and dumps into: energy and extraction, the atmosphere and waste, and living nature.', c: around(250, 90), r: 250, titleAt: 90 },
  {
    id: 'global', label: 'Global institutions', short: 'Global',
    blurb: 'Who writes the world’s rules, and who they bind: the IMF, World Bank and dollar system on one side, and on the other the UN and international courts, which come mostly from outside voices.',
    c: HUB, r: HUB_R, titleAt: 270, titleInside: true,
  },
]
export const regionById = new Map(REGIONS.map((r) => [r.id, r]))

/** The actors inside each circle. A node listed first in a group of four or more sits at its heart. */
export const GROUPS: { id: string; region: Region; label: string; at: number; nodes: string[]; note?: string }[] = [
  { id: 'n-capital', region: 'north', label: 'Capital', at: 45, nodes: ['capital', 'investment', 'monopolies', 'unemployment', 'ai'] },
  { id: 'n-gov', region: 'north', label: 'Government', at: 315, nodes: ['state', 'military', 'public_finance', 'credit_guidance', 'national_projects'] },
  { id: 'n-citizens', region: 'north', label: 'Citizens', at: 225, nodes: ['citizens', 'media', 'liberal_parties', 'far_right', 'movement', 'neighborhood', 'social_movements'] },
  { id: 'n-work', region: 'north', label: 'Work', at: 135, nodes: ['workers_north', 'production', 'necessities', 'luxury', 'democratic_firms', 'job_guarantee', 'local_budget'] },
  { id: 's-gov', region: 'south', label: 'Government', at: 225, nodes: ['south_states', 'south_public_finance', 'south_south'] },
  { id: 's-capital', region: 'south', label: 'Capital', at: 135, nodes: ['south_capital'] },
  { id: 's-work', region: 'south', label: 'Work', at: 45, nodes: ['south_workers'] },
  { id: 's-citizens', region: 'south', label: 'Citizens', at: 315, nodes: ['south_citizens'] },
  { id: 'e-extract', region: 'environment', label: 'Extraction', at: 210, nodes: ['fossil', 'renewables'] },
  { id: 'e-dump', region: 'environment', label: 'Dump', at: 90, nodes: ['ecosystem#sink', 'waste'] },
  { id: 'e-nature', region: 'environment', label: 'Natural ecosystems', at: 330, nodes: ['ecosystem#nature', 'south_nature'] },
  { id: 'g-finance', region: 'global', label: 'Finance', at: 180, nodes: ['imf', 'dollar'] },
  { id: 'g-law', region: 'global', label: 'UN & courts', at: 0, nodes: ['un_security_council', 'un_general_assembly', 'icj', 'icc'] },
]

/** "Ecosystems & atmosphere" is one box in the data; here it shows twice: the sink pollution goes into, and living nature. */
export const ECO_LABEL: Record<string, string> = { 'ecosystem#sink': 'Atmosphere', 'ecosystem#nature': 'Ecosystems' }
export const glyphNode = (g: string) => g.split('#')[0]
// waste harms living nature; other pollution (emissions, energy-hungry production) goes to the atmosphere
export const ecoEnd = (f: Flow) => (f.kind === 'pollution' && f.from !== 'waste' ? 'ecosystem#sink' : 'ecosystem#nature')
export const endGlyph = (f: Flow, end: 'from' | 'to') => (f[end] === 'ecosystem' ? ecoEnd(f) : f[end])

// --- geometry ------------------------------------------------------------------------------------------
export const regionOf = new Map<string, PlaneId>()
export const groupOf = new Map<string, string>()
export type G = { id: string; c: Pt; r: number; region: Region }
export const GEO = new Map<string, G>()
for (const g of GROUPS) {
  const R = regionById.get(g.region)!
  const k = GROUPS.filter((x) => x.region === g.region).length
  const s = Math.sin(Math.PI / k)
  const full = (R.r * s) / (1 + s)
  GEO.set(g.id, { id: g.id, region: g.region, c: add(R.c, mul(dir(g.at), R.r - full)), r: full * 0.95 })
  for (const n of g.nodes) {
    regionOf.set(glyphNode(n), g.region)
    groupOf.set(n, g.id)
  }
}
for (const n of data.nodes) if (!regionOf.has(n.id)) console.warn('box not placed:', n.id)

export const model: PlaneModel = {
  planes: REGIONS.map((r) => ({ id: r.id as PlaneId, label: r.label, short: r.short, blurb: r.blurb })),
  planeOf: (id) => regionOf.get(id)!,
  gates: [
    { key: 'north|south', a: 'north', b: 'south' },
    { key: 'north|environment', a: 'north', b: 'environment' },
    { key: 'south|environment', a: 'south', b: 'environment' },
    { key: 'north|global', a: 'north', b: 'global' },
    { key: 'south|global', a: 'south', b: 'global' },
    { key: 'environment|global', a: 'environment', b: 'global' },
  ],
  leverHome: {
    politics: { node: 'state' },
    empire: { gate: 'north|south' },
    invest: { node: 'capital' },
    energy: { gate: 'north|environment' },
    provision: { node: 'necessities' },
    work: { node: 'workers_north' },
    workplace: { node: 'production' },
  },
  gateWord: 'highway',
}
/** A highway between two circles: from rim pa on a to rim pb on b; p is its middle, n points a → b, t across. */
export type Gate = { key: string; a: Region; b: Region; p: Pt; n: Pt; t: Pt; pa: Pt; pb: Pt }
export const GATES = new Map<string, Gate>()
for (const g of model.gates) {
  const A = regionById.get(g.a as Region)!
  const B = regionById.get(g.b as Region)!
  const n = norm(sub(B.c, A.c))
  const pa = add(A.c, mul(n, A.r))
  const pb = sub(B.c, mul(n, B.r))
  GATES.set(g.key, { key: g.key, a: g.a as Region, b: g.b as Region, p: mul(add(pa, pb), 0.5), n, t: { x: -n.y, y: n.x }, pa, pb })
}

/** Where a box's arrows pull it: the center of the ring of actors it sits in, or of the Global circle. */
const anchorOf = (id: string) => {
  const pg = GROUPS.find((x) => x.nodes.includes(id) || x.nodes.includes(`${id}#nature`))
  return pg ? GEO.get(pg.id)!.c : regionById.get('global')!.c
}
/** Spread boxes on a ring around c, each turned toward the average direction of its partners outside the ring. */
function placeRing(ring: string[], c: Pt, rr: number) {
  const want = ring.map((n) => {
    const id = glyphNode(n)
    const partners = data.flows.flatMap((f) => (f.from === id ? [f.to] : f.to === id ? [f.from] : [])).filter((p) => !ring.includes(p))
    const v = partners.map(anchorOf).reduce((acc, p) => add(acc, norm(sub(p, c))), { x: 0, y: 0 })
    return { n, a: partners.length ? angle(v) : 0 }
  })
  want.sort((x, y) => x.a - y.a)
  const step = 360 / ring.length
  let best = 0
  let bestCost = Infinity
  for (let off = 0; off < 360; off += 5) {
    const cost = want.reduce((acc, w, i) => acc + Math.abs(wrap(off + i * step - w.a)), 0)
    if (cost < bestCost) {
      bestCost = cost
      best = off
    }
  }
  want.forEach((w, i) => POS.set(w.n, add(c, mul(dir(best + i * step), rr))))
}
/** Place each group's boxes: the heart at the center, the rest on a ring, each turned toward where its arrows go. */
export const POS = new Map<string, Pt>()
for (const g of GROUPS) {
  const geo = GEO.get(g.id)!
  const heart = g.nodes.length >= 4 ? g.nodes[0] : null
  const ring = heart ? g.nodes.slice(1) : g.nodes
  if (heart) POS.set(heart, geo.c)
  if (ring.length === 1 && !heart) POS.set(ring[0], geo.c)
  else placeRing(ring, geo.c, geo.r * (heart ? 0.6 : 0.5))
}
export const pos = (g: string) => POS.get(g)!

export function crossKey(f: Flow) {
  const a = regionOf.get(f.from)!
  const b = regionOf.get(f.to)!
  return a === b ? null : pairKey(model, a, b)
}
/** The highway an arrow takes, if any, with its direction of travel. */
export type Hop = { g: Gate; n: Pt }
export const ROUTE = new Map<string, Hop[]>()
for (const f of data.flows) {
  const a = regionOf.get(f.from) as Region
  const k = crossKey(f)
  const g = k ? GATES.get(k)! : null
  ROUTE.set(f.id, g ? [{ g, n: g.a === a ? g.n : mul(g.n, -1) }] : [])
}
