// The shared model for the guided cycles: types for a cycle's script, helpers that pull sourced content from
// the built data by id (so timestamps stay verified by `npm run data`), and the question logic every cycle uses.
// Each cycle's own words live in scripts/<slug>.ts.
import raw from '../data/system.json'
import type { BuiltData, LeverId, ResolvedSource } from '../model/types.ts'

export const data = raw as unknown as BuiltData
export type Flow = BuiltData['flows'][number]
export type Event = BuiltData['events'][number]
export type Figure = BuiltData['figures'][number]
export type Loop = BuiltData['loops'][number]
export type Lever = BuiltData['levers'][number]
export type { ResolvedSource }

export const flowById = new Map(data.flows.map((f) => [f.id, f]))
export const nodeById = new Map(data.nodes.map((n) => [n.id, n]))
export const figById = new Map(data.figures.map((f) => [f.id, f]))
export const eventById = new Map(data.events.map((e) => [e.id, e]))
export const loopById = new Map(data.loops.map((l) => [l.id, l]))
export const leverById = new Map<string, Lever>(data.levers.map((l) => [l.id, l]))
/**
 * Plain names for the cycle pages, for readers new to the subject. Only the wording changes, never the meaning;
 * the map keeps the data's own names.
 */
const PLAIN_NODES: Record<string, string> = {
  production: 'Production',
  investment: 'Investment decisions',
  monopolies: 'Monopoly companies',
  south_states: 'Southern governments',
  public_finance: 'Public money',
  necessities: 'Basic needs',
  south_public_finance: 'Southern public money',
}
const PLAIN_FLOWS: Record<string, string> = {
  capture: 'takes hold of the government',
  profit_filter: 'invests where profit is highest',
  drain_labor: 'work drained north',
  surplus: 'keeps the profit',
  structural_adjustment: 'loans with strings attached',
  volcker_debt: 'interest-rate shock & debt',
  owns_monopolies: 'owns patents & technology',
  monopoly_prices: 'sold at high prices',
  kept_cheap: 'kept cheap: send out more, get back less',
  state_serves: 'clears the way for profit',
  media_ownership: 'owns the media',
  labor_north: 'work',
  issuance: 'issues its own money',
  pf_necessities: 'pays for the basics for all',
  concessions: "better wages at home (paid for by empire)",
  defends_fossil: "defends the fossil fuel system",
  jobs_labor: "anyone can join (job guarantee)",
  workplace_vote: "a say at work",
  pf_jobs: "pays for jobs",
  pf_renewables: "builds renewables",
  won_by_struggle: "gains won by struggle",
  frontier: "takes nature with no rules",
}
/** Plain explanations for arrows that can appear as wrong answers; the meaning follows the data's description. */
const PLAIN_DESCS: Record<string, string> = {
  volcker_debt: "In 1980 the US central bank pushed interest rates above 20%, which broke the power of US unions and set off a debt crisis across poorer countries.",
  profit_filter: "Capital invests in whatever pays the most, whatever it costs society.",
  concessions: "Under pressure from socialist revolutions abroad, capital gave workers in rich countries better wages and welfare, and paid for them with cheap labor and resources from poorer countries.",
  sanctions: "Governments that try to develop on their own terms are hit with sanctions, often straight away. Hickel’s examples include almost every socialist government of the 20th century, China after its revolution, and Cuba today.",
  defends_fossil: "Because its economic privileges rest on oil being sold in dollars, the US government works to keep the fossil fuel system going as long as possible.",
  state_serves: "A government in the hands of capital uses its spending and laws to open up new ways for companies to profit.",
  arms_profits: "Military spending moves public money into the pockets of those who own the weapons industry.",
  ss_trade: "Poorer countries trading with each other through currency swap deals, without the dollar or the euro, and cooperating on defense.",
  assembly_majority: "Poorer countries joined together in the G77 to act together at the UN, where they hold the majority. In 1974 they declared their right to run their own economies.",
  sanctions_people: "The pressure on a government lands on its people. Loan conditions forced poorer countries to cut public services, sell off public industries and resources, and stop supporting their own industries, and extreme poverty rose sharply in the 1990s. Under sanctions a country can’t organize production for its people’s needs: Hickel blames the shortages socialist countries suffered on blockades and sanctions. Meanwhile, workers who could staff hospitals and schools are kept making export goods for Northern companies.",
  wage_demands: "Workers in poorer countries ask for the same things as workers in rich ones: better wages and health care.",
  south_development: "Workers and resources in poorer countries build hospitals, schools and clean water for their own people, instead of gadgets and fast fashion for rich countries.",
  yields: "In workplaces run democratically, workers decide how what they make is shared, instead of the profit going to the owners.",
  frontier: "Having damaged nature at home, capital looks for new places where nature can be taken with no rules, pushing out the people who depend on it.",
  oil_dollars: "Oil and gas are bought and sold in dollars around the world, so everyone needs dollars.",
  anger: "People’s anger at the elite is justified. But with no socialist movement to join, it gets pulled into the far right’s attacks on “the establishment”.",
  jobs_labor: "A living wage, around 35 hours a week, with a say at work, which sets the bar private employers have to meet.",
  workplace_vote: "Workers vote on what their workplace makes and how the earnings are shared.",
  intervention: "Countries that try to develop on their own terms are bombed, or their governments overthrown, to make them “cheap” again.",
  media_smear: "When a left-wing figure breaks through, the media smear campaign ramps up. A movement built around one person can’t withstand it, as happened with Jeremy Corbyn.",
  military_budget: "Public money goes into weapons, which passes it to the billionaires who own the arms industry.",
  won_by_struggle: "Public services, the weekend and workers’ right to vote had to be fought for against the interests of the owners. Progress in rich countries began with workers’ and socialist movements in the late 1800s.",
  pf_jobs: "Public money hires people directly for useful work society needs.",
  bargaining: "With housing, healthcare and the basics guaranteed, workers can refuse exploitation, and the economy no longer needs endless growth to stay stable.",
}
export const label = (id: string) => PLAIN_NODES[id] ?? nodeById.get(id)?.label ?? id
/** The seven switches in plain words, for the cycle pages. */
const PLAIN_LEVERS: Record<string, { label: string; left: string; right: string }> = {
  invest: { label: 'Who decides what gets invested in', left: 'Owners, by profit', right: 'The public, through public money' },
  provision: { label: 'How basic needs are met', left: 'Bought on the market', right: 'Public services for all' },
  work: { label: 'Jobs', left: 'Fear of unemployment', right: 'A guaranteed job for anyone' },
  workplace: { label: 'Who runs workplaces', left: 'The owners', right: 'The workers' },
  politics: { label: 'Who holds political power', left: 'Big money', right: 'A democratic mass movement' },
  empire: { label: 'Rich and poorer countries', left: 'Poorer countries kept cheap', right: 'Poorer countries in charge of their own future' },
  energy: { label: 'How much rich countries use', left: 'Endless growth', right: 'Scaled down' },
}
export const leverText = (l: Lever) => PLAIN_LEVERS[l.id] ?? { label: l.label, left: l.left, right: l.right }
/** An arrow's name on the cycle pages. */
export const flowLabel = (f: { id: string; label: string }) => PLAIN_FLOWS[f.id] ?? f.label
/** An arrow's explanation on the cycle pages. */
export const flowDesc = (f: { id: string; description: string }) => PLAIN_DESCS[f.id] ?? f.description
const must = <T>(x: T | undefined, what: string): T => {
  if (x === undefined) throw new Error(`${what} not found`)
  return x
}
export const flow = (id: string) => must(flowById.get(id), `flow ${id}`)
export const event = (id: string) => must(eventById.get(id), `event ${id}`)
export const fig = (id: string) => must(figById.get(id), `figure ${id}`)
export const loop = (id: string) => must(loopById.get(id), `loop ${id}`)
export const lever = (id: string) => must(leverById.get(id), `lever ${id}`)

/** Sources of an item, picked by "EP m:ss" in the order given. */
export function pick(sources: ResolvedSource[], wanted: string[]): ResolvedSource[] {
  return wanted.map((w) => {
    const [ep, t] = w.split(' ')
    return must(
      sources.find((x) => x.ep === ep && x.t === t),
      `source ${w}`,
    )
  })
}
/** Sources by item: src.flow('capture', 'BF1 31:20', …). */
export const src = {
  flow: (id: string, ...w: string[]) => pick(flow(id).sources, w),
  node: (id: string, ...w: string[]) => pick(must(nodeById.get(id), `node ${id}`).sources ?? [], w),
  loop: (id: string, ...w: string[]) => pick(loop(id).sources, w),
  lever: (id: string, ...w: string[]) => pick(lever(id).sources, w),
  event: (id: string, ...w: string[]) => pick(event(id).sources, w),
  contrast: (id: string, ...w: string[]) => pick(must(data.contrasts.find((c) => c.id === id), `contrast ${id}`).sources, w),
}

/** A headline number from a figure in the register: value index, and how to say it. */
export type Stat = { value: string; unit: string; caption: string; fig: Figure }
export const stat = (figId: string, i: number, caption: string): Stat => {
  const f = fig(figId)
  return { value: f.values[i].value, unit: f.values[i].unit, caption, fig: f }
}

export type Note = { title: string; text: string; sources: ResolvedSource[] }

export type Step = {
  flow: Flow
  kicker: string
  title: string
  /** What happens on this arrow. */
  body: string
  /** Why it matters for the loop. */
  why: string
  /** The question asked in the predict-then-reveal version. */
  prompt: string
  sources: ResolvedSource[]
  stats?: Stat[]
  examples?: Event[]
  /** A side note, often a shorter cycle folded into this one. */
  aside?: Note
}

/** Where an extra question sits: before the intro, after answering (or after the reveal of) step i, or once the loop closes. */
export type Placement = 'start' | 'closed' | { ask: number } | { reveal: number }
/** Guess a number on a slider; the real figure (a value or a range) is drawn beside the guess. */
export type Estimate = {
  k: 'estimate'
  id: string
  at: Placement
  /** For the scorecard. */
  label: string
  kicker?: string
  prompt: string
  min: number
  max: number
  step?: number
  start?: number
  unit: string
  /** The answer, or the low and high ends of a range. */
  answer: number | [number, number]
  /** How far off a guess may be and still count, outside the range. */
  tolerance: number
  /** Bar names: the real figure, and any extra bars for comparison. */
  answerName: string
  /** How to write the answer, when the number alone misleads (e.g. “above 20%”). */
  answerLabel?: string
  also?: { name: string; value: number; text?: string }[]
  reveal: string
  fig?: Figure
  sources?: ResolvedSource[]
}
/** Pick one of a few options. Wrong options are invented scales or plausible alternatives, never claims. */
export type Choice = {
  k: 'choice'
  id: string
  at: Placement
  label: string
  kicker: string
  prompt: string
  hint?: string
  options: string[]
  /** A small line under every option, e.g. a unit. */
  small?: string
  answer: number
  caption: string
  fig?: Figure
  sources?: ResolvedSource[]
}
/** Put dated events from the timeline in order. */
export type Order = { k: 'order'; id: string; at: Placement; label: string; kicker: string; prompt: string; hint: string; events: Event[] }
export type Extra = Estimate | Choice | Order

export type End = {
  kicker: string
  title: string
  body: string
  sources: ResolvedSource[]
  /** The switches the toggle flips. For a vicious cycle they break it; for a virtuous one, flipping back shows today. */
  levers: LeverId[]
  toggle: { label: string; hint: string }
  /** The centre of the ring while the toggle is on. */
  stopped: string
  /** Arrows that appear while the toggle is on (alternative arrows for a vicious cycle, today's for a virtuous one). */
  opens: Flow[]
  /** Boxes off the ring that an opened arrow reaches, placed inside the ring (degrees, distance from the centre). */
  satellites?: { id: string; angle: number; r: number }[]
  /** Ring boxes lit up while the toggle is on. */
  lit?: string[]
  /** Where the centre text moves while the toggle is on, to make room for the opened arrows. */
  centerShift?: [number, number]
  notes?: Note[]
}

export type CycleScript = {
  slug: string
  loop: Loop
  /** Page title, e.g. “The Imperial drain”. */
  title: string
  /** Short name for the centre of the ring. */
  short: string
  group: string
  /** One line for the gallery card. */
  blurb: string
  /** Shorter loops told inside this one (as asides or notes), named on the gallery card. */
  folds?: string[]
  /** Where each box sits on the ring, in degrees (0 = right, y down, increasing clockwise). */
  angles: number[]
  intro: { kicker: string; title: string; body: string; sources: ResolvedSource[]; stats?: Stat[]; lead: string }
  steps: Step[]
  end: End
  extras: Extra[]
  /** Said after the reader checks their switch picks. */
  switchesText: string
  /** The whole cycle in a few plain sentences, for the “back to the start” screen. */
  summary: string
}

export const virtuous = (c: CycleScript) => c.loop.tone === 'virtuous'

/** The ring: every box in the loop, in order, with its region. */
export const ringOf = (c: CycleScript) =>
  c.loop.path.map((id) => {
    const from = flow(id).from
    return { id: from, label: label(from), region: nodeById.get(from)!.region as string }
  })

const hash = (id: string) => [...id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 997, 7)

/**
 * For the guessing version: the right arrow and up to n − 1 other real arrows leaving the same box, in a stable
 * mixed order. Today's arrows come first; where a box has few, arrows that exist only in the alternative fill in.
 */
export function choicesFor(step: Step, n = 4): Flow[] {
  const from = step.flow.from
  const out = data.flows
    .filter((f) => f.from === from && f.id !== step.flow.id && !f.external && !f.blocked && f.to !== step.flow.to)
    .sort((a, b) => Number(!a.states.includes('today')) - Number(!b.states.includes('today')) || hash(a.id) - hash(b.id))
  const picked = [step.flow, ...out.slice(0, n - 1)]
  // a stable shuffle, so the same question looks the same on every visit
  return picked.sort((a, b) => hash(b.id + from) - hash(a.id + from))
}
/** For an arrow that exists only in the alternative: the switches that open it. */
export const opensWith = (f: Flow) => (f.states.includes('today') ? [] : Object.keys(f.when ?? {}).map((id) => lever(id)))
/** The named cycles an arrow belongs to, for explaining a wrong guess. */
export const loopsOf = (flowId: string) => data.loops.filter((l) => l.path.includes(flowId)).map((l) => l.label)

/** For a box with few arrows out: ask which box comes next instead. Each wrong box is explained from the map. */
export function boxChoicesFor(c: CycleScript, step: Step): { id: string; label: string; region: string; via: Flow | null }[] {
  const from = step.flow.from
  const targets = [...new Set(data.flows.filter((f) => f.from === from && !f.external).map((f) => f.to))]
  const fill = ringOf(c)
    .map((n) => n.id)
    .filter((id) => id !== from && !targets.includes(id))
  // keep the right box even when the box has many targets
  const others = [...targets, ...fill].filter((id) => id !== step.flow.to)
  const ids = [step.flow.to, ...others.slice(0, 3)]
  return ids
    .sort((a, b) => hash(b + from) - hash(a + from))
    .map((id) => ({
      id,
      label: label(id),
      region: nodeById.get(id)!.region as string,
      via: id === step.flow.to ? step.flow : (data.flows.find((f) => f.from === from && f.to === id && !f.external) ?? null),
    }))
}
/** Steps whose box has too few arrows out for a good arrow question get a box question instead. */
export const askByBox = (step: Step) => choicesFor(step).length < 3

/**
 * The switch challenge. Vicious: which switches close at least one of the loop's arrows (break it).
 * Virtuous: which switches the loop's arrows need (switch it on).
 */
export const leverEffects = (c: CycleScript) => {
  const side = virtuous(c) ? 'right' : 'left'
  return data.levers.map((lv) => ({ lever: lv, flows: c.steps.filter((s) => s.flow.when?.[lv.id] === side).map((s) => s.flow) }))
}
/** The loop's arrows the toggle closes. */
export const closedByToggle = (c: CycleScript) => {
  const side = virtuous(c) ? 'right' : 'left'
  return c.steps.filter((s) => c.end.levers.some((l) => s.flow.when?.[l] === side)).map((s) => s.flow.id)
}

export const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!)
export const sourceChips = (ss: ResolvedSource[]) =>
  `<div class="chips">${ss
    .map((s) =>
      s.url
        ? `<a class="chip${s.speaker ? ' outside' : ''}" href="${esc(s.url)}" target="_blank" rel="noopener" title="${esc(s.note)}">▶ ${esc(s.t)} <b>${esc(s.ep)}</b></a>`
        : '',
    )
    .join('')}</div>`
/** A figure's citation; figures not by Hickel carry a badge. */
export const figCite = (f: Figure) =>
  `<a class="fig-cite" href="${esc(f.url)}" target="_blank" rel="noopener" title="${esc(f.caveat)}">${f.author === 'other' ? '<span class="badge-other">non-Hickel source</span> ' : ''}${esc(f.citation)}</a>`
