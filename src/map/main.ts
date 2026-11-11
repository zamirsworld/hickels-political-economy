// The map, in the user's split: Global North, Global South and the
// Environment, each holding smaller rings of actors (capital, government, citizens, work; extraction, dump,
// nature). A fourth circle, Global institutions, sits in the middle. The circles don't touch: arrows between
// them run in lanes along a highway, one highway per pair of circles.
import '../shared/map.css'
import './style.css'
import {
  add, angle, App, Camera, data, dir, esc, f1, fitBox, flowById, flowClasses, label, LEVER_ORDER, leverById, lerp,
  litNodes, loopById, markerDefs, markerFor, mul, P, Particles, particleSpecs, rad, renderFlowLabels, seeded,
  stationClasses, sub, wrap,
  type Box, type Flow, type MapAdapter, type PlaneId, type Pt,
} from '../shared/core.ts'
import { StoryController } from '../shared/story.ts'
import {
  crossKey, ECO_LABEL, endGlyph, GATES, GEO, glyphNode, groupOf, GROUPS, model, pos, regionById,
  regionOf, REGIONS, ROUTE, type Gate, type Region,
} from './layout.ts'

// --- arrows: curves inside a ring, along a highway between rings ----------------------------------------------
// arrows on the same highway run in lanes side by side, one direction on each side: lane i of n, keyed "flow@gate"
const LANE = 3.4
const bundle = new Map<string, { i: number; n: number }>()
const lanesOn = new Map<string, number>()
const twin = new Map<string, number>()
{
  const by = new Map<string, string[]>()
  const pairs = new Map<string, number>()
  for (const f of data.flows) {
    for (const h of ROUTE.get(f.id)!) by.set(h.g.key, [...(by.get(h.g.key) ?? []), f.id])
    const pk = `${f.from}>${f.to}`
    twin.set(f.id, pairs.get(pk) ?? 0)
    pairs.set(pk, (pairs.get(pk) ?? 0) + 1)
  }
  for (const [k, ids] of by) {
    const forward = (id: string) => regionOf.get(flowById.get(id)!.from) === GATES.get(k)!.a
    const lanes = [...ids.filter(forward), ...ids.filter((id) => !forward(id))]
    lanes.forEach((id, i) => bundle.set(`${id}@${k}`, { i, n: ids.length }))
    lanesOn.set(k, ids.length)
  }
}
/** How wide each highway is drawn: room for all its lanes. */
const roadWidth = (g: Gate) => Math.max(14, (lanesOn.get(g.key) ?? 0) * LANE + 8)
function flowPath(f: Flow) {
  const ga = endGlyph(f, 'from')
  const gb = endGlyph(f, 'to')
  const a = pos(ga)
  const b = pos(gb)
  const hops = ROUTE.get(f.id)!
  const d = sub(b, a)
  const bow = 0.16 + 0.12 * (twin.get(f.id) ?? 0)
  if (!hops.length) {
    let ctrl = add(lerp(a, b, 0.5), mul({ x: -d.y, y: d.x }, bow))
    const ra = regionOf.get(f.from)
    if (groupOf.get(ga) !== groupOf.get(gb)) ctrl = lerp(ctrl, regionById.get(ra as Region)!.c, 0.35)
    return `M${P(a)} Q${P(ctrl)} ${P(b)}`
  }
  // curve onto the highway at one rim, run straight along its lane, curve off at the other rim
  const { g, n: nn } = hops[0]
  const { i, n } = bundle.get(`${f.id}@${g.key}`)!
  const lane = mul(g.t, (i - (n - 1) / 2) * LANE)
  const fwd = regionOf.get(f.from) === g.a
  const on = add(fwd ? g.pa : g.pb, lane)
  const off = add(fwd ? g.pb : g.pa, lane)
  const kk = (p: Pt, q: Pt) => Math.min(80, Math.hypot(q.x - p.x, q.y - p.y) * 0.45)
  return `M${P(a)} C${P(lerp(a, on, 0.35))} ${P(sub(on, mul(nn, kk(a, on))))} ${P(on)} L${P(off)} C${P(add(off, mul(nn, kk(off, b))))} ${P(lerp(b, off, 0.35))} ${P(b)}`
}
const flowPts = (f: Flow) => [pos(endGlyph(f, 'from')), pos(endGlyph(f, 'to')), ...ROUTE.get(f.id)!.flatMap((h) => [h.g.pa, h.g.pb])]

// --- shapes ---------------------------------------------------------------------------------------------------
const gateAnglesOf = (id: Region) =>
  [...GATES.values()].filter((g) => g.a === id || g.b === id).map((g) => angle(sub(g.p, regionById.get(id)!.c)))

function regionMarkup(theme: string, r: (typeof REGIONS)[number]) {
  const { c, r: rr, id } = r
  const C = `cx="${f1(c.x)}" cy="${f1(c.y)}" r="${f1(rr)}"`
  const open = `<g class="ring ring-${id}" data-plane-go="${id}" style="--rc: var(--p-${id})"><circle class="ring-hit" ${C}/>`
  if (theme === 'orrery') {
    const gates = gateAnglesOf(id)
    let ticks = ''
    for (let a = 0; a < 360; a += 3) {
      if (gates.some((g) => Math.abs(wrap(a - g)) < 7)) continue
      ticks += `M${P(add(c, mul(dir(a), rr + 3)))}L${P(add(c, mul(dir(a), rr + (a % 30 === 0 ? 10 : 5))))}`
    }
    return `${open}<circle class="orbit-inner" cx="${f1(c.x)}" cy="${f1(c.y)}" r="${f1(rr - 7)}"/><circle class="orbit region-orbit" ${C}/><path class="ticks" d="${ticks}"/></g>`
  }
  return `${open}<circle class="band-casing" ${C}/><circle class="band" ${C} style="stroke:var(--p-${id})"/></g>`
}
function regionTitle(r: (typeof REGIONS)[number]) {
  if (r.titleInside) {
    const tr = r.r - 14
    return `<path id="rt-${r.id}" d="M${P(add(r.c, mul(dir(-158), tr)))} A${f1(tr)},${f1(tr)} 0 0 1 ${P(add(r.c, mul(dir(-22), tr)))}" fill="none"/>
    <text class="plane-title region-title inner-title" style="--rc: var(--p-${r.id})"><textPath href="#rt-${r.id}" startOffset="50%" text-anchor="middle">${esc(r.label)}</textPath></text>`
  }
  const fs = 24
  const bottom = Math.sin(rad(r.titleAt)) > 0
  const tr = r.r + 22
  const [s, e] = bottom ? [r.titleAt + 30, r.titleAt - 30] : [r.titleAt - 30, r.titleAt + 30]
  const rr = bottom ? tr + fs * 0.72 : tr
  return `<path id="rt-${r.id}" d="M${P(add(r.c, mul(dir(s), rr)))} A${f1(rr)},${f1(rr)} 0 0 ${bottom ? 0 : 1} ${P(add(r.c, mul(dir(e), rr)))}" fill="none"/>
    <text class="plane-title region-title" style="--rc: var(--p-${r.id})"><textPath href="#rt-${r.id}" startOffset="50%" text-anchor="middle">${esc(r.label)}</textPath></text>`
}
function groupMarkup(theme: string, g: (typeof GROUPS)[number]) {
  const geo = GEO.get(g.id)!
  const C = `cx="${f1(geo.c.x)}" cy="${f1(geo.c.y)}" r="${f1(geo.r)}"`
  const tr = geo.r - 13
  const empty = g.nodes.length === 0
  const ring = theme === 'orrery' ? `<circle class="group-orbit" ${C}/>` : `<circle class="group-casing" ${C}/><circle class="group-band" ${C}/>`
  return `<g class="group${empty ? ' empty' : ''}" data-group="${g.id}" style="--rc: var(--p-${g.region})">
    <circle class="group-hit" ${C}/>${ring}
    <path id="gt-${g.id}" d="M${P(add(geo.c, mul(dir(-150), tr)))} A${f1(tr)},${f1(tr)} 0 0 1 ${P(add(geo.c, mul(dir(-30), tr)))}" fill="none"/>
    <text class="group-title"><textPath href="#gt-${g.id}" startOffset="50%" text-anchor="middle">${esc(g.label)}</textPath></text>
    ${empty && g.note ? `<text class="group-note" x="${f1(geo.c.x)}" y="${f1(geo.c.y + 4)}" text-anchor="middle">${esc('no box yet')}</text>` : ''}</g>`
}
/** The road itself, drawn under the arrows: a casing and a band from rim to rim, with a dashed center line. */
function roadMarkup(g: Gate) {
  const w = roadWidth(g)
  const d = `M${P(g.pa)}L${P(g.pb)}`
  return `<g class="road" data-road="${g.key}"><path class="road-casing" d="${d}" style="stroke-width:${f1(w + 6)}"/><path class="road-band" d="${d}" style="stroke-width:${f1(w)}"/><path class="road-line" d="${d}"/></g>`
}
/** The highway's marker sits in its middle, across the road. */
function gateMarkup(theme: string, g: Gate) {
  const w = roadWidth(g)
  let shape: string
  if (theme === 'orrery') {
    const s = 10
    shape = `<path class="gate-shape" filter="url(#glow)" d="M0,${-s} Q1.6,-1.6 ${s},0 Q1.6,1.6 0,${s} Q-1.6,1.6 ${-s},0 Q-1.6,-1.6 0,${-s}z"/>`
  } else shape = `<rect class="gate-shape" x="${f1(-w / 2 - 4)}" y="-5" width="${f1(w + 8)}" height="10" rx="5" transform="rotate(${f1(angle(g.n) + 90)})"/>`
  const A = regionById.get(g.a)!.short
  const B = regionById.get(g.b)!.short
  return `<g class="gate" data-gate-go="${g.key}" transform="translate(${P(g.p)})" tabindex="0" role="button" aria-label="Highway: ${esc(A)} and ${esc(B)}"><circle class="gate-hit" r="${f1(Math.max(16, w / 2 + 4))}"/>${shape}</g>`
}
function glyphMarkup(theme: string, gid: string) {
  const id = glyphNode(gid)
  const p = pos(gid)
  const name = ECO_LABEL[gid] ?? label(id)
  const shape = theme === 'orrery' ? `<circle class="st-halo" r="9"/><circle class="st-dot" r="4.8"/>` : `<circle class="st-dot" r="6.4"/>`
  return `<g class="station" data-node="${id}" data-glyph="${gid}" tabindex="0" role="button" aria-label="${esc(name)}">
    <g transform="translate(${P(p)})"><circle class="st-hit" r="12"/><circle class="st-here" r="13"/>${shape}</g>
    <text class="st-label" x="${f1(p.x)}" y="${f1(p.y)}" dy="0.35em">${esc(name)}</text></g>`
}
function leverGlyph(id: (typeof LEVER_ORDER)[number]) {
  const h = model.leverHome[id]
  const p = 'gate' in h ? add(GATES.get(h.gate)!.p, mul(GATES.get(h.gate)!.t, roadWidth(GATES.get(h.gate)!) / 2 + 18)) : add(pos(h.node), { x: 0, y: -18 })
  return `<g class="lever-glyph" data-lever="${id}" transform="translate(${P(p)})" tabindex="0" role="switch" aria-label="${esc(leverById.get(id)!.label)}">
    <rect class="lg-track" x="-11" y="-6" width="22" height="12" rx="6"/><circle class="lg-knob" r="4.2"/></g>`
}
function background(theme: string) {
  const hit = `<rect x="-2000" y="-2000" width="5000" height="5000" fill="transparent"/>`
  if (theme === 'orrery') {
    const rnd = seeded(7)
    let stars = ''
    for (let i = 0; i < 200; i++)
      stars += `<circle cx="${f1(-80 + rnd() * 1260)}" cy="${f1(-80 + rnd() * 1180)}" r="${(0.3 + rnd() * 1.1).toFixed(2)}" opacity="${(0.15 + rnd() * 0.6).toFixed(2)}"${i % 9 === 0 ? ' class="twinkle"' : ''}/>`
    return `<rect x="-2000" y="-2000" width="5000" height="5000" fill="url(#sky)"/><g class="stars">${stars}</g>`
  }
  let grid = ''
  for (let i = -400; i <= 1600; i += 40) grid += `M${i},-400V1600M-400,${i}H1600`
  return `${hit}<path class="grid" d="${grid}"/>`
}

// --- the map adapter -------------------------------------------------------------------------------------------
let svg!: SVGSVGElement
let cam: Camera | undefined
let particles!: Particles
let groupFocus: string | null = null
const flowEls = new Map<string, SVGPathElement>()
const glyphEls = new Map<string, SVGGElement>()
const GLYPHS = GROUPS.flatMap((g) => g.nodes)

const ALL: Box = fitBox(REGIONS.flatMap((r) => [add(r.c, { x: -r.r - 50, y: -r.r - 50 }), add(r.c, { x: r.r + 50, y: r.r + 60 })]), 0, 0)
const regionBox = (id: PlaneId): Box => {
  const r = regionById.get(id as Region)!
  const s = Math.max(r.r * 1.15, 230) // the small middle circle is shown with its highways and neighbours' rims
  return [r.c.x - s, r.c.y - s, s * 2, s * 2]
}
function cameraFor(app: App): Box {
  const m = app.mode
  if (m.kind === 'outside') return ALL
  if (m.kind === 'plane') {
    if (groupFocus) {
      const g = GEO.get(groupFocus)!
      return [g.c.x - g.r * 1.4, g.c.y - g.r * 1.4, g.r * 2.8, g.r * 2.8]
    }
    return regionBox(m.plane)
  }
  if (m.kind === 'node') return regionBox(regionOf.get(m.node)!)
  if (m.kind === 'gate') return fitBox([GATES.get(m.gate)!.pa, GATES.get(m.gate)!.pb], 160)
  const flows = m.kind === 'flow' ? [flowById.get(m.flow)!] : loopById.get(m.loop)!.path.map((id) => flowById.get(id)!)
  return fitBox(flows.flatMap(flowPts), 90, 380)
}

/** Labels below, right, above or left of each dot: the first spot clear of dots and labels already placed. */
function layoutLabels() {
  if (!cam || !svg.getBoundingClientRect().width) return
  const kNow = Number(svg.style.getPropertyValue('--k')) || 1
  type B = { x0: number; y0: number; x1: number; y1: number }
  const hit = (a: B, b: B) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1
  const placed: B[] = GLYPHS.map((g) => {
    const p = pos(g)
    return { x0: p.x - 9, y0: p.y - 9, x1: p.x + 9, y1: p.y + 9 }
  })
  for (const g of GLYPHS) {
    const el = glyphEls.get(g)?.querySelector<SVGTextElement>('.st-label')
    if (!el) continue
    const kZoom = cam.kFor(regionBox(regionOf.get(glyphNode(g))!))
    const bb = el.getBBox()
    const w = (bb.width * kZoom) / kNow + 3
    const h = (bb.height * kZoom) / kNow
    const p = pos(g)
    const gap = 9 + 3 * kZoom
    const cands = [
      { x: p.x, y: p.y + gap + h / 2, anchor: 'middle', b: { x0: p.x - w / 2, y0: p.y + gap, x1: p.x + w / 2, y1: p.y + gap + h } },
      { x: p.x + gap, y: p.y, anchor: 'start', b: { x0: p.x + gap, y0: p.y - h / 2, x1: p.x + gap + w, y1: p.y + h / 2 } },
      { x: p.x, y: p.y - gap - h / 2, anchor: 'middle', b: { x0: p.x - w / 2, y0: p.y - gap - h, x1: p.x + w / 2, y1: p.y - gap } },
      { x: p.x - gap, y: p.y, anchor: 'end', b: { x0: p.x - gap - w, y0: p.y - h / 2, x1: p.x - gap, y1: p.y + h / 2 } },
    ]
    const c = cands.find((q) => !placed.some((b) => hit(b, q.b))) ?? cands[0]
    placed.push(c.b)
    el.setAttribute('x', f1(c.x))
    el.setAttribute('y', f1(c.y))
    el.setAttribute('text-anchor', c.anchor)
  }
}

/** A token that slides along the arrow just followed. */
function travel(id: string) {
  const path = flowEls.get(id)
  const layer = svg.querySelector('.traveler-layer')
  if (!path || !layer) return
  layer.innerHTML = '<circle class="traveler-halo" r="14"/><circle class="traveler" r="7"/>'
  const dots = [...layer.querySelectorAll('circle')]
  const L = path.getTotalLength()
  const t0 = performance.now()
  const ms = Math.min(1400, 500 + L * 1.4)
  const step = (now: number) => {
    const t = Math.min(1, (now - t0) / ms)
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
    const p = path.getPointAtLength(e * L)
    for (const d of dots) {
      d.setAttribute('cx', f1(p.x))
      d.setAttribute('cy', f1(p.y))
    }
    if (t < 1) requestAnimationFrame(step)
    else setTimeout(() => (layer.innerHTML = ''), 250)
  }
  requestAnimationFrame(step)
}

const map: MapAdapter = {
  render(app) {
    const theme = app.theme
    flowEls.clear()
    glyphEls.clear()
    app.stage.insertAdjacentHTML('beforeend', `<svg id="map" role="img" aria-label="Four rings joined by highways: Global institutions in the middle; Global North, Global South and the Environment around it, with rings of actors inside"></svg>`)
    svg = app.stage.querySelector('#map') as SVGSVGElement
    svg.innerHTML = `<defs>${markerDefs()}
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <radialGradient id="sky" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="var(--bg-2)"/><stop offset="1" stop-color="var(--bg)"/></radialGradient></defs>
      <g class="bg" data-bg>${background(theme)}</g>
      <g class="rings">${REGIONS.map((r) => regionMarkup(theme, r)).join('')}</g>
      <g class="groups">${GROUPS.map((g) => groupMarkup(theme, g)).join('')}</g>
      <g class="roads">${[...GATES.values()].map(roadMarkup).join('')}</g>
      <g class="titles">${REGIONS.map(regionTitle).join('')}</g>
      <g class="flows">${data.flows.map((f) => `<path class="flow" data-flow="${f.id}" d="${flowPath(f)}"/>`).join('')}</g>
      <g class="flow-hits">${data.flows.map((f) => `<path class="flow-hit" data-flow-go="${f.id}" d="${flowPath(f)}"><title>${esc(f.label)}: ${esc(label(f.from))} → ${esc(label(f.to))}</title></path>`).join('')}</g>
      <g class="particles"></g><g class="traveler-layer"></g>
      <g class="gates">${[...GATES.values()].map((g) => gateMarkup(theme, g)).join('')}</g>
      <g class="stations">${GLYPHS.map((g) => glyphMarkup(theme, g)).join('')}</g>
      <g class="levers">${LEVER_ORDER.map(leverGlyph).join('')}</g>
      <g class="flow-labels"></g>`
    svg.querySelectorAll<SVGPathElement>('.flow').forEach((el) => flowEls.set(el.dataset.flow!, el))
    svg.querySelectorAll<SVGGElement>('.station').forEach((el) => glyphEls.set(el.dataset.glyph!, el))
    cam = new Camera(svg, cam ? cam.box : ALL)
    cam.scale()
    particles = new Particles(svg.querySelector('.particles')!, (id) => flowEls.get(id))
    layoutLabels()
  },
  update(app) {
    const em = app.emphasis()
    const fp = app.focusPlane()
    svg.dataset.focus = fp
    svg.dataset.mode = app.mode.kind
    const lit = litNodes(app, em)
    for (const [id, el] of flowEls) {
      const f = flowById.get(id)!
      const near = fp !== 'outside' && (regionOf.get(f.from) === fp || regionOf.get(f.to) === fp)
      el.setAttribute('class', flowClasses(app, em, f, near))
      el.setAttribute('marker-end', `url(#${markerFor(app, em, id)})`)
    }
    for (const [g, el] of glyphEls) {
      const id = glyphNode(g)
      el.setAttribute('class', stationClasses(app, id, lit) + (regionOf.get(id) === fp ? ' in-focus' : ''))
      el.style.setProperty('--delay', `${app.delays.get(id) ?? 0}ms`)
    }
    svg.querySelectorAll<SVGGElement>('.gate').forEach((el) => {
      const k = el.dataset.gateGo!
      const n = data.flows.filter((f) => ROUTE.get(f.id)!.some((h) => h.g.key === k) && app.view.flows.has(f.id)).length
      el.classList.toggle('sel', app.mode.kind === 'gate' && app.mode.gate === k)
      el.classList.toggle('closed', n === 0)
    })
    svg.querySelectorAll<SVGGElement>('.group').forEach((el) => el.classList.toggle('sel', el.dataset.group === groupFocus && app.mode.kind === 'plane'))
    svg.querySelectorAll<SVGGElement>('.lever-glyph').forEach((el) => {
      const on = app.cfg[el.dataset.lever as keyof typeof app.cfg]
      el.classList.toggle('on', on)
      el.setAttribute('aria-checked', String(on))
      el.querySelector('.lg-knob')!.setAttribute('cx', on ? '5' : '-5')
    })
    renderFlowLabels(app, em, svg.querySelector('.flow-labels')!, (id) => flowEls.get(id), (f) => (crossKey(f) ? 0.3 : 0.5))
    particles.set(particleSpecs(app, em, (f) => fp === 'outside' || regionOf.get(f.from) === fp || regionOf.get(f.to) === fp))
  },
  navigate(app, prev, via) {
    if (!cam) return
    if (app.mode.kind !== 'plane') groupFocus = null
    if (via && app.motion) travel(via.id)
    const c = cam
    const target = cameraFor(app)
    const prevRegion = prev.kind === 'node' ? regionOf.get(prev.node) : prev.kind === 'plane' ? prev.plane : null
    if (app.mode.kind === 'node' && via && crossKey(via) && prevRegion && prevRegion !== regionOf.get(app.mode.node)) {
      // crossing rings: swing along the highway first
      c.fly(fitBox(flowPts(via), 60, 380), app.motion, () => c.fly(target, app.motion, undefined, 700), 700)
    } else c.fly(target, app.motion)
  },
  resize() {
    cam?.scale()
    layoutLabels()
  },
}

const app = new App({ model, map, subtitle: 'North, South, Environment' })
new StoryController(app)
app.renderStart()
// a ring of actors zooms the camera onto that group
document.addEventListener('click', (e) => {
  const g = (e.target as Element).closest<SVGGElement>('[data-group]')
  if (!g || (e.target as Element).closest('.station, .gate, .lever-glyph, .flow-hit')) return
  groupFocus = g.dataset.group!
  app.go({ kind: 'plane', plane: GEO.get(groupFocus)!.region })
})
