// The map's engine: the data, the world state (levers, ripple), navigation, the shell (header, start
// screen, legend) and the side panel. src/map supplies the plane model and the drawing.
import './base.css'
import raw from '../data/system.json'
import { activeView, configFor, LEVER_ORDER, presetOf, PRESETS, type LeverConfig } from '../model/levers.ts'
import { conditionValues, level, rippleSteps } from '../model/ripple.ts'
import type { BuiltData, LeverId, ResolvedSource } from '../model/types.ts'
import { CYCLE_CARDS, WALKTHROUGHS } from '../cycles/registry.ts'

export const data = raw as unknown as BuiltData
export type Flow = BuiltData['flows'][number]
export type Loop = BuiltData['loops'][number]
export const nodeById = new Map(data.nodes.map((n) => [n.id, n]))
export const flowById = new Map(data.flows.map((f) => [f.id, f]))
export const loopById = new Map(data.loops.map((l) => [l.id, l]))
export const leverById = new Map(data.levers.map((l) => [l.id, l]))
const episodeById = new Map(data.meta.episodes.map((e) => [e.id, e]))
/** The outside speaker behind a source, or null for Hickel. */
const speakerOf = (s: ResolvedSource) => (episodeById.get(s.ep)?.outside ? (s.speaker ?? episodeById.get(s.ep)!.speaker ?? s.ep) : null)
const speakers = (ss: ResolvedSource[]) => [...new Set(ss.map(speakerOf).filter((x): x is string => !!x))]
/** A badge naming who an outside item rests on. */
const outsideBadge = (ss: ResolvedSource[]) => `<span class="badge-out">${esc(speakers(ss).join(', ') || 'non-Hickel source')}</span>`
/** The shared side-panel note for outside voices: the whole item, or part of it. */
function outsideNote(what: string, x: { external?: boolean; sources: ResolvedSource[] }) {
  if (x.external) return `<p class="note">${outsideBadge(x.sources)} This ${what} is not from Hickel’s talks. It rests on the outside sources below.</p>`
  return speakers(x.sources).length ? `<p class="note">${outsideBadge(x.sources)} Part of this ${what} comes from outside voices; their sources are marked below.</p>` : ''
}
export const label = (id: string) => nodeById.get(id)?.label ?? id
export { LEVER_ORDER }

// --- planes ---------------------------------------------------------------------------------------
export type PlaneId = 'north' | 'south' | 'environment' | 'global'
export type PlaneDef = { id: PlaneId; label: string; short: string; blurb: string }
export type LeverHome = { gate: string } | { node: string }
export type PlaneModel = {
  planes: PlaneDef[]
  planeOf: (node: string) => PlaneId
  /** Touchpoints, keyed "a|b" in plane order. */
  gates: { key: string; a: PlaneId; b: PlaneId }[]
  leverHome: Record<LeverId, LeverHome>
  /** What to call a touchpoint in this model ("touchpoint", "crossing", …). */
  gateWord: string
}
export function pairKey(model: PlaneModel, a: PlaneId, b: PlaneId) {
  const order = model.planes.map((p) => p.id)
  return order.indexOf(a) < order.indexOf(b) ? `${a}|${b}` : `${b}|${a}`
}
/** The touchpoint an arrow crosses, if its two planes touch. */
export function gateOf(model: PlaneModel, f: Flow) {
  const a = model.planeOf(f.from)
  const b = model.planeOf(f.to)
  const k = a === b ? null : pairKey(model, a, b)
  return k && model.gates.some((g) => g.key === k) ? k : null
}

export const ENTRIES: { id: string; question: string; hint: string; node?: string }[] = [
  { id: 'work', question: 'Why do I feel insecure at work?', hint: 'Start with workers in the North', node: 'workers_north' },
  { id: 'build', question: 'Who decides what gets built?', hint: 'Start with capital', node: 'capital' },
  { id: 'vote', question: 'Why does voting change so little?', hint: 'Start with citizens', node: 'citizens' },
  { id: 'wealth', question: 'Where does the North’s wealth come from?', hint: 'Start with workers in the South', node: 'south_workers' },
  { id: 'fossil', question: 'Why are we still burning fossil fuels?', hint: 'Start with fossil fuels', node: 'fossil' },
  { id: 'look', question: 'Just let me look around', hint: 'See the whole system from outside' },
]

// --- state ----------------------------------------------------------------------------------------
export type Mode =
  | { kind: 'outside' }
  | { kind: 'plane'; plane: PlaneId }
  | { kind: 'node'; node: string }
  | { kind: 'gate'; gate: string }
  | { kind: 'loop'; loop: string; step: number }
  | { kind: 'flow'; flow: string }
export type ThemeId = 'orrery' | 'transit' | 'zellige' | 'zellige-night'
export const THEMES: { id: ThemeId; label: string; note: string }[] = [
  { id: 'orrery', label: 'Orrery', note: 'Night sky, fine gold lines, glowing touchpoints' },
  { id: 'transit', label: 'Transit', note: 'A metro map on warm paper: bold colored lines, interchange stations' },
  { id: 'zellige', label: 'Zellige', note: 'Islamic tile: ivory ground, strapwork arrows, star-shaped boxes' },
  { id: 'zellige-night', label: 'Zellige night', note: 'Islamic tile on a deep cobalt ground' },
]
export type Emphasis = {
  opt: Set<string>
  inc: Set<string>
  trailFlows: Set<string>
  loopFlows: Set<string>
  step: string | null
  tone: 'vicious' | 'virtuous' | null
}

export interface MapAdapter {
  /** Build the stage for the current theme (called on start and on every theme change). */
  render(app: App): void
  /** Apply the current state (classes, labels, particles). */
  update(app: App): void
  /** Move the camera for a navigation; `via` is the arrow followed, if any. */
  navigate(app: App, prev: Mode, via?: Flow): void
  /** Replace the default side panel. */
  panel?(app: App): string
  resize?(app: App): void
}

const condIds = data.nodes.filter((n) => n.condition).map((n) => n.id)
function computeLevels(c: LeverConfig) {
  const v = conditionValues(condIds, data.influences, c)
  return new Map(condIds.map((id) => [id, level(v.get(id)!)]))
}

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
export function watchLink(s: ResolvedSource) {
  const who = speakerOf(s)
  const tip = esc(`${episodeById.get(s.ep)?.title ?? s.ep} — ${s.note}`)
  return s.url ? `<a class="watch${who ? ' outside' : ''}" href="${esc(s.url)}" target="_blank" rel="noopener" title="${tip}">▶ ${esc(s.t)} <span>${esc(who ?? s.ep)}</span></a>` : ''
}
/** Cited figures, with a badge on those that do not come from Hickel. */
export function figuresHtml(ids: string[] = []) {
  return ids
    .map((id) => data.figures.find((f) => f.id === id))
    .filter((f): f is BuiltData['figures'][number] => !!f)
    .map(
      (f) => `<div class="fig-card"><div class="fig-head"><strong>${esc(f.label)}</strong>${f.author === 'other' ? '<span class="badge-out">non-Hickel source</span>' : ''}</div>
        <ul class="fig-values">${f.values.map((v) => `<li><strong>${esc(v.value)}</strong> ${esc(v.unit)}${v.note ? ` <span class="muted">· ${esc(v.note)}</span>` : ''}</li>`).join('')}</ul>
        <p class="small muted">${esc(f.caveat)}</p>
        <a class="fig-cite small" href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.citation)}</a></div>`,
    )
    .join('')
}
export const links = (ss: ResolvedSource[]) => (ss.length ? `<div class="links">${ss.map(watchLink).join('')}</div>` : '')

function readTheme(allowed: ThemeId[]): ThemeId {
  const h = new URLSearchParams(location.hash.slice(1)).get('theme')
  if (h && allowed.includes(h as ThemeId)) return h as ThemeId
  try {
    const s = localStorage.getItem('proto-theme')
    if (s && allowed.includes(s as ThemeId)) return s as ThemeId
  } catch {
    /* storage unavailable */
  }
  return allowed[0]
}
function readMotion() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return false
  try {
    return localStorage.getItem('proto-motion') !== 'off'
  } catch {
    return true
  }
}

export class App {
  cfg: LeverConfig = configFor('today')
  view = activeView(data, this.cfg)
  levels = computeLevels(this.cfg)
  mode: Mode = { kind: 'outside' }
  trail: { node: string; via?: string }[] = []
  hotFlow: string | null = null
  theme: ThemeId
  themes: ThemeId[]
  motion = readMotion()
  /** Ripple delay per box (ms) for the last switch flipped. */
  delays = new Map<string, number>()
  started = false
  stage: HTMLElement
  panel: HTMLElement
  storyBar: HTMLElement
  model: PlaneModel
  map: MapAdapter
  /** Named cycles the reader has closed by walking (persist for the session). */
  traced = new Set<string>()
  /** Set while a guided story drives navigation (cycle toasts are left to the story). */
  storyActive = false
  /** Announce closed cycles with a toast. */
  closureToasts = true
  /** While the reader is guessing, hide where the arrows go. */
  quiz = false
  /** How the opening card starts: a guided cycle (the default), a short story, or free exploring. */
  startMode: 'cycles' | 'story' | 'explore' = 'cycles'
  /** Whether short stories exist (story.ts sets this). */
  hasStories = false
  /** A story takes over an entry question; returns false if it has none. */
  onEntry?: (entryId: string) => boolean
  /** Called after every lever flip, with the narrated changes. */
  lastRipple: { lever: LeverId; on: boolean; html: string } | null = null

  constructor(opts: { model: PlaneModel; map: MapAdapter; subtitle: string; themes?: ThemeId[] }) {
    this.themes = opts.themes ?? ['orrery', 'transit']
    this.theme = readTheme(this.themes)
    this.model = opts.model
    this.map = opts.map
    const app = document.getElementById('app')!
    app.innerHTML = `
      <header class="top">
        <div class="brand"><a class="brand-mark" href="./" title="The Political Economy Map" aria-label="Home"></a><div><div class="brand-title">The Political Economy Map</div><div class="brand-sub">${esc(opts.subtitle)} · <a href="./cycles/">guided cycles</a></div></div></div>
        <div class="top-controls">
          <div class="seg" role="group" aria-label="Visual theme" id="themes"></div>
          <div class="seg" role="group" aria-label="World" id="worlds"></div>
          <button class="ghost-btn" id="motion" type="button"></button>
        </div>
      </header>
      <main class="body">
        <section class="stage-wrap"><div class="stage" id="stage" aria-label="Map"></div>
          <div class="story-bar" id="story" hidden></div>
          <div class="toast" id="toast" role="status" aria-live="polite" hidden></div></section>
        <aside class="panel" id="panel" aria-live="polite"></aside>
      </main>`
    this.stage = document.getElementById('stage')!
    this.panel = document.getElementById('panel')!
    this.storyBar = document.getElementById('story')!
    document.documentElement.dataset.theme = this.theme
    this.bindEvents()
    this.rebuild()
    this.renderStart()
    addEventListener('resize', () => this.map.resize?.(this))
    document.fonts?.ready.then(() => this.map.resize?.(this))
  }

  /** Re-create the stage (map + overlay UI) for the current theme. */
  rebuild() {
    this.stage.innerHTML = ''
    this.map.render(this)
    const ui = document.createElement('div')
    ui.className = 'stage-ui'
    ui.innerHTML = `<button class="pill" id="outside" type="button">⤢ Step outside</button><div class="legend" id="legend"></div>`
    this.stage.appendChild(ui)
    const start = document.createElement('div')
    start.className = 'start'
    start.id = 'start'
    start.hidden = true
    this.stage.appendChild(start)
    if (!this.started) this.renderStart()
    this.update()
  }

  gateOf = (f: Flow) => gateOf(this.model, f)
  plane = (id: PlaneId) => this.model.planes.find((p) => p.id === id)!

  focusPlane(): PlaneId | 'outside' {
    if (this.mode.kind === 'plane') return this.mode.plane
    if (this.mode.kind === 'node') return this.model.planeOf(this.mode.node)
    return 'outside'
  }

  emphasis(): Emphasis {
    const em: Emphasis = { opt: new Set(), inc: new Set(), trailFlows: new Set(), loopFlows: new Set(), step: null, tone: null }
    for (const t of this.trail) if (t.via) em.trailFlows.add(t.via)
    const m = this.mode
    if (m.kind === 'node' && !this.quiz)
      for (const f of data.flows) {
        if (f.from === m.node && this.view.flows.has(f.id)) em.opt.add(f.id)
        if (f.to === m.node && this.view.flows.has(f.id)) em.inc.add(f.id)
      }
    if (m.kind === 'loop') {
      const loop = loopById.get(m.loop)!
      em.loopFlows = new Set(loop.path)
      em.step = loop.path[m.step]
      em.tone = loop.tone
    }
    if (m.kind === 'gate') for (const f of data.flows) if (this.gateOf(f) === m.gate && this.view.flows.has(f.id)) em.opt.add(f.id)
    if (m.kind === 'flow') em.opt.add(m.flow)
    return em
  }

  update() {
    this.map.update(this)
    this.panel.innerHTML = this.map.panel ? this.map.panel(this) : this.renderPanel()
    this.renderChrome()
  }

  go(m: Mode, opts: { via?: string } = {}) {
    const prev = this.mode
    if (m.kind === 'node') {
      const last = this.trail[this.trail.length - 1]
      if (!last || last.node !== m.node) this.trail.push({ node: m.node, via: opts.via })
    }
    this.mode = m
    this.hideStart()
    this.map.navigate(this, prev, opts.via ? flowById.get(opts.via) : undefined)
    this.update()
    this.panel.scrollTop = 0
    if (m.kind === 'node' && opts.via) {
      const c = this.closures().find((x) => x.at === this.trail.length - 1)
      if (c && !this.storyActive && this.closureToasts) this.toast(closureHtml(c), 9000)
    }
  }

  /** Every point where the path returned to a box it had visited: the cycle walked, and its name if it is one of ours. */
  closures(): Closure[] {
    const out: Closure[] = []
    const t = this.trail
    for (let i = 1; i < t.length; i++) {
      let j = -1
      for (let k = i - 1; k >= 0; k--)
        if (t[k].node === t[i].node) {
          j = k
          break
        }
      if (j < 0) continue
      const flows = t.slice(j + 1, i + 1).map((s) => s.via).filter(Boolean) as string[]
      if (flows.length !== i - j) continue // a jump, not a walk along arrows
      const loop = data.loops.find((l) => l.path.length === flows.length && l.path.every((f) => flows.includes(f))) ?? null
      if (loop) this.traced.add(loop.id)
      out.push({ at: i, from: j, flows, loop })
    }
    return out
  }

  private toastTimer = 0
  toast(html: string, ms = 7000) {
    const el = document.getElementById('toast')
    if (!el) return
    clearTimeout(this.toastTimer)
    el.innerHTML = `<button type="button" class="toast-x" data-toast-close aria-label="Dismiss">×</button>${html}`
    el.hidden = false
    el.classList.remove('in')
    void el.offsetWidth
    el.classList.add('in')
    this.toastTimer = window.setTimeout(() => (el.hidden = true), ms)
  }
  hideToast() {
    const el = document.getElementById('toast')
    if (el) el.hidden = true
  }

  setLever(id: LeverId, on: boolean) {
    if (this.cfg[id] === on) return
    const next = { ...this.cfg, [id]: on }
    const steps = rippleSteps(id, data.influences, next)
    this.delays = new Map([...steps].map(([n, k]) => [n, this.motion ? k * 320 : 0]))
    const before = this.levels
    const flowsBefore = this.view.flows
    this.cfg = next
    this.view = activeView(data, this.cfg)
    this.levels = computeLevels(this.cfg)
    this.lastRipple = { lever: id, on, html: this.rippleHtml(id, on, before, flowsBefore, steps) }
    this.update()
    if (!this.storyActive) this.toast(this.lastRipple.html, 12000)
  }

  /** The ripple, narrated: which boxes changed, in the order the change reaches them. */
  rippleHtml(id: LeverId, on: boolean, before: Map<string, number>, flowsBefore: Set<string>, steps: Map<string, number>) {
    const l = leverById.get(id)!
    const changed = [...this.levels.keys()]
      .filter((n) => before.get(n) !== this.levels.get(n))
      .sort((a, b) => (steps.get(a) ?? 99) - (steps.get(b) ?? 99))
    const opened = [...this.view.flows].filter((f) => !flowsBefore.has(f)).length
    const closed = [...flowsBefore].filter((f) => !this.view.flows.has(f)).length
    const rows = changed
      .slice(0, 7)
      .map((n) => {
        const a = before.get(n) ?? 0
        const b = this.levels.get(n) ?? 0
        return `<li><span class="rp-step" title="Ripple step">${steps.get(n) ?? '·'}</span><span class="rp-name">${esc(label(n))}</span>
          <span class="rp-from ${lvClass(a)}">${esc(levelWord(n, a))}</span><span class="rp-arrow">→</span><span class="rp-to ${lvClass(b)}">${esc(levelWord(n, b))}</span></li>`
      })
      .join('')
    return `<div class="eyebrow">You switched: ${esc(l.label)}</div>
      <div class="rp-title">${esc(on ? l.right : l.left)}</div>
      <p class="small muted">${opened} ${opened === 1 ? 'arrow' : 'arrows'} opened, ${closed} closed. ${changed.length ? `The change spreads to ${changed.length} ${changed.length === 1 ? 'box' : 'boxes'}:` : 'No box changes color.'}</p>
      ${rows ? `<ol class="ripple-list">${rows}</ol>` : ''}${changed.length > 7 ? `<p class="small muted">…and ${changed.length - 7} more.</p>` : ''}`
  }
  setWorld(c: LeverConfig) {
    this.delays = new Map()
    this.cfg = { ...c }
    this.view = activeView(data, this.cfg)
    this.levels = computeLevels(this.cfg)
    this.update()
  }
  setTheme(t: ThemeId) {
    this.theme = t
    document.documentElement.dataset.theme = t
    try {
      localStorage.setItem('proto-theme', t)
    } catch {
      /* ignore */
    }
    const params = new URLSearchParams(location.hash.slice(1))
    params.set('theme', t)
    history.replaceState(null, '', `#${params.toString()}`)
    this.rebuild()
  }

  // --- panel ------------------------------------------------------------------------------------------
  statusHtml(id: string) {
    const n = nodeById.get(id)!
    if (!n.condition) return ''
    const lv = this.levels.get(id) ?? 0
    const word = levelWord(id, lv)
    const cells = [-3, -2, -1, 0, 1, 2, 3].map((v) => `<span class="cell ${lvClass(v)}${v === lv ? ' on' : ''}"></span>`).join('')
    return `<div class="status"><div class="status-meter" aria-hidden="true">${cells}</div>
      <div class="status-text"><span class="muted">${esc(n.condition.label)}:</span> <strong>${esc(word)}</strong></div>
      <div class="status-ends muted"><span>${esc(n.condition.vicious)}</span><span>${esc(n.condition.virtuous)}</span></div></div>`
  }
  switchHtml(id: LeverId, compact = false) {
    const l = leverById.get(id)!
    const on = this.cfg[id]
    return `<button type="button" class="switch${on ? ' on' : ''}${compact ? ' compact' : ''}" role="switch" aria-checked="${on}" data-lever="${id}">
      <span class="sw-track" aria-hidden="true"><span class="sw-knob"></span></span>
      <span class="sw-text"><span class="sw-label">${esc(l.label)}</span><span class="sw-state">${esc(on ? l.right : l.left)}</span></span></button>`
  }
  planeChip(id: PlaneId, button = false) {
    const p = this.plane(id)
    return button
      ? `<button type="button" class="plane-chip pc-${id}" data-plane-go="${id}">${esc(p.short)}</button>`
      : `<span class="plane-chip pc-${id}">${esc(p.short)}</span>`
  }
  loopPlanes(l: Loop) {
    return [...new Set(l.path.map((fid) => this.model.planeOf(flowById.get(fid)!.from)))]
  }
  loopItem(l: Loop) {
    const running = this.view.loops.has(l.id)
    return `<li><button type="button" class="loop-btn tone-${l.tone}${running ? '' : ' stopped'}" data-loop="${l.id}">
      <span class="loop-glyph" aria-hidden="true">${l.kind === 'balancing' ? '⇌' : '↻'}</span>
      <span class="loop-name">${esc(l.label)}</span>
      <span class="loop-meta">${this.loopPlanes(l).map((p) => this.planeChip(p)).join('')}${running ? '' : '<span class="muted small">not running</span>'}</span></button></li>`
  }
  gateName(key: string) {
    const [a, b] = key.split('|') as PlaneId[]
    return `${this.plane(a).short}–${this.plane(b).short}`
  }
  crumbs() {
    const parts: string[] = [`<button type="button" class="crumb" data-outside>Outside</button>`]
    const fp = this.focusPlane()
    const m = this.mode
    if (m.kind === 'gate') parts.push(`<span class="crumb-cur">${esc(cap(this.model.gateWord))}</span>`)
    else if (m.kind === 'loop') parts.push(`<span class="crumb-cur">Cycle</span>`)
    else if (m.kind === 'flow') parts.push(`<span class="crumb-cur">Arrow</span>`)
    else if (fp !== 'outside') {
      parts.push(
        m.kind === 'plane'
          ? `<span class="crumb-cur">${esc(this.plane(fp).label)}</span>`
          : `<button type="button" class="crumb" data-plane-go="${fp}">${esc(this.plane(fp).label)}</button>`,
      )
      if (m.kind === 'node') parts.push(`<span class="crumb-cur">${esc(label(m.node))}</span>`)
    }
    return `<nav class="crumbs" aria-label="Where you are">${parts.join('<span class="sep">›</span>')}</nav>`
  }
  trailHtml() {
    if (this.trail.length < 2) return ''
    const items = this.trail
      .slice(-8)
      .map((t, i, arr) => `<button type="button" class="trail-step${i === arr.length - 1 ? ' cur' : ''}" data-node="${t.node}">${esc(label(t.node))}</button>`)
      .join('<span class="trail-arrow">→</span>')
    return `<div class="trail-box"><div class="eyebrow">Your path</div><div class="trail-row">${items}</div>
      <button type="button" class="linklike small" data-clear-trail>Clear path</button></div>`
  }
  renderPanel() {
    const m = this.mode
    const body =
      m.kind === 'outside'
        ? this.outsidePanel()
        : m.kind === 'plane'
          ? this.planePanel(m.plane)
          : m.kind === 'node'
            ? this.nodePanel(m.node)
            : m.kind === 'gate'
              ? this.gatePanel(m.gate)
              : m.kind === 'flow'
                ? this.flowPanel(m.flow)
                : this.loopPanel(m.loop, m.step)
    return this.crumbs() + body + this.trailHtml()
  }
  decisionsHtml() {
    return LEVER_ORDER.map((id) => {
      const home = this.model.leverHome[id]
      const where =
        'gate' in home
          ? `<button type="button" class="linklike small" data-gate-go="${home.gate}">at the ${esc(this.gateName(home.gate))} ${esc(this.model.gateWord)}</button>`
          : `<button type="button" class="linklike small" data-node="${home.node}">at ${esc(label(home.node))}</button>`
      return `<li class="decision-row">${this.switchHtml(id, true)}<span class="where">${where}</span></li>`
    }).join('')
  }
  outsidePanel() {
    const planes = this.model.planes
      .map(
        (p) => `<li><button type="button" class="plane-row pr-${p.id}" data-plane-go="${p.id}"><span class="pr-swatch" aria-hidden="true"></span>
        <span><strong>${esc(p.label)}</strong><span class="muted small block">${esc(p.blurb)}</span></span></button></li>`,
      )
      .join('')
    return `<h2 class="title">The system, from outside</h2>
      <p class="lede">Each plane holds its own boxes, arrows and cycles. Where two planes meet they share impact: every arrow from one to the other passes through that ${esc(this.model.gateWord)}, and that is where the big decisions sit.</p>
      <ul class="plane-list">${planes}</ul>
      <h3>Decisions</h3>
      <p class="muted small">Seven on/off decisions. Today every one is off. Flip any of them and watch the change spread from box to box.</p>
      <ul class="decision-list">${this.decisionsHtml()}</ul>
      <h3>Cycles traced: ${this.traced.size} of ${data.loops.length}</h3>
      ${
        this.traced.size
          ? `<ul class="loop-list">${data.loops.filter((l) => this.traced.has(l.id)).map((l) => this.loopItem(l)).join('')}</ul>`
          : '<p class="muted small">Follow arrows until your path comes back to a box you have visited: that closes a cycle.</p>'
      }
      <button type="button" class="pill solid" data-restart>Choose a starting point</button>`
  }
  planePanel(id: PlaneId) {
    const p = this.plane(id)
    const boxes = data.nodes
      .filter((n) => this.model.planeOf(n.id) === id && this.view.nodes.has(n.id))
      .map((n) => `<button type="button" class="box-chip" data-node="${n.id}">${esc(n.label)}</button>`)
      .join('')
    const loops = data.loops.filter((l) => this.loopPlanes(l).includes(id))
    const inside = loops.filter((l) => this.loopPlanes(l).length === 1)
    const across = loops.filter((l) => this.loopPlanes(l).length > 1)
    const gates = this.model.gates
      .filter((g) => g.a === id || g.b === id)
      .map((g) => {
        const other = g.a === id ? g.b : g.a
        const n = data.flows.filter((f) => this.gateOf(f) === g.key && this.view.flows.has(f.id)).length
        return `<li><button type="button" class="gate-row" data-gate-go="${g.key}"><span class="gate-dot" aria-hidden="true">✦</span> Meets ${esc(this.plane(other).label)} <span class="muted small">${n} active ${n === 1 ? 'arrow' : 'arrows'}</span></button></li>`
      })
      .join('')
    return `<div class="eyebrow">Plane</div><h2 class="title">${esc(p.label)}</h2><p class="lede">${esc(p.blurb)}</p>
      <h3>Step onto a box</h3><div class="box-chips">${boxes}</div>
      ${inside.length ? `<h3>Cycles inside this plane</h3><ul class="loop-list">${inside.map((l) => this.loopItem(l)).join('')}</ul>` : ''}
      ${across.length ? `<h3>Cycles that cross into other planes</h3><ul class="loop-list">${across.map((l) => this.loopItem(l)).join('')}</ul>` : ''}
      ${gates ? `<h3>${esc(cap(this.model.gateWord))}s</h3><ul class="gate-list">${gates}</ul>` : ''}`
  }
  routeHtml(f: Flow, closed: boolean) {
    const A = this.model.planeOf(f.from)
    const B = this.model.planeOf(f.to)
    const cross = A !== B ? `<span class="cross">crosses into ${this.planeChip(B)}</span>` : ''
    if (closed) {
      const levers = Object.keys(f.when ?? {}) as LeverId[]
      const flip = levers.filter((l) => this.cfg[l] !== (f.when![l] === 'right'))
      return `<li class="route closed"><div class="route-line"><span class="route-label">${esc(f.label)}</span> <span class="muted">→ ${esc(label(f.to))}</span> ${cross}</div>
        <div class="route-why muted small">Closed in this world. Opens if you switch:</div>${flip.map((l) => this.switchHtml(l, true)).join('')}</li>`
    }
    return `<li class="route"><button type="button" class="route-btn" data-go-flow="${f.id}">
      <span class="kind k-${f.kind}" aria-hidden="true"></span>
      <span class="route-line"><span class="route-label">${esc(f.label)}</span> <span class="route-to">→ ${esc(label(f.to))}</span></span>${cross}${f.external ? outsideBadge(f.sources) : ''}</button></li>`
  }
  nodeDescription(id: string) {
    const n = nodeById.get(id)!
    const s = n.descLever ? (this.cfg[n.descLever] ? 'alt' : 'today') : presetOf(this.cfg)?.id === 'alt' ? 'alt' : 'today'
    return n.byState?.[s] ?? n.description
  }
  nodeRoutes(id: string) {
    const out = data.flows.filter((f) => f.from === id)
    return {
      open: out.filter((f) => this.view.flows.has(f.id)),
      closed: out.filter((f) => !this.view.flows.has(f.id) && f.when),
      incoming: data.flows.filter((f) => f.to === id && this.view.flows.has(f.id)),
    }
  }
  nodeLoops(id: string) {
    const loops = data.loops.filter((l) => l.path.some((fid) => flowById.get(fid)!.from === id))
    return loops.sort((a, b) => Number(this.view.loops.has(b.id)) - Number(this.view.loops.has(a.id)))
  }
  nodeDecisions(id: string) {
    return LEVER_ORDER.filter((l) => {
      const h = this.model.leverHome[l]
      return 'node' in h && h.node === id
    })
  }
  nodePanel(id: string) {
    const n = nodeById.get(id)!
    const plane = this.model.planeOf(id)
    const { open, closed, incoming } = this.nodeRoutes(id)
    const loops = this.nodeLoops(id)
    const decisions = this.nodeDecisions(id)
    return `<div class="eyebrow">${this.planeChip(plane, true)}</div>
      <h2 class="title">${esc(n.label)}</h2>
      ${outsideNote('box', n)}
      ${this.view.nodes.has(id) ? '' : '<p class="note">This box does not exist in the world the switches describe. You can still read it, and follow arrows that remain.</p>'}
      ${this.statusHtml(id)}
      <p class="desc">${esc(this.nodeDescription(id))}</p>
      ${n.examples?.length ? `<ul class="examples">${n.examples.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}${links(n.sources)}
      ${decisions.length ? `<div class="decision-card"><div class="eyebrow">Decision here</div>${decisions.map((l) => this.switchHtml(l)).join('')}</div>` : ''}
      ${
        this.quiz
          ? '<p class="note">Make your guess in the story first: where this box’s arrows lead stays hidden until you answer.</p>'
          : `<h3>Follow an arrow</h3>
      ${open.length ? `<ul class="routes">${open.map((f) => this.routeHtml(f, false)).join('')}</ul>` : '<p class="muted small">No arrows leave this box in this world.</p>'}
      ${closed.length ? `<details class="closed-routes"><summary>${closed.length} closed ${closed.length === 1 ? 'route' : 'routes'}</summary><ul class="routes">${closed.map((f) => this.routeHtml(f, true)).join('')}</ul></details>` : ''}
      ${loops.length ? `<h3>Cycles through here</h3><ul class="loop-list">${loops.map((l) => this.loopItem(l)).join('')}</ul>` : ''}`
      }
      ${
        incoming.length && !this.quiz
          ? `<details class="incoming"><summary>Arrows arriving here (${incoming.length})</summary><ul class="routes">${incoming
              .map((f) => `<li class="route"><button type="button" class="route-btn back" data-node="${f.from}"><span class="route-line"><span class="route-to">${esc(label(f.from))} →</span> <span class="route-label">${esc(f.label)}</span></span></button></li>`)
              .join('')}</ul></details>`
          : ''
      }`
  }
  flowPanel(id: string) {
    const f = flowById.get(id)!
    const A = this.model.planeOf(f.from)
    const B = this.model.planeOf(f.to)
    const g = this.gateOf(f)
    const active = this.view.flows.has(id)
    const loops = data.loops.filter((l) => l.path.includes(id))
    const flip = (Object.keys(f.when ?? {}) as LeverId[]).filter((l) => this.cfg[l] !== (f.when![l] === 'right'))
    const toLv = this.levels.get(f.to)
    return `<div class="eyebrow">Arrow · ${this.planeChip(A, true)}${A !== B ? ` → ${this.planeChip(B, true)}` : ''}</div>
      <h2 class="title">${esc(f.label)}</h2>
      <div class="arrow-ends"><button type="button" class="box-chip" data-node="${f.from}">${esc(label(f.from))}</button><span class="arrow-glyph" aria-hidden="true">⟶</span><button type="button" class="box-chip" data-node="${f.to}">${esc(label(f.to))}</button></div>
      ${g ? `<p class="muted small">Crosses the ${esc(this.gateName(g))} ${esc(this.model.gateWord)}.</p>` : ''}
      ${active ? '' : `<div class="note">Closed in this world. It opens if you switch:${flip.map((l) => this.switchHtml(l, true)).join('')}</div>`}
      ${outsideNote('arrow', f)}
      <p class="desc">${esc(f.description)}</p>${links(f.sources)}
      ${f.figures?.length ? `<h3>Figures</h3>${figuresHtml(f.figures)}` : ''}
      ${f.blocked ? '<p class="note">This arrow is blocked: it shows a route that never arrives.</p>' : active ? `<button type="button" class="pill solid follow" data-go-flow="${id}" data-from-gate>Follow this arrow → ${esc(label(f.to))}</button>` : ''}
      ${toLv !== undefined ? `<h3>Where it lands</h3>${this.statusHtml(f.to)}` : ''}
      ${loops.length ? `<h3>Cycles this arrow is part of</h3><ul class="loop-list">${loops.map((l) => this.loopItem(l)).join('')}</ul>` : ''}`
  }
  gatePanel(key: string) {
    const [a, b] = key.split('|') as PlaneId[]
    const A = this.plane(a)
    const B = this.plane(b)
    const flows = data.flows.filter((f) => this.gateOf(f) === key)
    const side = (from: PlaneId) => {
      const fs = flows.filter((f) => this.model.planeOf(f.from) === from)
      const open = fs.filter((f) => this.view.flows.has(f.id))
      const closed = fs.filter((f) => !this.view.flows.has(f.id))
      return `${
        open.length
          ? `<ul class="routes">${open
              .map((f) => `<li class="route"><button type="button" class="route-btn" data-go-flow="${f.id}" data-from-gate><span class="kind k-${f.kind}" aria-hidden="true"></span><span class="route-line"><span class="route-to">${esc(label(f.from))}</span> <span class="route-label">${esc(f.label)}</span> <span class="route-to">→ ${esc(label(f.to))}</span></span></button></li>`)
              .join('')}</ul>`
          : '<p class="muted small">Nothing passes this way in this world.</p>'
      }
        ${closed.length ? `<p class="muted small">${closed.length} more open in another world.</p>` : ''}`
    }
    const levers = [...new Set(flows.flatMap((f) => Object.keys(f.when ?? {}) as LeverId[]))]
    const home = LEVER_ORDER.filter((l) => {
      const h = this.model.leverHome[l]
      return 'gate' in h && h.gate === key
    })
    const others = levers.filter((l) => !home.includes(l))
    return `<div class="eyebrow">${esc(cap(this.model.gateWord))}</div>
      <h2 class="title">${esc(A.short)} <span class="amp">⇄</span> ${esc(B.short)}</h2>
      <p class="lede">Where ${esc(A.label)} meets ${esc(B.label)}. Every arrow between the two passes through here, so this is where one plane’s problems become the other’s.</p>
      ${home.length || others.length ? `<div class="decision-card"><div class="eyebrow">Decisions that open or close these routes</div>${home.map((l) => this.switchHtml(l)).join('')}${others.map((l) => this.switchHtml(l, true)).join('')}</div>` : ''}
      <h3>${esc(A.short)} → ${esc(B.short)}</h3>${side(a)}
      <h3>${esc(B.short)} → ${esc(A.short)}</h3>${side(b)}
      <div class="row-btns">${this.planeChip(a, true)}${this.planeChip(b, true)}</div>`
  }
  loopPanel(id: string, step: number) {
    const l = loopById.get(id)!
    const running = this.view.loops.has(id)
    const steps = l.path
      .map((fid, i) => {
        const f = flowById.get(fid)!
        const g = this.gateOf(f)
        const crossing = g ? `<span class="cross">via the ${esc(this.gateName(g))} ${esc(this.model.gateWord)}</span>` : ''
        return `<li class="${i === step ? 'cur' : ''}${this.view.flows.has(fid) ? '' : ' broken'}"><button type="button" class="step-btn" data-loop-step="${i}">
          <span class="step-from">${esc(label(f.from))}</span><span class="route-label">${esc(f.label)}</span><span class="step-to">→ ${esc(label(f.to))}</span>${crossing}</button></li>`
      })
      .join('')
    const f = flowById.get(l.path[step])!
    return `<div class="eyebrow"><span class="tone-badge tone-${l.tone}">${l.tone} · ${l.kind}</span></div>
      <h2 class="title">${esc(l.label)}</h2>
      ${running ? '' : '<p class="note">This cycle is not running in the world the switches describe: at least one of its arrows is closed.</p>'}
      <p class="desc">${esc(l.description)}</p>${links(l.sources)}
      ${WALKTHROUGHS[l.id] ? `<p class="walk-link"><a class="pill solid" href="./cycles/guess/?c=${WALKTHROUGHS[l.id]}">Walk me through this cycle →</a> <a class="pill" href="./cycles/scroll/?c=${WALKTHROUGHS[l.id]}">Read it as a story</a></p>` : ''}
      <div class="ride tone-${l.tone}">
        <div class="ride-ctrl"><button type="button" class="pill" data-loop-move="-1">← Back</button><span class="muted small">${step + 1} of ${l.path.length}</span><button type="button" class="pill solid" data-loop-move="1">Next →</button></div>
        <div class="ride-now"><strong>${esc(label(f.from))}</strong> ${esc(f.label)} <strong>${esc(label(f.to))}</strong></div>
        <p class="small">${esc(f.description)}</p>${links(f.sources)}
      </div>
      <ol class="steps">${steps}</ol>
      <div class="row-btns"><button type="button" class="pill" data-node="${f.to}">Get off at ${esc(label(f.to))}</button></div>`
  }

  // --- chrome -----------------------------------------------------------------------------------------
  renderChrome() {
    document.getElementById('themes')!.innerHTML = THEMES.filter((t) => this.themes.includes(t.id)).map(
      (t) => `<button type="button" class="seg-btn${t.id === this.theme ? ' on' : ''}" data-theme-go="${t.id}" title="${esc(t.note)}" aria-pressed="${t.id === this.theme}">${esc(t.label)}</button>`,
    ).join('')
    const p = presetOf(this.cfg)
    const pure = p && (p.id === 'today' || p.id === 'alt')
    document.getElementById('worlds')!.innerHTML =
      PRESETS.filter((x) => x.id === 'today' || x.id === 'alt')
        .map((x) => `<button type="button" class="seg-btn${p?.id === x.id ? ' on' : ''}" data-world="${x.id}" aria-pressed="${p?.id === x.id}">${esc(x.label)}</button>`)
        .join('') + (pure ? '' : `<span class="seg-note">${LEVER_ORDER.filter((l) => this.cfg[l]).length} of 7 switched</span>`)
    document.getElementById('motion')!.textContent = this.motion ? 'Motion on' : 'Motion off'
    const legend = document.getElementById('legend')
    if (legend)
      legend.innerHTML = `
      <span class="lg-item"><span class="lg-sw lv-m3"></span>vicious</span>
      <span class="lg-item"><span class="lg-sw lv-p0"></span>balanced</span>
      <span class="lg-item"><span class="lg-sw lv-p3"></span>virtuous</span>
      <span class="lg-item"><span class="lg-gate">✦</span>${esc(this.model.gateWord)}</span>
      ${data.meta.episodes.some((e) => e.outside) ? '<span class="lg-item"><span class="lg-dash"></span>outside voice</span>' : ''}`
    const out = document.getElementById('outside')
    if (out) out.hidden = this.mode.kind === 'outside'
  }
  renderStart() {
    const el = document.getElementById('start')
    if (!el) return
    const modes: [typeof this.startMode, string][] = [['cycles', 'Guided cycles'], ...(this.hasStories ? [['story', 'Guide me: a short story'] as [typeof this.startMode, string]] : []), ['explore', 'Let me explore']]
    const cycles = this.startMode === 'cycles'
    const lede = cycles
      ? 'Pick a question. We’ll take you round one cycle of cause and effect, step by step: you guess what happens next, then see what Hickel says, with a link to the moment he says it.'
      : 'Pick a question. You’ll land on one part of the system and can follow its arrows as far as you like, cross into other regions where they meet, or ride a cycle all the way round.'
    el.innerHTML = `<div class="start-card">
      <div class="eyebrow">Step into the system</div>
      <h1>Where do you want to begin?</h1>
      <p class="lede">${lede}</p>
      <div class="seg guide-seg" role="group" aria-label="How to start">${modes
        .map(([m, label]) => `<button type="button" class="seg-btn${this.startMode === m ? ' on' : ''}" data-start-mode="${m}" aria-pressed="${this.startMode === m}">${label}</button>`)
        .join('')}</div>
      <div class="entries">${
        cycles
          ? CYCLE_CARDS.map((c) => `<a class="entry" href="./cycles/guess/?c=${c.slug}"><span class="entry-q">${esc(c.question)}</span><span class="entry-h entry-h-cycle"><span>${esc(c.title)}</span><span class="entry-alt" data-href="./cycles/scroll/?c=${c.slug}">or read it as a story</span></span></a>`).join('')
          : ENTRIES.map(
              (e) => `<button type="button" class="entry" data-entry="${e.id}"><span class="entry-q">${esc(e.question)}</span><span class="entry-h">${esc(e.hint)}${e.node ? ` · ${this.planeChip(this.model.planeOf(e.node))}` : ''}</span></button>`,
            ).join('')
      }</div>
      ${cycles ? '<p class="entry-more"><a href="./cycles/">See all guided cycles</a></p>' : ''}</div>`
    el.hidden = false
  }
  hideStart() {
    this.started = true
    const el = document.getElementById('start')
    if (el) el.hidden = true
  }

  // --- events -------------------------------------------------------------------------------------------
  bindEvents() {
    document.addEventListener('click', (e) => {
      const t = e.target as Element
      const q = (sel: string) => t.closest<HTMLElement | SVGElement>(sel)
      let el: HTMLElement | SVGElement | null
      if ((el = q('[data-theme-go]'))) return this.setTheme(el.dataset.themeGo as ThemeId)
      if ((el = q('[data-world]'))) return this.setWorld(configFor(el.dataset.world as 'today' | 'alt'))
      if ((el = q('[data-lever]'))) {
        const id = el.dataset.lever as LeverId
        return this.setLever(id, !this.cfg[id])
      }
      if ((el = q('[data-entry]'))) {
        const entry = ENTRIES.find((x) => x.id === el!.dataset.entry)!
        if (this.startMode === 'story' && this.onEntry?.(entry.id)) return
        this.trail = []
        return entry.node ? this.go({ kind: 'node', node: entry.node }) : this.go({ kind: 'outside' })
      }
      if ((el = q('[data-restart]'))) return this.renderStart()
      if ((el = q('[data-start-mode]'))) {
        this.startMode = el.dataset.startMode as typeof this.startMode
        return this.renderStart()
      }
      if ((el = q('.entry-alt'))) {
        e.preventDefault()
        location.href = el.dataset.href!
        return
      }
      if ((el = q('[data-toast-close]'))) return this.hideToast()
      if ((el = q('[data-flow-go]'))) return this.go({ kind: 'flow', flow: el.dataset.flowGo! })
      if ((el = q('[data-outside]')) || (el = q('#outside'))) return this.go({ kind: 'outside' })
      if ((el = q('[data-go-flow]'))) {
        const f = flowById.get(el.dataset.goFlow!)!
        if (el.hasAttribute('data-from-gate') && this.trail[this.trail.length - 1]?.node !== f.from) this.trail.push({ node: f.from })
        return this.go({ kind: 'node', node: f.to }, { via: f.id })
      }
      const m = this.mode
      if ((el = q('[data-loop-step]'))) return m.kind === 'loop' && this.go({ ...m, step: Number(el.dataset.loopStep) })
      if ((el = q('[data-loop-move]'))) {
        if (m.kind !== 'loop') return
        const n = loopById.get(m.loop)!.path.length
        return this.go({ ...m, step: (m.step + Number(el.dataset.loopMove) + n) % n })
      }
      if ((el = q('[data-loop]'))) return this.go({ kind: 'loop', loop: el.dataset.loop!, step: 0 })
      if ((el = q('[data-gate-go]'))) return this.go({ kind: 'gate', gate: el.dataset.gateGo! })
      if ((el = q('[data-clear-trail]'))) {
        this.trail = m.kind === 'node' ? [{ node: m.node }] : []
        return this.update()
      }
      if ((el = q('#motion'))) {
        this.motion = !this.motion
        try {
          localStorage.setItem('proto-motion', this.motion ? 'on' : 'off')
        } catch {
          /* ignore */
        }
        return this.update()
      }
      if ((el = q('[data-node]'))) {
        // clicking a box you can reach from here counts as following that arrow
        const id = el.dataset.node!
        const from = m.kind === 'node' ? m.node : null
        const via = from ? data.flows.find((f) => f.from === from && f.to === id && this.view.flows.has(f.id)) : undefined
        return this.go({ kind: 'node', node: id }, { via: via?.id })
      }
      if ((el = q('[data-plane-go]'))) return this.go({ kind: 'plane', plane: el.dataset.planeGo as PlaneId })
      if (q('[data-bg]')) return this.started ? this.go({ kind: 'outside' }) : undefined
    })
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') return this.go({ kind: 'outside' })
      const el = (e.target as Element).closest?.('svg [tabindex]') as SVGElement | null
      if (el && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault()
        el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      }
      const m = this.mode
      if (m.kind === 'loop' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        const n = loopById.get(m.loop)!.path.length
        this.go({ ...m, step: (m.step + (e.key === 'ArrowRight' ? 1 : -1) + n) % n })
      }
    })
    // hovering a route in the panel lights its arrow on the map
    this.panel.addEventListener('mouseover', (e) => {
      const el = (e.target as Element).closest<HTMLElement>('[data-go-flow]')
      const id = el?.dataset.goFlow ?? null
      if (id !== this.hotFlow) {
        this.hotFlow = id
        this.map.update(this)
      }
    })
  }
}

export type Closure = { at: number; from: number; flows: string[]; loop: Loop | null }
export function levelWord(id: string, lv: number) {
  const n = nodeById.get(id)!
  if (!n.condition || lv === 0) return 'balanced'
  const w = lv < 0 ? n.condition.vicious : n.condition.virtuous
  return Math.abs(lv) === 1 ? `leaning ${w}` : Math.abs(lv) === 3 ? `${w} (strongly)` : w
}
export function closureHtml(c: Closure) {
  if (!c.loop)
    return `<div class="eyebrow">↻ You closed a cycle</div><p class="small">Your path came back to ${esc(label(flowById.get(c.flows[c.flows.length - 1])!.to))}. It is not one of the 22 loops we drew, but every step is a sourced arrow.</p>`
  return `<div class="eyebrow tone-text-${c.loop.tone}">↻ Cycle traced · ${c.loop.tone} · ${c.loop.kind}</div>
    <div class="rp-title">${esc(c.loop.label)}</div><p class="small">${esc(c.loop.description)}</p>
    <button type="button" class="pill solid" data-loop="${c.loop.id}">Watch it turn</button>`
}
export const lvClass = (lv: number) => `lv-${lv < 0 ? 'm' : 'p'}${Math.abs(lv)}`
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// --- helpers for SVG maps ------------------------------------------------------------------------------
export type Pt = { x: number; y: number }
export type Box = [number, number, number, number]
export const NS = 'http://www.w3.org/2000/svg'
export const f1 = (n: number) => n.toFixed(1)
export const P = (p: Pt) => `${f1(p.x)},${f1(p.y)}`
export const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y })
export const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y })
export const mul = (a: Pt, k: number): Pt => ({ x: a.x * k, y: a.y * k })
export const len = (a: Pt) => Math.hypot(a.x, a.y)
export const norm = (a: Pt): Pt => mul(a, 1 / (len(a) || 1))
export const lerp = (a: Pt, b: Pt, t: number) => add(a, mul(sub(b, a), t))
export const rad = (deg: number) => (deg * Math.PI) / 180
export const dir = (deg: number): Pt => ({ x: Math.cos(rad(deg)), y: Math.sin(rad(deg)) })
export const angle = (v: Pt) => (Math.atan2(v.y, v.x) * 180) / Math.PI
export const wrap = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180
export const seeded = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646

/** A viewBox camera with eased flights; sets --k (user units per screen pixel) for constant-size text. */
export class Camera {
  box: Box
  private anim = 0
  private svg: SVGSVGElement
  private onFrame?: () => void
  constructor(svg: SVGSVGElement, start: Box, onFrame?: () => void) {
    this.svg = svg
    this.onFrame = onFrame
    this.box = [...start]
    svg.setAttribute('viewBox', this.box.join(' '))
  }
  scale() {
    const px = this.svg.getBoundingClientRect()
    const k = Math.max(this.box[2] / Math.max(px.width, 1), this.box[3] / Math.max(px.height, 1))
    this.svg.style.setProperty('--k', k.toFixed(4))
    return k
  }
  /** --k for a given box, without moving there. */
  kFor(b: Box) {
    const px = this.svg.getBoundingClientRect()
    return Math.max(b[2] / Math.max(px.width, 1), b[3] / Math.max(px.height, 1))
  }
  fly(target: Box, motion: boolean, then?: () => void, ms = 850) {
    cancelAnimationFrame(this.anim)
    const from = [...this.box] as Box
    const t0 = performance.now()
    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
    const step = (now: number) => {
      const t = motion ? Math.min(1, (now - t0) / ms) : 1
      const e = ease(t)
      this.box = from.map((v, i) => v + (target[i] - v) * e) as Box
      this.svg.setAttribute('viewBox', this.box.map((v) => v.toFixed(2)).join(' '))
      this.scale()
      this.onFrame?.()
      if (t < 1) this.anim = requestAnimationFrame(step)
      else then?.()
    }
    this.anim = requestAnimationFrame(step)
  }
}
export function fitBox(points: Pt[], pad = 70, min = 340): Box {
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  let x0 = Math.min(...xs) - pad
  let y0 = Math.min(...ys) - pad
  let w = Math.max(...xs) + pad - x0
  let h = Math.max(...ys) + pad - y0
  const s = Math.max(w, h, min)
  x0 -= (s - w) / 2
  y0 -= (s - h) / 2
  w = h = s
  return [x0, y0, w, h]
}

/** Dots that travel along arrows. Paths are looked up by flow id each frame, so they may change shape. */
export class Particles {
  private items: { el: SVGCircleElement; id: string; t: number; speed: number }[] = []
  private last = 0
  private layer: SVGGElement
  private pathOf: (id: string) => SVGPathElement | undefined
  constructor(layer: SVGGElement, pathOf: (id: string) => SVGPathElement | undefined) {
    this.layer = layer
    this.pathOf = pathOf
    const tick = (now: number) => {
      if (!this.layer.isConnected) return
      const dt = Math.min(0.05, (now - (this.last || now)) / 1000)
      this.last = now
      for (const p of this.items) {
        const path = this.pathOf(p.id)
        if (!path) continue
        const L = path.getTotalLength() || 1
        p.t = (p.t + (dt * p.speed) / L) % 1
        const at = path.getPointAtLength(p.t * L)
        p.el.setAttribute('cx', f1(at.x))
        p.el.setAttribute('cy', f1(at.y))
        p.el.style.opacity = String(Math.min(1, Math.sin(p.t * Math.PI) * 2.2))
      }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }
  set(specs: { id: string; n: number; cls: string; r: number }[], speed = 70) {
    this.layer.innerHTML = ''
    this.items = []
    for (const s of specs)
      for (let i = 0; i < s.n; i++) {
        const el = document.createElementNS(NS, 'circle')
        el.setAttribute('class', s.cls)
        el.setAttribute('r', String(s.r))
        this.layer.appendChild(el)
        this.items.push({ el, id: s.id, t: (i / s.n + Math.random() * 0.2) % 1, speed: speed + Math.random() * 20 })
      }
  }
}

/** Standard particle choice: the cycle being ridden, else the routes on offer, else everything near the focus. */
export function particleSpecs(app: App, em: Emphasis, near: (f: Flow) => boolean) {
  if (!app.motion) return []
  const m = app.mode
  let ids: string[]
  if (m.kind === 'loop') ids = [...em.loopFlows]
  else if (em.opt.size) ids = [...em.opt, ...em.trailFlows]
  else ids = data.flows.filter((f) => app.view.flows.has(f.id) && near(f)).map((f) => f.id)
  return ids.map((id) => {
    const f = flowById.get(id)!
    const big = m.kind === 'loop' || em.opt.has(id)
    const cls = m.kind === 'loop' ? `pt tone-${em.tone}` : em.opt.has(id) ? 'pt hi' : `pt k-${f.kind}`
    return { id, n: big ? 3 : (f.weight ?? 1) > 1 ? 2 : 1, cls, r: big ? 2.6 : 1.7 }
  })
}

/** Arrow markers shared by the SVG maps. */
export function markerDefs() {
  const marker = (id: string, fill: string, size = 7) =>
    `<marker id="${id}" viewBox="0 0 10 10" refX="17" refY="5" markerWidth="${size}" markerHeight="${size}" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${fill}"/></marker>`
  return `${marker('arr', 'var(--flow-strong)')}${marker('arr-ghost', 'var(--flow-ghost)', 5)}${marker('arr-hi', 'var(--accent)', 10)}${marker('arr-vic', 'var(--c-m3)', 10)}${marker('arr-vir', 'var(--c-p3)', 10)}${marker('arr-trail', 'var(--trail)', 8)}`
}
export function markerFor(app: App, em: Emphasis, id: string) {
  if (!app.view.flows.has(id)) return 'arr-ghost'
  if (em.loopFlows.has(id)) return em.tone === 'virtuous' ? 'arr-vir' : 'arr-vic'
  if (em.opt.has(id) || app.hotFlow === id) return 'arr-hi'
  if (em.trailFlows.has(id)) return 'arr-trail'
  return 'arr'
}
/** Class list for an arrow from the shared emphasis rules. */
export function flowClasses(app: App, em: Emphasis, f: Flow, near: boolean) {
  const cls = ['flow', `k-${f.kind}`]
  if (f.external) cls.push('external')
  if (f.blocked) cls.push('blocked')
  if (!app.view.flows.has(f.id)) cls.push('off')
  if (em.loopFlows.has(f.id)) cls.push('loop', `tone-${em.tone}`)
  if (em.step === f.id) cls.push('step')
  if (em.opt.has(f.id)) cls.push('opt')
  if (em.inc.has(f.id)) cls.push('inc')
  if (em.trailFlows.has(f.id)) cls.push('trail')
  if (app.hotFlow === f.id) cls.push('hot')
  if (near) cls.push('near')
  return cls.join(' ')
}
/** Boxes to label and light: the current box, the path, the targets on offer, the cycle's boxes. */
export function litNodes(app: App, em: Emphasis) {
  const lit = new Set<string>()
  if (app.mode.kind === 'node') lit.add(app.mode.node)
  for (const t of app.trail) lit.add(t.node)
  for (const id of em.opt) lit.add(flowById.get(id)!.to)
  for (const id of em.loopFlows) lit.add(flowById.get(id)!.from)
  if (app.hotFlow) lit.add(flowById.get(app.hotFlow)!.to)
  if (app.mode.kind === 'flow') {
    const f = flowById.get(app.mode.flow)!
    lit.add(f.from).add(f.to)
  }
  return lit
}
export function stationClasses(app: App, id: string, lit: Set<string>) {
  const lv = app.levels.get(id)
  const cls = ['station', lv === undefined ? 'nocond' : lvClass(lv)]
  if (!app.view.nodes.has(id)) cls.push('ghost')
  if (app.mode.kind === 'node' && app.mode.node === id) cls.push('here')
  if (lit.has(id)) cls.push('lit')
  if (nodeById.get(id)?.external) cls.push('external')
  return cls.join(' ')
}
/** Text labels for the arrows in focus, placed along each path at `at` (0–1). */
export function renderFlowLabels(app: App, em: Emphasis, layer: SVGGElement, pathOf: (id: string) => SVGPathElement | undefined, at: (f: Flow) => number = () => 0.5) {
  const show = new Set<string>([...em.opt, ...(em.step ? [em.step] : []), ...(app.hotFlow ? [app.hotFlow] : [])])
  if (app.mode.kind === 'loop') for (const id of em.loopFlows) show.add(id)
  layer.innerHTML = ''
  for (const id of show) {
    const el = pathOf(id)
    if (!el) continue
    const f = flowById.get(id)!
    const p = el.getPointAtLength(el.getTotalLength() * at(f))
    const t = document.createElementNS(NS, 'text')
    t.setAttribute('x', f1(p.x))
    t.setAttribute('y', f1(p.y))
    t.setAttribute('class', `flow-label${id === em.step || id === app.hotFlow ? ' strong' : ''}`)
    t.setAttribute('text-anchor', 'middle')
    t.setAttribute('dy', '-0.5em')
    t.textContent = `${f.blocked ? '✕ ' : ''}${f.label}`
    layer.appendChild(t)
  }
}
