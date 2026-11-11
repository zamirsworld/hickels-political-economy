// Predict, then reveal. The reader works through a cycle as a run of questions: at each box, pick the arrow (or,
// where a box has few arrows, the box) that carries the loop on, with the cycle's own extra questions (numbers to
// estimate, scales to choose, events to order) in between; then choose which switches break the loop (or, for a
// virtuous cycle, which it needs). Every wrong answer is still a real arrow or box on the map, so it explains
// itself. A scorecard closes the run. The cycle comes from ?c=.
import '../../shared/base.css'
import '../cycles.css'
import './deck.css'
import './style.css'
import { breakHtml, closedHtml, countUp, introHtml, pickerHtml, routeHtml, stepHtml, themeToggle } from '../cards.ts'
import { Cycle, legendHtml } from '../diagram.ts'
import {
  askByBox, boxChoicesFor, choicesFor, esc, figCite, flowDesc, flowLabel, label, leverText, leverEffects, loopsOf, opensWith, ringOf, sourceChips, virtuous,
  type Choice, type Estimate, type Extra, type Flow, type Order, type Placement,
} from '../model.ts'
import { CYCLES, current } from '../scripts/index.ts'

const c = current()
const STEPS = c.steps
const N = STEPS.length
const RING = ringOf(c)
const VIRTUOUS = virtuous(c)
document.title = `${c.short} · Predict`

type Screen =
  | { k: 'extra'; x: Extra }
  | { k: 'intro' }
  | { k: 'ask'; i: number }
  | { k: 'reveal'; i: number }
  | { k: 'closed' }
  | { k: 'switches' }
  | { k: 'break' }
  | { k: 'score' }

const placed = (p: (a: Placement) => boolean): Screen[] => c.extras.filter((x) => p(x.at)).map((x) => ({ k: 'extra', x }))
const PLAN: Screen[] = [
  ...placed((a) => a === 'start'),
  { k: 'intro' },
  ...STEPS.flatMap((_, i): Screen[] => [
    { k: 'ask', i },
    ...placed((a) => typeof a === 'object' && 'ask' in a && a.ask === i),
    { k: 'reveal', i },
    ...placed((a) => typeof a === 'object' && 'reveal' in a && a.reveal === i),
  ]),
  { k: 'closed' },
  ...placed((a) => a === 'closed'),
  { k: 'switches' },
  { k: 'break' },
  { k: 'score' },
]
/** One line per question on the scorecard. */
type Result = { label: string; ok: boolean; detail: string }
const results = new Map<string, Result>()
let pos = 0
const missedBy = new Map<number, Set<string>>() // wrong picks at each step, kept for going back
let missed = new Set<string>() // wrong picks on the current question
let arrangement: string[] = [] // the order game: event ids, top to bottom
const arrangements = new Map<string, string[]>() // each order question's answer, kept for going back
let picks = new Set<string>() // the switch challenge
let guesses: Record<string, number> = {} // estimates and choices

const app = document.getElementById('app')!
app.innerHTML = `
  <header class="bar">
    <a class="sub" href="../">← all cycles</a>
    ${pickerHtml(CYCLES, c)}
    <span class="sub mode">guess as you go · <a href="../scroll/?c=${c.slug}">read it as a story instead</a></span>
    <span class="grow"></span>
    <span class="run-score" aria-live="polite"></span>
    <button type="button" class="ghost" id="theme"></button>
  </header>
  <main class="deck">
    <section class="dia">${legendHtml(c)}</section>
    <section class="card" aria-live="polite">
      <div class="card-inner"></div>
      <nav class="nav"><button type="button" class="pill quiet" id="back">← Back</button><span class="count"></span><span class="keys muted small">Tip: number keys answer, ← → move between screens</span><button type="button" class="pill" id="next"></button></nav>
    </section>
  </main>`
themeToggle(document.getElementById('theme') as HTMLButtonElement)
document.getElementById('pick-cycle')!.addEventListener('change', (e) => {
  location.search = `?c=${(e.target as HTMLSelectElement).value}`
})
const cycle = new Cycle(app.querySelector('.dia')!, c, { progressive: true })
const inner = app.querySelector<HTMLElement>('.card-inner')!
const next = document.getElementById('next') as HTMLButtonElement
const back = document.getElementById('back') as HTMLButtonElement
const screen = () => PLAN[pos]
const record = (key: string, r: Result) => {
  if (!results.has(key)) results.set(key, r)
  updateScore()
}
function updateScore() {
  const all = [...results.values()]
  app.querySelector('.run-score')!.textContent = all.length ? `${all.filter((r) => r.ok).length} of ${all.length} right first time` : ''
}

// --- question bodies -------------------------------------------------------------------------------------------
const kicker = (s: string) => `<div class="kicker">${esc(s)}</div>`
const qNum = (i: number) => `Step ${i + 1} of ${N}`
const altNote = (f: Flow) =>
  opensWith(f).length
    ? `This happens too, but only in the alternative world Hickel describes, once “${opensWith(f)
        .map((l) => `${esc(leverText(l).label)}” changes to “${esc(leverText(l).right.toLowerCase())}`)
        .join('” and “')}”.`
    : 'This really happens, but it isn’t the next step in this cycle.'
const key = (k: number) => `<span class="key">${k + 1}</span>`

const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1))
const answerText = (e: Estimate) => e.answerLabel ?? (Array.isArray(e.answer) ? `${fmt(e.answer[0])}–${fmt(e.answer[1])}${e.unit}` : `${fmt(e.answer)}${e.unit}`)
const answerMid = (e: Estimate) => (Array.isArray(e.answer) ? (e.answer[0] + e.answer[1]) / 2 : e.answer)
const estimateOk = (e: Estimate, g: number) => {
  const [lo, hi] = Array.isArray(e.answer) ? e.answer : [e.answer, e.answer]
  return g >= lo - e.tolerance && g <= hi + e.tolerance
}

function estimateHtml(e: Estimate) {
  const done = e.id in guesses
  const g = guesses[e.id] ?? e.start ?? Math.round((e.min + e.max) / 2)
  const w = (v: number) => Math.max(0, Math.min(100, ((v - e.min) / (e.max - e.min)) * 100))
  const bar = (cls: string, name: string, v: number, text: string) =>
    `<div class="gbar ${cls}"><span class="gbar-name">${esc(name)}</span><span class="gbar-track"><i style="--w:${w(v)}%"></i></span><b>${esc(text)}</b></div>`
  return `${kicker(e.kicker ?? 'Guess the number')}
    <h2 class="step-title ask">${esc(e.prompt)}</h2>
    <div class="slider-row"><input type="range" min="${e.min}" max="${e.max}" step="${e.step ?? 1}" value="${g}" id="guess" aria-label="Your guess" ${done ? 'disabled' : ''}/><output for="guess">${fmt(g)}${esc(e.unit)}</output></div>
    ${
      done
        ? `<div class="bars">${bar('you', 'Your guess', g, `${fmt(g)}${e.unit}`)}${bar('real', e.answerName, answerMid(e), answerText(e))}${(e.also ?? []).map((a) => bar('real labor', a.name, a.value, a.text ?? `${fmt(a.value)}${e.unit}`)).join('')}</div>
      <p class="text">${esc(e.reveal)}</p>${e.fig ? figCite(e.fig) : ''}${e.sources ? sourceChips(e.sources) : ''}`
        : `<button type="button" class="pill" id="lock">Lock in my guess</button>`
    }`
}

function choiceHtml(x: Choice) {
  const answered = x.id in guesses ? guesses[x.id] : null
  return `${kicker(x.kicker)}
    <h2 class="step-title ask">${esc(x.prompt)}</h2>
    ${x.hint ? `<p class="hint">${esc(x.hint)}</p>` : ''}
    <div class="opts mag">${x.options
      .map((o, k) => {
        const cls = answered === null ? '' : k === x.answer ? ' right' : k === answered ? ' wrong' : ''
        return `<button type="button" class="opt${cls}" data-choice="${k}" ${answered === null ? '' : 'disabled'}>${key(k)}<span class="opt-text"><b>${esc(o)}</b>${x.small ? `<small>${esc(x.small)}</small>` : ''}</span></button>`
      })
      .join('')}</div>
    ${answered === null ? '' : `<p class="text">${esc(x.caption)}</p>${x.fig ? figCite(x.fig) : ''}${x.sources ? sourceChips(x.sources) : ''}`}`
}

const sortedIds = (x: Order) => [...x.events].sort((a, b) => (a.sortYear ?? 0) - (b.sortYear ?? 0)).map((e) => e.id)
/**
 * The order game: the events start scrambled, the reader drags them (or uses the arrows) into order, and on
 * checking they slide into the right order, each marked by whether the reader had it in the right place.
 */
function orderHtml(x: Order, checked: boolean) {
  const right = sortedIds(x)
  const ids = checked ? right : arrangement
  const byId = new Map(x.events.map((e) => [e.id, e]))
  const n = ids.length
  return `${kicker(x.kicker)}
    <h2 class="step-title ask">${esc(x.prompt)}</h2>
    <p class="hint">${checked ? 'Here is the right order.' : `${esc(x.hint)} Drag the rows, or use the arrows, then check.`}</p>
    <ol class="reorder${checked ? ' checked' : ''}" aria-label="Events, earliest at the top">${ids
      .map((id, k) => {
        const e = byId.get(id)!
        const had = arrangement.indexOf(id)
        const cls = checked ? (had === k ? ' right' : ' wrong') : ''
        const name = e.label.replace(/^Coup against |^Assassination of /, '')
        return `<li class="opt ro-row${cls}" data-id="${id}">
          ${checked ? '' : '<span class="ro-grip" aria-hidden="true">⠿</span>'}
          <span class="key">${k + 1}</span>
          <span class="opt-text"><b>${esc(name)}</b>${checked ? `<small>${esc(e.year)} · ${esc(e.description)}${had === k ? '' : ` <i class="ro-had">You had it at #${had + 1}.</i>`}</small>` : ''}</span>
          ${
            checked
              ? `<span class="ro-mark" aria-label="${had === k ? 'right place' : 'wrong place'}">${had === k ? '✓' : '↻'}</span>`
              : `<span class="ro-btns"><button type="button" class="ro-move" data-move="-1" data-id="${id}" aria-label="Move ${esc(name)} earlier" ${k === 0 ? 'disabled' : ''}>↑</button><button type="button" class="ro-move" data-move="1" data-id="${id}" aria-label="Move ${esc(name)} later" ${k === n - 1 ? 'disabled' : ''}>↓</button></span>`
          }</li>`
      })
      .join('')}</ol>
    ${checked ? sourceChips(x.events.flatMap((e) => e.sources.slice(0, 1))) : '<button type="button" class="pill" id="order-check">Check my order</button>'}`
}
/** Re-render the order game, sliding each row from where it was to where it now is. */
function renderOrder(x: Order, checked: boolean) {
  const before = new Map([...inner.querySelectorAll<HTMLElement>('.ro-row')].map((r) => [r.dataset.id!, r.getBoundingClientRect().top]))
  inner.innerHTML = orderHtml(x, checked)
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  inner.querySelectorAll<HTMLElement>('.ro-row').forEach((r) => {
    const top = before.get(r.dataset.id!)
    if (top === undefined) return
    const dy = top - r.getBoundingClientRect().top
    if (!dy) return
    r.style.transition = 'none'
    r.style.transform = `translateY(${dy}px)`
    void r.offsetWidth
    r.style.transition = checked ? 'transform 0.9s cubic-bezier(0.5, 0, 0.2, 1)' : 'transform 0.25s ease'
    r.style.transform = ''
  })
}

const optionHtml = (f: Flow, k: number) =>
  `<button type="button" class="opt kind-${f.kind}" data-pick="${f.id}">${key(k)}<span class="kind-tag">${esc(f.kind)}</span><span class="opt-text"><b>${esc(flowLabel(f))}</b><small>→ ${esc(label(f.to))}${opensWith(f).length ? ' · only in the alternative' : ''}</small></span></button>`

function askHtml(i: number) {
  const s = STEPS[i]
  const byBox = askByBox(s)
  const done = results.has(`step${i}`)
  const wrong = missedBy.get(i) ?? new Set<string>()
  const rightId = byBox ? s.flow.to : s.flow.id
  // a revisited question shows how it was answered
  const state = (id: string) => (done && id === rightId ? ' right' : wrong.has(id) ? ' wrong' : '')
  const off = (id: string) => (done || wrong.has(id) ? ' disabled' : '')
  const opts = byBox
    ? boxChoicesFor(c, s).map((b, k) => `<button type="button" class="opt box r-${b.region}${state(b.id)}" data-pick="${b.id}"${off(b.id)}>${key(k)}<span class="opt-text"><b>${esc(b.label)}</b></span></button>`)
    : choicesFor(s).map((f, k) => optionHtml(f, k).replace('class="opt ', `class="opt${state(f.id)} `).replace('data-pick=', `${off(f.id)} data-pick=`))
  return `${kicker(`${qNum(i)} · you are at ${RING[i].label}`)}
    <h2 class="step-title ask">${esc(s.prompt)}</h2>
    <p class="hint">${byBox ? `Pick who or what comes next. ${esc(label(s.flow.from))} leads to only a few places, so here you choose where it lands.` : `Each option is something that really comes out of ${esc(label(s.flow.from))}, today or in the alternative Hickel describes. Only one keeps this cycle going.`}</p>
    <div class="opts">${opts.join('')}</div>
    <div class="feedback" aria-live="polite"></div>`
}

function switchesHtml(checked: boolean) {
  const effects = leverEffects(c)
  const right = effects.filter((x) => x.flows.length).map((x) => x.lever.id)
  return `${kicker('The challenge')}
    <h2 class="step-title ask">${VIRTUOUS ? 'Which switches does this cycle need? Pick all you think apply.' : 'Which switches would break this cycle? Pick all you think apply.'}</h2>
    <p class="hint">Each switch changes one big decision about how society is run, from the way it works today to the alternative Hickel proposes. ${
      VIRTUOUS
        ? `The cycle needs a switch if at least one of its ${N} steps only happens once that switch is flipped.`
        : `A switch breaks the cycle if it stops at least one of its ${N} steps.`
    }</p>
    ${checked ? switchSummary(right) : ''}
    <div class="opts levers${checked ? ' checked' : ''}">${effects
      .map(({ lever, flows }, k) => {
        const on = picks.has(lever.id)
        const matters = flows.length > 0
        // four outcomes: found it, missed it, picked one that does nothing, rightly left alone
        const outcome = !checked ? '' : matters ? (on ? 'hit' : 'missed') : on ? 'false' : 'none'
        const tag = {
          hit: VIRTUOUS ? '✓ You picked it, and the cycle needs it' : '✓ You picked it, and it breaks the cycle',
          missed: VIRTUOUS ? '! You missed this one: the cycle needs it too' : '! You missed this one: it breaks the cycle too',
          false: VIRTUOUS ? '✗ You picked it, but the cycle doesn’t need it' : '✗ You picked it, but it doesn’t affect this cycle',
          none: VIRTUOUS ? 'Not needed for this cycle' : 'Doesn’t affect this cycle',
          '': '',
        }[outcome]
        const names = flows.map((f) => `<b>${esc(flowLabel(f))}</b>`).join(', ')
        const detail = checked && matters ? `<small class="closes">${VIRTUOUS ? `Needed for: ${names}.` : `Stops: ${names}.`}</small>` : ''
        return `<button type="button" class="opt lever${checked ? ` out-${outcome}` : on ? ' tapped' : ''}" data-lever="${lever.id}" aria-pressed="${on}">${key(k)}<span class="opt-text">${tag ? `<span class="out-tag">${tag}</span>` : ''}<b>${esc(leverText(lever).label)}</b><small>${esc(leverText(lever).left)} → ${esc(leverText(lever).right)}</small>${detail}</span></button>`
      })
      .join('')}</div>
    ${
      checked
        ? `<p class="text">${c.switchesText}</p>${sourceChips(effects.filter((x) => x.flows.length).flatMap((x) => x.lever.sources.slice(0, VIRTUOUS ? 2 : 1).slice(-1)))}`
        : '<button type="button" class="pill" id="check">Check my picks</button>'
    }`
}

/** One line that sums up the switch picks. */
function switchSummary(right: string[]) {
  const found = right.filter((id) => picks.has(id)).length
  const extra = [...picks].filter((id) => !right.includes(id)).length
  const verb = VIRTUOUS ? 'that the cycle needs' : 'that break it'
  const head = found === right.length && !extra ? 'All right!' : found === right.length ? 'Close.' : 'Not quite.'
  return `<p class="switch-summary"><b>${head}</b> You found ${found} of the ${right.length} switches ${verb}${
    extra ? `, and picked ${extra} that ${extra === 1 ? 'doesn’t' : 'don’t'} ${VIRTUOUS ? 'matter for it' : 'affect it'}` : ''
  }. Click any switch to see its effect on the circle.</p>`
}

function scoreHtml() {
  const all = [...results.values()]
  const right = all.filter((r) => r.ok).length
  const others = CYCLES.filter((x) => x !== c)
  return `${kicker('Your run')}
    <h2 class="step-title">${right} of ${all.length} right first time</h2>
    <ol class="scorecard">${all.map((r) => `<li class="${r.ok ? 'ok' : ''}"><span class="mark">${r.ok ? '✓' : '↻'}</span><span><b>${esc(r.label)}</b><small>${esc(r.detail)}</small></span></li>`).join('')}</ol>
    <p class="text">The cycle you followed: ${STEPS.map((s) => esc(flowLabel(s.flow))).join(' → ')}, and round again.</p>
    <p class="end-links"><span class="muted small">Try another cycle:</span> ${others
      .slice(0, 3)
      .map((x) => `<a class="pill quiet" href="?c=${x.slug}">${esc(x.title)}</a>`)
      .join(' ')} <a class="pill quiet" href="../">All cycles</a></p>`
}

// --- rendering ---------------------------------------------------------------------------------------------------
/** Where the ring stands for an extra question, from its placement. */
function ringFor(at: Placement) {
  if (at === 'start') cycle.set(-1)
  else if (at === 'closed') cycle.set(N)
  else if ('ask' in at) {
    cycle.ask(at.ask)
    cycle.mark(STEPS[at.ask].flow.to, 'right') // the step was just answered
  } else cycle.set(at.reveal)
}
function extraHtml(x: Extra) {
  return x.k === 'estimate' ? estimateHtml(x) : x.k === 'choice' ? choiceHtml(x) : orderHtml(x, false)
}

function render() {
  const s = screen()
  inner.classList.remove('in')
  void inner.offsetWidth
  inner.classList.add('in')
  inner.scrollTop = 0
  cycle.setBroken(false)
  cycle.setClosed([])
  cycle.mark(null)
  next.hidden = false
  next.textContent = 'Next →'
  back.hidden = pos === 0 || s.k === 'score'
  let count = ''
  switch (s.k) {
    case 'extra':
      if (s.x.k === 'order') arrangement = arrangements.get(s.x.id) ?? s.x.events.map((e) => e.id)
      inner.innerHTML = s.x.k === 'order' && results.has(s.x.id) ? orderHtml(s.x, true) : extraHtml(s.x)
      ringFor(s.x.at)
      next.hidden = !results.has(s.x.id)
      break
    case 'intro':
      inner.innerHTML = `${introHtml(c)}<p class="text"><b>Your turn:</b> at each step, guess what happens next.</p>`
      cycle.set(-1)
      next.textContent = 'Let’s start →'
      break
    case 'ask': {
      if (!missedBy.has(s.i)) missedBy.set(s.i, new Set())
      missed = missedBy.get(s.i)!
      inner.innerHTML = askHtml(s.i)
      cycle.ask(s.i)
      const done = results.has(`step${s.i}`)
      if (done) cycle.mark(STEPS[s.i].flow.to, 'right')
      next.hidden = !done
      count = `${s.i + 1} / ${N}`
      break
    }
    case 'reveal': {
      const ok = results.get(`step${s.i}`)?.ok
      inner.innerHTML = `<div class="verdict ${ok ? 'good' : ''}">${ok ? 'Right first time.' : 'Got there.'}</div>${stepHtml(STEPS[s.i])}`
      cycle.set(s.i)
      next.textContent = s.i === N - 1 ? 'Close the circle →' : 'Next step →'
      count = `${s.i + 1} / ${N}`
      break
    }
    case 'closed':
      inner.innerHTML = `<div class="verdict good">You followed the whole cycle.</div>${closedHtml(c, () => 'disabled')}`
      cycle.set(N)
      next.textContent = 'Take the challenge →'
      break
    case 'switches': {
      const done = results.has('switches')
      inner.innerHTML = switchesHtml(done)
      cycle.set(N)
      if (done) cycle.setClosed(leverEffects(c).flatMap((x) => x.flows.map((f) => f.id)))
      next.hidden = !done
      break
    }
    case 'break':
      inner.innerHTML = breakHtml(c)
      cycle.set(N)
      next.textContent = 'See your scorecard →'
      break
    case 'score':
      inner.innerHTML = scoreHtml()
      cycle.set(N)
      next.textContent = 'Play again'
  }
  app.querySelector('.count')!.textContent = count
  countUp(inner)
  updateScore()
}
function advance() {
  if (screen().k === 'score') {
    results.clear()
    guesses = {}
    missedBy.clear()
    arrangements.clear()
    picks = new Set()
    pos = 0
  } else pos = Math.min(PLAN.length - 1, pos + 1)
  render()
}
function goBack() {
  if (pos === 0) return
  pos--
  render()
}
const currentExtra = <K extends Extra['k']>(k: K) => {
  const s = screen()
  return s.k === 'extra' && s.x.k === k ? (s.x as Extract<Extra, { k: K }>) : null
}

// --- answers -----------------------------------------------------------------------------------------------------
function pick(id: string) {
  const s = screen()
  if (s.k !== 'ask') return
  const step = STEPS[s.i]
  const btn = inner.querySelector<HTMLButtonElement>(`[data-pick="${id}"]`)!
  const byBox = askByBox(step)
  if (byBox ? id === step.flow.to : id === step.flow.id) {
    const n = missed.size
    record(`step${s.i}`, { label: `Step ${s.i + 1}: ${step.title}`, ok: n === 0, detail: n ? `${n} wrong ${n === 1 ? 'try' : 'tries'} first` : 'right first time' })
    btn.classList.add('right')
    cycle.mark(step.flow.to, 'right')
    inner.querySelectorAll<HTMLButtonElement>('.opt').forEach((b) => (b.disabled = true))
    const here = pos
    setTimeout(() => pos === here && advance(), 700) // let the right answer show on the ring, then move on
    return
  }
  // a wrong answer is still a real arrow or box: say what it is
  missed.add(id)
  btn.classList.add('wrong')
  btn.disabled = true
  let html: string
  if (byBox) {
    const via = boxChoicesFor(c, step).find((b) => b.id === id)!.via
    cycle.mark(id, 'wrong')
    html = via ? `${routeHtml({ flow: via })}<p>${altNote(via)} ${esc(flowDesc(via))}</p>` : `<p>There’s no arrow from ${esc(label(step.flow.from))} to ${esc(label(id))} on the map.</p>`
  } else {
    const f = choicesFor(step).find((x) => x.id === id)!
    cycle.mark(f.to, 'wrong')
    const loops = loopsOf(f.id)
    html = `${routeHtml({ flow: f })}<p>${altNote(f)} ${esc(flowDesc(f))}</p>
      ${loops.length ? `<p class="muted small">It’s part of another cycle: ${loops.map((l) => `<b>${esc(l)}</b>`).join(', ')}.</p>` : ''}`
  }
  inner.querySelector('.feedback')!.innerHTML = `<div class="fb">${html}<p class="muted small">Have another go.</p></div>`
}

function lockGuess() {
  const e = currentExtra('estimate')
  if (!e) return
  const g = Number(inner.querySelector<HTMLInputElement>('#guess')!.value)
  guesses[e.id] = g
  const within = Array.isArray(e.answer) ? `within ${e.tolerance} of the range counts` : `within ${e.tolerance} counts`
  record(e.id, { label: e.label, ok: estimateOk(e, g), detail: `you said ${fmt(g)}${e.unit}; it’s ${answerText(e)} (${within})` })
  inner.innerHTML = estimateHtml(e)
  next.hidden = false
}

function answerChoice(k: number) {
  const x = currentExtra('choice')
  if (!x || x.id in guesses) return
  guesses[x.id] = k
  record(x.id, { label: x.label, ok: k === x.answer, detail: `you said ${x.options[k]}; it’s ${x.options[x.answer]}` })
  inner.innerHTML = choiceHtml(x)
  next.hidden = false
}

function moveEvent(id: string, by: number) {
  const x = currentExtra('order')
  const i = arrangement.indexOf(id)
  const j = i + by
  if (!x || i < 0 || j < 0 || j >= arrangement.length || results.has(x.id)) return
  ;[arrangement[i], arrangement[j]] = [arrangement[j], arrangement[i]]
  renderOrder(x, false)
  inner.querySelector<HTMLButtonElement>(`.ro-move[data-id="${id}"][data-move="${by}"]:not(:disabled)`)?.focus()
}
function checkOrder() {
  const x = currentExtra('order')
  if (!x || results.has(x.id)) return
  const right = sortedIds(x)
  arrangements.set(x.id, [...arrangement])
  const inPlace = arrangement.filter((id, k) => right[k] === id).length
  record(x.id, { label: x.label, ok: inPlace === right.length, detail: `${inPlace} of ${right.length} in the right place` })
  // first mark the reader's own order, then slide everything into the right order
  inner.querySelectorAll<HTMLElement>('.ro-row').forEach((r, k) => r.classList.add(right[k] === r.dataset.id ? 'right' : 'wrong', 'judged'))
  inner.querySelectorAll<HTMLButtonElement>('.ro-move, #order-check').forEach((b) => (b.disabled = true))
  inner.querySelector('.reorder')!.classList.add('checked')
  const slide = () => {
    if (currentExtra('order') === x) renderOrder(x, true)
    next.hidden = false
  }
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) slide()
  else setTimeout(slide, 900)
}

// dragging a row: it follows the pointer, and swaps with a neighbour once its middle passes the neighbour's
let drag: { el: HTMLElement; startY: number } | null = null
inner.addEventListener('pointerdown', (e) => {
  const t = e.target as Element
  const row = t.closest<HTMLElement>('.reorder:not(.checked) .ro-row')
  if (!row || t.closest('button') || (e.pointerType !== 'mouse' && !t.closest('.ro-grip'))) return
  e.preventDefault()
  row.setPointerCapture(e.pointerId)
  row.classList.add('dragging')
  row.style.transition = 'none'
  drag = { el: row, startY: e.clientY }
})
inner.addEventListener('pointermove', (e) => {
  if (!drag) return
  const { el } = drag
  el.style.transform = `translateY(${e.clientY - drag.startY}px)`
  const mid = el.getBoundingClientRect().top + el.offsetHeight / 2
  const prev = el.previousElementSibling as HTMLElement | null
  const nxt = el.nextElementSibling as HTMLElement | null
  const centre = (r: HTMLElement) => r.getBoundingClientRect().top + r.offsetHeight / 2
  const swap = nxt && mid > centre(nxt) ? nxt : prev && mid < centre(prev) ? prev : null
  if (!swap) return
  const top0 = el.offsetTop
  const nTop = swap.getBoundingClientRect().top
  if (swap === nxt) el.parentElement!.insertBefore(swap, el)
  else el.parentElement!.insertBefore(el, swap)
  drag.startY += el.offsetTop - top0 // keep the row under the pointer after it moves in the list
  el.style.transform = `translateY(${e.clientY - drag.startY}px)`
  // the neighbour slides into the gap
  swap.style.transition = 'none'
  swap.style.transform = `translateY(${nTop - swap.getBoundingClientRect().top}px)`
  void swap.offsetWidth
  swap.style.transition = 'transform 0.18s ease'
  swap.style.transform = ''
})
const endDrag = () => {
  if (!drag) return
  const x = currentExtra('order')
  drag.el.classList.remove('dragging')
  drag.el.style.transition = 'transform 0.15s ease'
  drag.el.style.transform = ''
  drag = null
  if (!x) return
  arrangement = [...inner.querySelectorAll<HTMLElement>('.ro-row')].map((r) => r.dataset.id!)
  setTimeout(() => renderOrder(x, false), 160) // refresh numbers and arrow buttons
}
inner.addEventListener('pointerup', endDrag)
inner.addEventListener('pointercancel', endDrag)

function toggleLever(id: string) {
  if (screen().k !== 'switches') return
  if (inner.querySelector('#check')) {
    if (picks.has(id)) picks.delete(id)
    else picks.add(id)
    inner.innerHTML = switchesHtml(false)
    return
  }
  // after checking: show on the ring what this switch closes (or, for a virtuous loop, what closes without it)
  cycle.setClosed(leverEffects(c).find((x) => x.lever.id === id)!.flows.map((f) => f.id))
  inner.querySelectorAll<HTMLButtonElement>('[data-lever]').forEach((b) => b.classList.toggle('focus', b.dataset.lever === id))
}

function checkLevers() {
  const effects = leverEffects(c)
  const right = new Set(effects.filter((x) => x.flows.length).map((x) => x.lever.id))
  const misjudged = effects.filter((x) => right.has(x.lever.id) !== picks.has(x.lever.id)).length
  record('switches', {
    label: VIRTUOUS ? 'Which switches the cycle needs' : 'Which switches break the cycle',
    ok: misjudged === 0,
    detail: misjudged ? `${misjudged} of ${effects.length} switches misjudged` : `all ${effects.length} judged right`,
  })
  inner.innerHTML = switchesHtml(true)
  cycle.setClosed(effects.flatMap((x) => x.flows.map((f) => f.id)))
  next.hidden = false
}

app.addEventListener('click', (e) => {
  const t = e.target as HTMLElement
  const at = (sel: string) => t.closest<HTMLButtonElement>(sel)
  const opt = at('[data-pick]')
  if (opt && !opt.disabled) return pick(opt.dataset.pick!)
  const ch = at('[data-choice]')
  if (ch && !ch.disabled) return answerChoice(Number(ch.dataset.choice))
  const mv = at('[data-move]')
  if (mv && !mv.disabled) return moveEvent(mv.dataset.id!, Number(mv.dataset.move))
  if (at('#order-check')) return checkOrder()
  const lv = at('[data-lever]')
  if (lv) return toggleLever(lv.dataset.lever!)
  if (at('#lock')) return lockGuess()
  if (at('#check')) return checkLevers()
  if (at('#next')) return advance()
  if (at('#back')) return goBack()
  const sw = at('[data-break]')
  if (sw) {
    const on = sw.getAttribute('aria-checked') !== 'true'
    sw.setAttribute('aria-checked', String(on))
    cycle.setBroken(on)
  }
})
app.addEventListener('input', (e) => {
  const r = e.target as HTMLInputElement
  const x = currentExtra('estimate')
  if (r.id === 'guess' && x) inner.querySelector('output')!.textContent = `${fmt(Number(r.value))}${x.unit}`
})
// number keys answer; Enter locks in a guess, checks the switches, or continues
document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || e.target instanceof HTMLSelectElement) return
  if (/^[1-9]$/.test(e.key)) {
    const b = [...inner.querySelectorAll<HTMLButtonElement>('.opts .opt')][Number(e.key) - 1]
    if (b && !b.disabled) {
      e.preventDefault()
      b.click()
    }
  } else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !(e.target instanceof HTMLInputElement)) {
    const b = e.key === 'ArrowLeft' ? back : next
    if (!b.hidden) {
      e.preventDefault()
      b.click()
    }
  } else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
    const target = inner.querySelector<HTMLButtonElement>('#lock, #check, #order-check') ?? (next.hidden ? null : next)
    if (target) {
      e.preventDefault()
      target.click()
    }
  }
})
render()
