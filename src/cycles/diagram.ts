// A cycle as a ring, one arc per step. When the loop crosses into the South, the North sits on the left half and
// the South on the right. Arcs draw themselves as the reader advances, a token travels the current arc, and the
// finished loop keeps circulating. The toggle view closes the arcs its switches close and draws the arrows that
// take their place (for a virtuous cycle, the toggle shows today instead).
import { closedByToggle, esc, flowLabel, label, nodeById, ringOf, virtuous, type CycleScript } from './model.ts'

const C = { x: 320, y: 320 }
const R = 214
const NODE_R = 30
const SAT_R = 24
const rad = (d: number) => (d * Math.PI) / 180
const at = (deg: number, r = R) => ({ x: C.x + r * Math.cos(rad(deg)), y: C.y + r * Math.sin(rad(deg)) })
const P = (p: { x: number; y: number }) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches
/** The signed shortest turn from angle a to angle b, in degrees. */
const turn = (a: number, b: number) => ((((b - a) % 360) + 540) % 360) - 180
export const KINDS = ['decision', 'money', 'force', 'labor', 'vote', 'ideology', 'resources', 'pollution']

/** Box labels sit inside the ring, split over two lines where they are long. */
function labelLines(s: string) {
  if (s.length < 14) return [s]
  const words = s.split(' ')
  let best = [s]
  let diff = Infinity
  for (let k = 1; k < words.length; k++) {
    const a = words.slice(0, k).join(' ')
    const b = words.slice(k).join(' ')
    if (Math.abs(a.length - b.length) < diff) {
      diff = Math.abs(a.length - b.length)
      best = [a, b]
    }
  }
  return best
}
/** Lines of a label, centred vertically on its anchor point. */
const tspans = (lines: string[], x: number) =>
  lines.map((l, k) => `<tspan x="${x.toFixed(1)}" dy="${k ? '1.15em' : `${(0.35 - (lines.length - 1) * 0.575).toFixed(2)}em`}">${esc(l)}</tspan>`).join('')

export class Cycle {
  readonly svg: SVGSVGElement
  private arcs: SVGPathElement[] = []
  private token: SVGGElement
  private center: SVGGElement
  private raf = 0
  private step = -1
  private readonly n: number
  private readonly ring: ReturnType<typeof ringOf>
  private readonly c: CycleScript

  /** Progressive: boxes and their arc paths stay hidden until the reader reaches them (for guessing). */
  constructor(host: HTMLElement, c: CycleScript, opts: { progressive?: boolean } = {}) {
    this.c = c
    const A = c.angles
    this.ring = ringOf(c)
    this.n = this.ring.length
    const n = this.n
    if (A.length !== n) throw new Error(`${c.slug}: ${n} boxes but ${A.length} angles`)
    const arcPath = (i: number) => {
      const gap = ((NODE_R + 7) / R) * (180 / Math.PI)
      const a = A[i] + gap
      let b = A[(i + 1) % n]
      while (b <= A[i]) b += 360
      b -= gap
      return { d: `M${P(at(a))} A${R},${R} 0 ${b - a > 180 ? 1 : 0} 1 ${P(at(b))}`, mid: (a + b) / 2 }
    }
    const arcs = c.steps
      .map((s, i) => {
        const { d, mid } = arcPath(i)
        const lp = at(mid, R + 30)
        const anchor = Math.cos(rad(mid)) > 0.25 ? 'start' : Math.cos(rad(mid)) < -0.25 ? 'end' : 'middle'
        const x = at(mid)
        return `<g class="arc-g kind-${s.flow.kind}" data-i="${i}" data-flow="${s.flow.id}">
        <path class="arc-ghost" d="${d}"/>
        <path class="arc" d="${d}" pathLength="1" marker-end="url(#m-${s.flow.kind})"/>
        <text class="arc-label" x="${lp.x.toFixed(1)}" y="${lp.y.toFixed(1)}" text-anchor="${anchor}">${tspans(flowLabel(s.flow).includes(': ') ? flowLabel(s.flow).split(': ') : labelLines(flowLabel(s.flow)), lp.x)}</text>
        <g class="arc-x" transform="translate(${P(x)})"><circle r="11"/><path d="M-5,-5L5,5M5,-5L-5,5"/></g></g>`
      })
      .join('')
    const lit = new Set(c.end.lit ?? [])
    const nodes = this.ring
      .map((nd, i) => {
        const p = at(A[i])
        const lp = at(A[i], R - 62)
        return `<g class="node r-${nd.region}${lit.has(nd.id) ? ' lit' : ''}" data-i="${i}" data-node="${nd.id}">
        <circle class="node-halo" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${NODE_R + 9}"/>
        <circle class="node-dot" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${NODE_R}"/>
        <text class="node-num" x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}" dy="0.36em">${i + 1}</text>
        <text class="node-label" x="${lp.x.toFixed(1)}" y="${lp.y.toFixed(1)}">${tspans(labelLines(nd.label), lp.x)}</text></g>`
      })
      .join('')

    // the toggle view: boxes off the ring, and the arrows that open
    const sats = new Map((c.end.satellites ?? []).map((s) => [s.id, at(s.angle, s.r)]))
    const satHtml = [...sats]
      .map(([id, p]) => {
        const region = nodeById.get(id)?.region ?? 'north'
        return `<g class="sat r-${region}"><circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${SAT_R}"/>
          <text class="sat-label" x="${p.x.toFixed(1)}" y="${(p.y + SAT_R + 16).toFixed(1)}">${tspans(labelLines(label(id)), p.x)}</text></g>`
      })
      .join('')
    const ringIndex = (id: string) => this.ring.findIndex((nd) => nd.id === id)
    const pairCount = new Map<string, number>()
    const pairKey = (f: { from: string; to: string }) => [ringIndex(f.from), ringIndex(f.to)].sort().join('-')
    const pairTotal = new Map<string, number>()
    for (const f of c.end.opens) pairTotal.set(pairKey(f), (pairTotal.get(pairKey(f)) ?? 0) + 1)
    const opens = c.end.opens
      .map((f) => {
        const a = ringIndex(f.from)
        const b = ringIndex(f.to)
        let pa, pb, ctrl, anchor: string, dy: string
        if (a >= 0 && b >= 0) {
          // a chord bowing into the ring; a second chord between the same pair bows further in
          const key = pairKey(f)
          const k = pairCount.get(key) ?? 0
          pairCount.set(key, k + 1)
          const sgn = Math.sign(turn(A[a], A[b])) || 1
          const mid = A[a] + turn(A[a], A[b]) / 2
          pa = at(A[a] + 7 * sgn, R - NODE_R - 4)
          pb = at(A[b] - 7 * sgn, R - NODE_R - 10)
          ctrl = at(mid, R - (k ? 150 : 80))
          // labels sit beside a chord on the left or right of the ring, and above or below one near the top or bottom
          const cos = Math.cos(rad(mid))
          anchor = Math.abs(cos) < 0.6 ? 'middle' : cos > 0 ? 'end' : 'start'
          dy = k ? '1.4em' : pairTotal.get(key)! > 1 ? '-0.7em' : '1.3em'
        } else {
          // to or from a box off the ring
          const ringEnd = a >= 0 ? a : b
          const sat = sats.get(a >= 0 ? f.to : f.from)
          if (ringEnd < 0 || !sat) throw new Error(`${c.slug}: opened arrow ${f.id} needs a box on the ring and a satellite`)
          const rp = at(A[ringEnd], R - NODE_R - 6)
          const toward = (p: { x: number; y: number }, q: { x: number; y: number }, d: number) => {
            const L = Math.hypot(q.x - p.x, q.y - p.y)
            return { x: p.x + ((q.x - p.x) * d) / L, y: p.y + ((q.y - p.y) * d) / L }
          }
          const sp = toward(sat, rp, SAT_R + 8)
          ;[pa, pb] = a >= 0 ? [rp, sp] : [sp, rp]
          const m = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 }
          // bow slightly toward the centre
          ctrl = toward(m, C, 18)
          anchor = m.x > C.x ? 'end' : 'start'
          dy = '-0.6em'
        }
        const lp = { x: 0.25 * pa.x + 0.5 * ctrl.x + 0.25 * pb.x, y: 0.25 * pa.y + 0.5 * ctrl.y + 0.25 * pb.y }
        const dx = anchor === 'end' ? -10 : anchor === 'start' ? 10 : 0
        return `<g class="open-g kind-${f.kind}"><path class="open-arc" d="M${P(pa)} Q${P(ctrl)} ${P(pb)}" pathLength="1" marker-end="url(#m-open-${f.kind})"/>
          <text class="open-label" x="${(lp.x + dx).toFixed(1)}" y="${lp.y.toFixed(1)}" text-anchor="${anchor}" dy="${dy}">${esc(flowLabel(f))}</text></g>`
      })
      .join('')

    const regions = new Set(this.ring.map((nd) => nd.region))
    const split = regions.has('south')
    const backdrop = split
      ? `<rect class="half north-half" x="0" y="0" width="320" height="640" rx="24"/>
        <rect class="half south-half" x="320" y="0" width="320" height="640" rx="24"/>
        <line class="divider" x1="320" y1="40" x2="320" y2="600"/>
        <text class="side-label" x="300" y="34" text-anchor="end">GLOBAL NORTH</text>
        <text class="side-label south" x="340" y="34">GLOBAL SOUTH</text>`
      : `<rect class="half north-half" x="0" y="0" width="640" height="640" rx="24"/>
        <text class="side-label" x="320" y="34" text-anchor="middle">GLOBAL NORTH</text>`
    const marker = (id: string, cls: string) =>
      `<marker id="m-${id}" class="mk ${cls}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,1 L9,5 L0,9 z"/></marker>`
    host.insertAdjacentHTML(
      'beforeend',
      `<svg class="cycle${virtuous(c) ? ' tone-virtuous' : ''}" viewBox="-50 0 740 640" role="img" aria-label="${esc(c.title)}: ${this.ring.map((nd) => esc(nd.label)).join(', ')}, and back to the start">
        <defs>${KINDS.map((k) => marker(k, `kind-${k}`)).join('')}${KINDS.map((k) => marker(`open-${k}`, `open kind-${k}`)).join('')}</defs>
        ${backdrop}
        <circle class="ring-ghost" cx="${C.x}" cy="${C.y}" r="${R}"/>
        <g class="arcs">${arcs}</g>
        <g class="opens">${satHtml}${opens}</g>
        <g class="nodes">${nodes}</g>
        <g class="center"></g>
        <g class="token" style="opacity:0"><circle class="token-halo" r="13"/><circle class="token-dot" r="6"/></g>
      </svg>`,
    )
    this.svg = host.querySelector('svg.cycle')!
    this.svg.classList.toggle('progressive', !!opts.progressive)
    this.arcs = [...this.svg.querySelectorAll<SVGPathElement>('.arc')]
    this.token = this.svg.querySelector('.token')!
    this.center = this.svg.querySelector('.center')!
  }

  /** -1: nothing drawn yet; 0…n−1: arcs up to this one drawn, this one current; n: the whole loop running. */
  set(step: number) {
    const n = this.n
    const forward = step > this.step
    this.step = step
    cancelAnimationFrame(this.raf)
    this.svg.dataset.step = String(step)
    this.svg.querySelectorAll<SVGGElement>('.arc-g').forEach((g) => {
      const i = Number(g.dataset.i)
      g.classList.toggle('drawn', i <= step)
      g.classList.toggle('current', i === step)
    })
    this.svg.querySelectorAll<SVGGElement>('.node').forEach((g) => {
      const i = Number(g.dataset.i)
      const reached = step >= n || i <= step + 1 || (step === n - 1 && i === 0)
      g.classList.toggle('reached', step >= 0 && reached)
      g.classList.toggle('shown', reached)
      g.classList.toggle('here', step >= 0 && step < n && i === (step + 1) % n)
      g.classList.toggle('from', step >= 0 && step < n && i === step)
    })
    this.renderCenter()
    if (step >= 0 && step < n) this.travel(step, forward)
    else if (step === n) this.circulate()
    else this.token.style.opacity = '0'
  }

  /** A question about step i: the arcs before it drawn, its starting box lit, the centre asking. */
  ask(i: number) {
    this.set(i - 1)
    this.svg.querySelectorAll<SVGGElement>('.node').forEach((g) => {
      const k = Number(g.dataset.i)
      g.classList.toggle('here', k === i)
      g.classList.toggle('reached', k <= i)
      g.classList.toggle('shown', k <= i)
      g.classList.remove('from')
    })
    this.svg.querySelectorAll<SVGGElement>('.arc-g').forEach((g) => g.classList.remove('current'))
    this.token.style.opacity = '0'
    this.center.innerHTML = `<text class="center-big" x="${C.x}" y="${C.y - 6}">?</text><text class="center-small" x="${C.x}" y="${C.y + 34}">what happens next?</text>`
  }

  /** Cross out some of the loop's arcs (for the switch challenge), without opening anything. */
  setClosed(ids: string[]) {
    this.svg.querySelectorAll<SVGGElement>('.arc-g').forEach((g) => g.classList.toggle('closed', ids.includes(g.dataset.flow!)))
    if (ids.length) {
      cancelAnimationFrame(this.raf)
      this.token.style.opacity = '0'
    } else if (this.step === this.n) this.circulate()
  }

  /** The toggle: close the arcs its switches close, and draw the arrows that take their place. */
  setBroken(on: boolean) {
    const closes = closedByToggle(this.c)
    this.svg.classList.toggle('broken', on)
    this.svg.querySelectorAll<SVGGElement>('.arc-g').forEach((g) => g.classList.toggle('closed', on && closes.includes(g.dataset.flow!)))
    const [dx, dy] = this.c.end.centerShift ?? [0, 0]
    this.center.style.transform = on ? `translate(${dx}px, ${dy}px)` : ''
    this.renderCenter()
    if (on) {
      cancelAnimationFrame(this.raf)
      this.token.style.opacity = '0'
    } else if (this.step === this.n) this.circulate()
  }

  /** Mark one box, e.g. the one a guess points at. A right answer reveals its box; a wrong one never uncovers a hidden box. */
  mark(nodeId: string | null, kind: 'right' | 'wrong' | null = null) {
    this.svg.querySelectorAll<SVGGElement>('.node').forEach((g) => {
      const it = g.dataset.node === nodeId
      if (kind === 'right' && it) g.classList.add('shown')
      g.classList.toggle('mark-right', kind === 'right' && it)
      g.classList.toggle('mark-wrong', kind === 'wrong' && it && g.classList.contains('shown'))
    })
  }

  private renderCenter() {
    const s = this.step
    const n = this.n
    const broken = this.svg.classList.contains('broken')
    const [big, small] = broken
      ? ['⨯', this.c.end.stopped]
      : s < 0
        ? ['?', `${n} steps, one cycle`]
        : s >= n
          ? ['↻', this.c.short]
          : [String(s + 1), flowLabel(this.c.steps[s].flow)]
    this.center.innerHTML = `<text class="center-big" x="${C.x}" y="${C.y - 6}">${esc(big)}</text><text class="center-small" x="${C.x}" y="${C.y + 34}">${esc(small)}</text>`
  }

  private travel(i: number, forward: boolean) {
    const path = this.arcs[i]
    const len = path.getTotalLength()
    this.token.setAttribute('class', `token kind-${this.c.steps[i].flow.kind}`)
    this.token.style.opacity = '1'
    const end = path.getPointAtLength(len)
    if (reduced() || !forward) {
      this.token.setAttribute('transform', `translate(${P(end)})`)
      return
    }
    const t0 = performance.now()
    const ms = 1500
    const frame = (now: number) => {
      const t = Math.min(1, Math.max(0, now - t0) / ms)
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
      this.token.setAttribute('transform', `translate(${P(path.getPointAtLength(e * len))})`)
      if (t < 1) this.raf = requestAnimationFrame(frame)
    }
    this.raf = requestAnimationFrame(frame)
  }

  /** The finished loop: the token keeps going round, one arc after another. */
  private circulate() {
    this.token.style.opacity = '1'
    if (reduced()) return
    const lens = this.arcs.map((a) => a.getTotalLength())
    const t0 = performance.now()
    const per = 1100
    const frame = (now: number) => {
      const t = Math.max(0, now - t0) / per // the first frame's timestamp can precede t0
      const i = Math.floor(t) % this.n
      const f = t - Math.floor(t)
      this.token.setAttribute('class', `token kind-${this.c.steps[i].flow.kind}`)
      this.token.setAttribute('transform', `translate(${P(this.arcs[i].getPointAtLength(f * lens[i]))})`)
      this.raf = requestAnimationFrame(frame)
    }
    this.raf = requestAnimationFrame(frame)
  }
}

/** The legend: only the arrow kinds this cycle uses. */
export const legendHtml = (c: CycleScript) => {
  const used = new Set(c.steps.map((s) => s.flow.kind as string))
  return `<div class="kinds">${KINDS.filter((k) => used.has(k))
    .map((k) => `<span class="lg kind-${k}"><i></i>${k}</span>`)
    .join('')}</div>`
}

/** A small static ring for the gallery: boxes coloured by region, arcs by kind. */
export function miniRing(c: CycleScript) {
  const ring = ringOf(c)
  const n = ring.length
  const r = 38
  const pt = (d: number, rr = r) => ({ x: 50 + rr * Math.cos(rad(d)), y: 50 + rr * Math.sin(rad(d)) })
  const arcs = c.steps
    .map((s, i) => {
      const gap = 14
      const a = c.angles[i] + gap
      let b = c.angles[(i + 1) % n]
      while (b <= c.angles[i]) b += 360
      b -= gap
      return `<path class="kind-${s.flow.kind}" d="M${P(pt(a))} A${r},${r} 0 ${b - a > 180 ? 1 : 0} 1 ${P(pt(b))}"/>`
    })
    .join('')
  const dots = ring.map((nd, i) => `<circle class="r-${nd.region}" cx="${pt(c.angles[i]).x.toFixed(1)}" cy="${pt(c.angles[i]).y.toFixed(1)}" r="6"/>`).join('')
  return `<svg class="mini-ring" viewBox="0 0 100 100" aria-hidden="true"><g class="mini-arcs">${arcs}</g><g class="mini-dots">${dots}</g></svg>`
}
