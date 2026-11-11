// Data model for the political-economy systems map: boxes, arrows, loops, switches and their sources.

export type StateId = 'today' | 'alt'
export type LensId = 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6'
export type Layer = 'political' | 'economic' | 'ecosystem'
export type Region = 'north' | 'south' | 'global'
export type Scale = 'neighborhood' | 'firm' | 'national' | 'global'
export type EpisodeId = 'BF1' | 'BF2' | 'FACTO' | 'BERGEN' | 'TEA' | 'MEAR' | 'FINK' | 'IAI'
export type LeverId = 'invest' | 'provision' | 'work' | 'workplace' | 'politics' | 'empire' | 'energy'
export type LeverSide = 'left' | 'right'
/** Stage 9a: an on/off decision. Left = Today's position, right = Democratic socialism's. */
export type Lever = { id: LeverId; label: string; short: string; left: string; right: string; sources: Source[] }
/** An element is active only when every listed lever is in the given position. */
export type When = Partial<Record<LeverId, LeverSide>>

/** One talk in the corpus. `videoId` may be missing until we have the link; its sources then have no URL. */
export type Episode = {
  id: EpisodeId
  title: string
  venue: string
  videoId?: string
  duration: string
  /** Subtitle file name inside txt_sources/srt/ (git-ignored; only used locally to verify anchors). */
  subtitles: string
  /** A talk by someone other than Hickel. Its sources are shown under the speaker's name, never colored into the ripple. */
  outside?: boolean
  /** The name shown for an outside talk's sources; a panel's sources carry their own `speaker`. */
  speaker?: string
  /** Where to watch it, for a talk that is not on YouTube (no timestamp link). */
  url?: string
  /** For an outside talk: how its claims were checked. */
  verification?: string
}
export type FlowKind = 'labor' | 'resources' | 'money' | 'decision' | 'vote' | 'pollution' | 'force' | 'ideology'
export type NodeGroup =
  | 'people'
  | 'capital'
  | 'state'
  | 'production'
  | 'output'
  | 'south'
  | 'ecosystem'
  | 'alternative'
  | 'politics'

/** A moment in one of the talks. `anchor` is a short phrase used to verify `t` against that talk's subtitles. */
export type Source = {
  ep?: EpisodeId // defaults to BF1
  t: string // "mm:ss" or "h:mm:ss"
  anchor: string
  note: string // paraphrase of what is argued there
  quote?: string // optional verbatim quote, ≤ 25 words
  speaker?: string // who says it, in an outside talk with several speakers
}

export type Node = {
  id: string
  label: string
  group: NodeGroup
  layer: Layer
  region: Region
  scales: Scale[]
  states: StateId[]
  lenses: LensId[]
  description: string
  /** Optional state-specific description that overrides `description`. */
  byState?: Partial<Record<StateId, string>>
  /** Which lever decides whether the `byState.alt` description applies. */
  descLever?: LeverId
  /** Stage 9b: the condition this box carries, colored vicious ↔ virtuous. */
  condition?: { label: string; vicious: string; virtuous: string }
  examples?: string[]
  /** Rests only on outside voices (Episode.outside): shown with a badge naming them. */
  external?: boolean
  sources: Source[]
  figures?: string[]
}

export type Flow = {
  id: string
  from: string
  to: string
  kind: FlowKind
  label: string
  states: StateId[]
  lenses: LensId[]
  description: string
  /** Relative thickness, 1 = thin, 3 = dominant. */
  weight?: 1 | 2 | 3
  /** A flow that is structurally impossible in this state (e.g. votes reaching investment decisions today). */
  blocked?: boolean
  /** Lever conditions for this flow; absent = present whatever the levers. */
  when?: When
  /**
   * Not from Hickel's talks: the arrow rests only on outside figures, listed in `figures`, or on outside
   * voices (Episode.outside). Shown with a badge and drawn dashed.
   */
  external?: boolean
  sources: Source[]
  figures?: string[]
}

export type Lens = { id: LensId; title: string; question: string }

export type HistoricalEvent = {
  id: string
  label: string
  year: string
  sortYear?: number
  era?: string
  region: Region
  lenses: LensId[]
  description: string
  sources: Source[]
}

/**
 * A feedback loop: an ordered cycle of flow ids where each flow ends where the next begins
 * and the last returns to the first. These are our synthesis of the argument, each grounded in sources.
 */
export type Loop = {
  id: string
  label: string
  kind: 'reinforcing' | 'balancing'
  tone: 'vicious' | 'virtuous'
  state: StateId
  lenses: LensId[]
  path: string[]
  description: string
  sources: Source[]
  figures?: string[]
}

/**
 * A lens explainer (Stage 5+): content shown in the panel when a lens is focused.
 * `links` point at node, flow or loop ids on the map.
 */
export type ExplainerOption = {
  id: string
  label: string
  nodeId: string
  cost: string
  costRank: 1 | 2 // 1 = better for society (cheaper)
  profit: string
  profitRank: 1 | 2 // 1 = more profitable to capital
  need: string
  needRank: 1 | 2 // 1 = more necessary
}
export type ExplainerRule = {
  id: string
  label: string
  tag: string
  picksBy: 'cost' | 'profit' | 'need'
  state?: StateId
  verdict: string
  show?: { state: StateId; focus: string } // "show on map"
  sources: Source[]
}
export type ExplainerItem = { title: string; text: string; sources: Source[]; links?: string[]; figures?: string[] }
export type ExplainerPair = { profitable: string; necessary: string; sources: Source[] }
export type LawOfValueExplainer = {
  kind: 'law-of-value'
  lens: LensId
  title: string
  intro: string
  options: ExplainerOption[]
  claims: { cost: ExplainerItem; profit: ExplainerItem }
  rules: ExplainerRule[]
  reasons: ExplainerItem[]
  pairs: ExplainerPair[]
  cases: ExplainerItem[]
}

/** Stage 7: how the South is kept cheap — three routes into one surplus, figures, the 1970s fork, history, the program. */
export type NorthSouthExplainer = {
  kind: 'north-south'
  lens: LensId
  title: string
  intro: string
  why: ExplainerItem[]
  routes: { id: string; title: string; mechanism: string; loop: string; text: string; sources: Source[] }[]
  sharedFlow: string
  stats: { figure: string; value: number; label: string }[]
  fork: {
    title: string
    text: string
    chosen: string
    sources: Source[]
    options: { id: string; label: string; text: string; show: { state: StateId; focus: string }; events?: string[]; sources: Source[] }[]
  }
  eras: { id: string; label: string; text: string }[]
  program: ExplainerItem[]
}

/** A "show on map" view: a named set of flows in one state (focus id = group id, e.g. "L5:cause"). */
export type ExplainerGroup = { id: string; label: string; state: StateId; text: string; flows: string[]; sources: Source[] }

/** Stage 8: the shared ecosystem — who causes the damage, who bears it, the paradox, and what must change. */
export type EcosystemExplainer = {
  kind: 'ecosystem'
  lens: LensId
  title: string
  intro: string
  groups: ExplainerGroup[]
  /** Percent bars drawn from registered figures: `values` are indexes into the figure's values. */
  bars: { title: string; figure: string; values: number[]; note: string }[]
  exposure: ExplainerItem[]
  dimensions: ExplainerItem[]
  paradox: ExplainerItem
  energy: ExplainerItem[]
  alternative: ExplainerItem[]
}

/** Stage 10: decisions by level, each controlled by a lever (who decides today vs in the alternative). */
export type ScalesExplainer = {
  kind: 'scales'
  lens: LensId
  title: string
  intro: string
  principle: ExplainerItem
  levels: {
    id: Scale
    label: string
    text: string
    decisions: { id: string; label: string; lever: LeverId; today: { who: string; text: string; sources: Source[] }; alt: { who: string; text: string; sources: Source[] } }[]
  }[]
}

export type Explainer = LawOfValueExplainer | NorthSouthExplainer | EcosystemExplainer | ScalesExplainer

/** One row of the Today vs Alternative comparison. */
export type Contrast = {
  id: string
  lever: LeverId
  question: string
  today: string
  alt: string
  sources: Source[]
}

export type SystemModel = {
  meta: { title: string; episodes: Episode[] }
  states: Record<StateId, { label: string; description: string }>
  lenses: Lens[]
  nodes: Node[]
  flows: Flow[]
  events: HistoricalEvent[]
  contrasts: Contrast[]
  loops: Loop[]
  explainers: Explainer[]
  levers: Lever[]
  influences: InfluenceDef[]
}

/** Stage 9b: a signed, sourced influence between conditions (from a node, or from "lever:<id>"). */
export type InfluenceDef = { from: string; to: string; sign: 1 | -1; weight: number; label: string; when?: When; sources: Source[] }

export type Figure = {
  id: string
  label: string
  values: { value: string; unit: string; note?: string }[]
  year: string
  lenses: LensId[]
  attachTo: string[] // node or flow ids
  citation: string
  doi?: string
  url: string
  caveat: string
  verification: 'abstract' | 'full-text' | 'secondary'
  location?: string // page / table / section in the source
  author: 'hickel' | 'other'
}

/** Built output: sources resolved to seconds and YouTube links. */
export type ResolvedSource = Source & { ep: EpisodeId; seconds: number; url: string | null }
/** Replaces every `sources: Source[]` inside T (at any depth) with resolved sources. */
type DeepResolved<T> = T extends Source[]
  ? ResolvedSource[]
  : T extends (infer U)[]
    ? DeepResolved<U>[]
    : T extends object
      ? { [K in keyof T]: DeepResolved<T[K]> }
      : T
export type BuiltExplainer = DeepResolved<Explainer>
export type BuiltLawOfValue = DeepResolved<LawOfValueExplainer>
export type BuiltNorthSouth = DeepResolved<NorthSouthExplainer>
export type BuiltEcosystem = DeepResolved<EcosystemExplainer>
export type BuiltScales = DeepResolved<ScalesExplainer>
export type BuiltData = Omit<SystemModel, 'nodes' | 'flows' | 'events' | 'contrasts' | 'loops' | 'explainers' | 'levers' | 'influences'> & {
  levers: DeepResolved<Lever[]>
  influences: DeepResolved<InfluenceDef[]>
  explainers: BuiltExplainer[]
  nodes: (Omit<Node, 'sources'> & { sources: ResolvedSource[] })[]
  flows: (Omit<Flow, 'sources'> & { sources: ResolvedSource[] })[]
  events: (Omit<HistoricalEvent, 'sources'> & { sources: ResolvedSource[] })[]
  contrasts: (Omit<Contrast, 'sources'> & { sources: ResolvedSource[] })[]
  loops: (Omit<Loop, 'sources'> & { sources: ResolvedSource[] })[]
  figures: Figure[]
}
