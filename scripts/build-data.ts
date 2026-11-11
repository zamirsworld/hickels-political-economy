// Validates annotations/*.json and writes src/data/system.json for the app.
// Usage: npm run data
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import type { BuiltData, EpisodeId, Figure, LensId, Source, StateId, SystemModel } from '../src/model/types.ts'
import { formatTime, loadSearchers, toSeconds } from './subtitles.ts'

const ROOT = new URL('..', import.meta.url).pathname
const model: SystemModel = JSON.parse(readFileSync(`${ROOT}annotations/system.json`, 'utf8'))
const figures: Figure[] = JSON.parse(readFileSync(`${ROOT}annotations/figures.json`, 'utf8'))

const errors: string[] = []
const warnings: string[] = []
const LENSES = new Set<LensId>(model.lenses.map((l) => l.id))
const STATES = new Set<StateId>(Object.keys(model.states) as StateId[])
const MAX_QUOTE_WORDS = 25
const ANCHOR_TOLERANCE_SEC = 5

// --- ids ---
const ids = new Map<string, string>()
for (const [kind, list] of [['node', model.nodes], ['flow', model.flows], ['event', model.events]] as const) {
  for (const item of list) {
    if (ids.has(item.id)) errors.push(`duplicate id "${item.id}" (${kind} and ${ids.get(item.id)})`)
    ids.set(item.id, kind)
  }
}
const nodeById = new Map(model.nodes.map((n) => [n.id, n]))
const figureIds = new Set(figures.map((f) => f.id))

// --- episodes + sources (anchors checked against each talk's local subtitle file) ---
const episodes = new Map(model.meta.episodes.map((e) => [e.id, e]))
const { searchers, missing } = loadSearchers(model.meta.episodes)
if (missing.length) warnings.push(`no local subtitles for ${missing.join(', ')}: their anchors are not verified`)
model.meta.episodes.forEach((e) => e.videoId || warnings.push(`episode ${e.id}: no videoId yet, so its sources get no link`))
const epOf = (s: Source): EpisodeId => s.ep ?? 'BF1'
const isOutside = (s: Source) => !!episodes.get(epOf(s))?.outside

function checkSources(owner: string, sources: Source[]) {
  if (!sources.length) errors.push(`${owner}: has no sources`)
  for (const s of sources) {
    if (!/^(\d+:)?\d{1,2}:\d\d$/.test(s.t)) errors.push(`${owner}: bad time "${s.t}"`)
    if (s.quote && s.quote.split(/\s+/).length > MAX_QUOTE_WORDS) errors.push(`${owner}: quote longer than ${MAX_QUOTE_WORDS} words`)
    const ep = epOf(s)
    if (!episodes.has(ep)) errors.push(`${owner}: unknown episode "${ep}"`)
    const search = searchers.get(ep)
    if (search) {
      const hits = search(s.anchor)
      if (!hits.length) errors.push(`${owner}: anchor not found in ${ep} subtitles: "${s.anchor}"`)
      else if (!hits.some((h) => Math.abs(h - toSeconds(s.t)) <= ANCHOR_TOLERANCE_SEC))
        errors.push(`${owner}: ${ep} t=${s.t} but anchor "${s.anchor}" is at ${hits.map(formatTime).join(', ')}`)
    }
  }
}

const checkLenses = (owner: string, lenses: LensId[]) =>
  lenses.forEach((l) => LENSES.has(l) || errors.push(`${owner}: unknown lens "${l}"`))
const checkStates = (owner: string, states: StateId[]) =>
  states.forEach((s) => STATES.has(s) || errors.push(`${owner}: unknown state "${s}"`))
const checkFigures = (owner: string, figs: string[] = []) =>
  figs.forEach((f) => figureIds.has(f) || errors.push(`${owner}: unknown figure "${f}"`))

for (const n of model.nodes) {
  const o = `node ${n.id}`
  checkSources(o, n.sources)
  if (!!n.external !== n.sources.every(isOutside)) errors.push(`${o}: "external" must be set exactly when it rests only on outside voices`)
  checkLenses(o, n.lenses)
  checkStates(o, n.states)
  checkFigures(o, n.figures)
}
for (const f of model.flows) {
  const o = `flow ${f.id}`
  if (f.external) {
    // an outside arrow needs outside figures, all of them marked as non-Hickel
    const figs = (f.figures ?? []).map((id) => figures.find((x) => x.id === id))
    if (!figs.length && !f.sources.length) errors.push(`${o}: external flow without figures or outside voices`)
    if (f.sources.some((s) => !isOutside(s))) errors.push(`${o}: external flow cites Hickel, so it should not be external`)
    if (figs.some((x) => x && x.author !== 'other')) errors.push(`${o}: external flow cites a Hickel figure`)
    if (f.sources.length) checkSources(o, f.sources)
  } else {
    checkSources(o, f.sources)
    if (f.sources.length && f.sources.every(isOutside)) errors.push(`${o}: rests only on outside voices, so it must be external`)
  }
  checkLenses(o, f.lenses)
  checkStates(o, f.states)
  checkFigures(o, f.figures)
  for (const end of [f.from, f.to]) {
    const node = nodeById.get(end)
    if (!node) errors.push(`${o}: unknown node "${end}"`)
    else f.states.forEach((s) => node.states.includes(s) || errors.push(`${o}: active in "${s}" but node ${end} is not`))
  }
}
// loops: every flow exists in the loop's state, and the path is a closed chain
const flowById = new Map(model.flows.map((f) => [f.id, f]))
for (const loop of model.loops) {
  const o = `loop ${loop.id}`
  if (ids.has(loop.id)) errors.push(`${o}: id also used by a ${ids.get(loop.id)}`)
  ids.set(loop.id, 'loop')
  checkSources(o, loop.sources)
  checkLenses(o, loop.lenses)
  checkStates(o, [loop.state])
  checkFigures(o, loop.figures)
  const steps = loop.path.map((id) => flowById.get(id))
  steps.forEach((f, i) => {
    if (!f) return errors.push(`${o}: unknown flow "${loop.path[i]}"`)
    if (!f.states.includes(loop.state)) errors.push(`${o}: flow ${f.id} is not active in "${loop.state}"`)
    const next = steps[(i + 1) % steps.length]
    if (next && f.to !== next.from) errors.push(`${o}: ${f.id} ends at ${f.to} but ${next.id} starts at ${next.from}`)
  })
}
// explainers: walked recursively, so every kind gets the same checks.
// sources → verified; figures/links/loop/nodeId/sharedFlow/events/show/figure+value → must resolve.
const loopIds = new Set(model.loops.map((l) => l.id))
const eventIds = new Set(model.events.map((e) => e.id))
const flowIds = new Set(model.flows.map((f) => f.id))
function checkDeep(value: unknown, owner: string) {
  if (Array.isArray(value)) return value.forEach((v, i) => checkDeep(v, `${owner}[${i}]`))
  if (!value || typeof value !== 'object') return
  const o = value as Record<string, any>
  const name = o.title ?? o.label ?? o.id ?? ''
  const here = name ? `${owner} "${name}"` : owner
  if (Array.isArray(o.sources)) checkSources(here, o.sources)
  if (Array.isArray(o.figures)) checkFigures(here, o.figures)
  if (Array.isArray(o.links)) o.links.forEach((id: string) => ids.has(id) || errors.push(`${here}: unknown link "${id}"`))
  if (typeof o.lever === 'string' && !model.levers.some((l) => l.id === o.lever)) errors.push(`${here}: unknown lever "${o.lever}"`)
  if (typeof o.loop === 'string' && !loopIds.has(o.loop)) errors.push(`${here}: unknown loop "${o.loop}"`)
  if (typeof o.nodeId === 'string' && !nodeById.has(o.nodeId)) errors.push(`${here}: unknown node "${o.nodeId}"`)
  if (typeof o.sharedFlow === 'string' && !flowIds.has(o.sharedFlow)) errors.push(`${here}: unknown flow "${o.sharedFlow}"`)
  if (Array.isArray(o.events)) o.events.forEach((id: string) => eventIds.has(id) || errors.push(`${here}: unknown event "${id}"`))
  if (o.show && !loopIds.has(o.show.focus) && !LENSES.has(o.show.focus)) errors.push(`${here}: show.focus "${o.show.focus}" is neither a loop nor a lens`)
  if (Array.isArray(o.flows))
    o.flows.forEach((id: string) => {
      const f = model.flows.find((x) => x.id === id)
      if (!f) errors.push(`${here}: unknown flow "${id}"`)
      else if (o.state && !f.states.includes(o.state)) errors.push(`${here}: flow ${id} is not active in "${o.state}"`)
    })
  if (typeof o.figure === 'string' && Array.isArray(o.values)) {
    const fig = figures.find((f) => f.id === o.figure)
    o.values.forEach((i: number) => fig?.values[i] || errors.push(`${here}: ${o.figure} has no value #${i}`))
  }
  if (typeof o.figure === 'string') {
    const fig = figures.find((f) => f.id === o.figure)
    if (!fig) errors.push(`${here}: unknown figure "${o.figure}"`)
    else if (typeof o.value === 'number' && !fig.values[o.value]) errors.push(`${here}: ${o.figure} has no value #${o.value}`)
  }
  for (const [k, v] of Object.entries(o)) if (k !== 'sources' && typeof v === 'object') checkDeep(v, `${owner}.${k}`)
}
for (const ex of model.explainers ?? []) {
  checkLenses(`explainer ${ex.lens}`, [ex.lens])
  checkDeep(ex, `explainer ${ex.lens}`)
  if (ex.kind === 'north-south') {
    const eras = new Set(ex.eras.map((e) => e.id))
    model.events.forEach((e) => e.era && !eras.has(e.era) && errors.push(`event ${e.id}: era "${e.era}" not declared in explainer ${ex.lens}`))
  }
}
// levers: sources verified; every state-specific flow has lever conditions that agree with its states
const LEVER_IDS = new Set(model.levers.map((l) => l.id))
for (const lv of model.levers) checkSources(`lever ${lv.id}`, lv.sources)
for (const f of model.flows) {
  const o = `flow ${f.id}`
  const sides = Object.entries(f.when ?? {})
  sides.forEach(([id]) => LEVER_IDS.has(id as never) || errors.push(`${o}: unknown lever "${id}"`))
  if (f.states.length === 1) {
    if (!sides.length) errors.push(`${o}: ${f.states[0]}-only flow needs lever conditions ("when")`)
    const want = f.states[0] === 'today' ? 'left' : 'right'
    sides.forEach(([id, side]) => side === want || errors.push(`${o}: ${f.states[0]}-only but lever ${id} is "${side}"`))
  } else if (sides.length) errors.push(`${o}: present in both states but has lever conditions`)
}
for (const n of model.nodes)
  if (n.descLever && !LEVER_IDS.has(n.descLever)) errors.push(`node ${n.id}: unknown descLever "${n.descLever}"`)
// influences (Stage 9b): endpoints carry conditions, sources verified, lever conditions valid
const condNodes = new Set(model.nodes.filter((n) => n.condition).map((n) => n.id))
model.influences.forEach((inf, i) => {
  const o = `influence ${i + 1} (${inf.from} → ${inf.to})`
  checkSources(o, inf.sources)
  if (inf.from.startsWith('lever:')) LEVER_IDS.has(inf.from.slice(6) as never) || errors.push(`${o}: unknown lever`)
  else if (!condNodes.has(inf.from)) errors.push(`${o}: source node has no condition`)
  if (!condNodes.has(inf.to)) errors.push(`${o}: target node has no condition`)
  if (inf.sign !== 1 && inf.sign !== -1) errors.push(`${o}: sign must be 1 or -1`)
  Object.keys(inf.when ?? {}).forEach((id) => LEVER_IDS.has(id as never) || errors.push(`${o}: unknown lever "${id}" in when`))
})
condNodes.forEach((id) => model.influences.some((i) => i.to === id) || errors.push(`node ${id}: has a condition but nothing influences it`))
for (const c of model.contrasts) if (!LEVER_IDS.has(c.lever)) errors.push(`contrast ${c.id}: unknown lever "${c.lever}"`)
for (const c of model.contrasts) {
  checkSources(`contrast ${c.id}`, c.sources)
}
for (const e of model.events) {
  checkSources(`event ${e.id}`, e.sources)
  checkLenses(`event ${e.id}`, e.lenses)
}
for (const fig of figures) {
  const o = `figure ${fig.id}`
  if (!fig.citation || !fig.url) errors.push(`${o}: missing citation or url`)
  checkLenses(o, fig.lenses)
  fig.attachTo.forEach((id) => ids.has(id) || errors.push(`${o}: attachTo unknown id "${id}"`))
  if (fig.verification !== 'full-text') warnings.push(`${o}: verified against ${fig.verification} only`)
}

// outside voices: named, verified, marked where Hickel doesn't support them, and never part of the ripple
const outsideOnly = new Set([...model.nodes, ...model.flows].filter((x) => x.sources.length && x.sources.every(isOutside)).map((x) => x.id))
for (const e of model.meta.episodes) if (e.outside && !e.verification) errors.push(`episode ${e.id}: outside talk needs "verification"`)
for (const [i, inf] of model.influences.entries()) {
  if (inf.sources.some(isOutside)) errors.push(`influence ${i + 1}: the ripple stays Hickel-only`)
  if (outsideOnly.has(inf.from) || outsideOnly.has(inf.to)) errors.push(`influence ${i + 1}: touches a box that rests only on outside voices`)
}
for (const s of [...model.nodes, ...model.flows, ...model.loops].flatMap((x) => x.sources))
  if (isOutside(s) && !s.speaker && !episodes.get(epOf(s))?.speaker) errors.push(`source at ${s.t} in ${epOf(s)}: no speaker to name`)

// orphan check: every node should take part in at least one flow
for (const n of model.nodes) {
  if (!model.flows.some((f) => f.from === n.id || f.to === n.id)) warnings.push(`node ${n.id}: not connected to any flow`)
}

// --- report ---
warnings.forEach((w) => console.warn(`  warn  ${w}`))
if (errors.length) {
  errors.forEach((e) => console.error(`  ERROR ${e}`))
  console.error(`\n✗ ${errors.length} error(s); nothing written.`)
  process.exit(1)
}

// --- build ---
const resolve = (s: Source) => {
  const seconds = toSeconds(s.t)
  const ep = epOf(s)
  const { videoId, url } = episodes.get(ep) ?? {}
  return { ...s, ep, seconds, url: videoId ? `https://youtu.be/${videoId}?t=${seconds}` : (url ?? null) }
}
/** Replaces every `sources` array at any depth with resolved sources. */
function resolveDeep<T>(value: T): T {
  if (Array.isArray(value)) return value.map(resolveDeep) as T
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [k, k === 'sources' && Array.isArray(v) ? v.map(resolve) : resolveDeep(v)]),
  ) as T
}
const built: BuiltData = {
  ...model,
  nodes: model.nodes.map((n) => ({ ...n, sources: n.sources.map(resolve) })),
  flows: model.flows.map((f) => ({ ...f, sources: f.sources.map(resolve) })),
  events: model.events.map((e) => ({ ...e, sources: e.sources.map(resolve) })),
  contrasts: model.contrasts.map((c) => ({ ...c, sources: c.sources.map(resolve) })),
  loops: model.loops.map((l) => ({ ...l, sources: l.sources.map(resolve) })),
  explainers: (model.explainers ?? []).map((ex) => resolveDeep(ex)) as BuiltData['explainers'],
  levers: resolveDeep(model.levers),
  influences: resolveDeep(model.influences),
  figures,
}
mkdirSync(`${ROOT}src/data`, { recursive: true })
writeFileSync(`${ROOT}src/data/system.json`, JSON.stringify(built, null, 2) + '\n')

const count = (s: StateId) => [model.nodes.filter((n) => n.states.includes(s)).length, model.flows.filter((f) => f.states.includes(s)).length]
const sourceCount = [...model.nodes, ...model.flows, ...model.events, ...model.contrasts, ...model.loops].reduce((a, x) => a + x.sources.length, 0)
const byEp = new Map<EpisodeId, number>()
for (const x of [...model.nodes, ...model.flows, ...model.events, ...model.contrasts, ...model.loops])
  for (const s of x.sources) byEp.set(epOf(s), (byEp.get(epOf(s)) ?? 0) + 1)
console.log(`✓ src/data/system.json written`)
console.log(`  sources by talk: ${[...byEp].map(([e, n]) => `${e} ${n}`).join(' · ')}`)
console.log(`  ${model.nodes.length} nodes · ${model.flows.length} flows · ${model.events.length} events · ${model.contrasts.length} contrasts · ${model.loops.length} loops · ${figures.length} figures · ${sourceCount} sources`)
for (const s of STATES) console.log(`  ${model.states[s].label}: ${count(s)[0]} nodes, ${count(s)[1]} flows`)
for (const l of model.lenses) {
  const n = model.nodes.filter((x) => x.lenses.includes(l.id)).length
  const f = model.flows.filter((x) => x.lenses.includes(l.id)).length
  console.log(`  ${l.id} ${l.title}: ${n} nodes, ${f} flows`)
}
