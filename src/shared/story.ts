// Guided stories: one per entry question. Each walks real, sourced arrows on the map, pauses to let the
// reader predict where an arrow goes, closes a named cycle, and ends at a decision the reader can flip,
// then hands over the open map. Connective text frames the steps; every claim shown comes from the
// arrow, box or loop descriptions in the data (with their timestamps).
import { configFor, type LeverConfig } from '../model/levers.ts'
import type { LeverId } from '../model/types.ts'
import { App, esc, flowById, label, levelWord, links, loopById, lvClass, nodeById } from './core.ts'

type Step =
  | { kind: 'intro'; node: string; text: string }
  | { kind: 'flow'; flow: string; text?: string; predict?: { q: string; options: string[] } }
  | { kind: 'look'; flow: string; text: string }
  | { kind: 'loop'; loop: string; text: string }
  | { kind: 'decision'; lever: LeverId; text: string }
  | { kind: 'end'; text: string }

export const STORIES: Record<string, { title: string; steps: Step[] }> = {
  work: {
    title: 'Why do I feel insecure at work?',
    steps: [
      { kind: 'intro', node: 'workers_north', text: 'Start where most people start: at work. The color of this box is its condition, and today it reads insecure. Follow one working day and see why.' },
      { kind: 'flow', flow: 'labor_north', text: 'Your day goes into production.' },
      { kind: 'flow', flow: 'surplus', predict: { q: 'Your labor produces more than you are paid. Who gets the difference?', options: ['capital', 'workers_north', 'state'] } },
      { kind: 'flow', flow: 'hire_control', text: 'Whoever holds the surplus also decides whether jobs exist at all.' },
      { kind: 'flow', flow: 'discipline', predict: { q: 'Jobs exist only when hiring is profitable. Where does that threat land?', options: ['workers_north', 'citizens', 'capital'] } },
      { kind: 'loop', loop: 'loop_discipline', text: 'You are back where you started. That is a cycle: each turn sets up the next, which is why the insecurity persists rather than fading.' },
      { kind: 'decision', lever: 'work', text: 'This is a decision point. Hickel’s proposal here is a public job guarantee, so the threat of unemployment loses its force. Flip it and watch which boxes change, and in what order.' },
      { kind: 'end', text: 'That was one cycle inside one plane. Workers (North) sits on others too, including one that runs through the far right. The map is yours now.' },
    ],
  },
  build: {
    title: 'Who decides what gets built?',
    steps: [
      { kind: 'intro', node: 'capital', text: 'Whoever controls investment decides what an economy makes. Here that is capital. Follow the money.' },
      { kind: 'flow', flow: 'profit_filter', text: 'One rule sorts every investment.' },
      { kind: 'flow', flow: 'inv_luxury', predict: { q: 'If investment follows profit, what gets overproduced?', options: ['luxury', 'necessities'] } },
      { kind: 'flow', flow: 'returns_luxury' },
      { kind: 'loop', loop: 'loop_accumulation', text: 'Profit decides investment, and investment makes more profit. The same rule meets the same answer every turn.' },
      { kind: 'flow', flow: 'profit_filter', text: 'Same rule, a different choice: energy.' },
      { kind: 'flow', flow: 'inv_fossil', predict: { q: 'Renewables are now cheaper than fossil fuels. Which gets the heavy investment?', options: ['fossil', 'renewables'] } },
      { kind: 'flow', flow: 'returns_fossil' },
      { kind: 'loop', loop: 'loop_fossil_lockin', text: 'A second cycle on the same rule, and this one reaches into nature.' },
      { kind: 'decision', lever: 'invest', text: 'The decision here is who decides investment. Hickel’s alternative is democratically agreed goals funded through public finance, not profitability. Flip it.' },
      { kind: 'end', text: 'Both cycles ran through one decision. From here you can follow the renewables arrow, or see what happens to the ecosystem.' },
    ],
  },
  vote: {
    title: 'Why does voting change so little?',
    steps: [
      { kind: 'intro', node: 'citizens', text: 'Citizens vote. That is real democracy, but it lives in one plane.' },
      { kind: 'look', flow: 'vote_blocked', text: 'First, notice the arrow that never arrives.' },
      { kind: 'flow', flow: 'vote_politics' },
      { kind: 'flow', flow: 'state_serves', predict: { q: 'Once in office, whose interests does a captured state serve?', options: ['capital', 'citizens', 'workers_north'] } },
      { kind: 'flow', flow: 'media_ownership', text: 'Capital’s reach does not stop at the state.' },
      { kind: 'flow', flow: 'hegemony', predict: { q: 'Who is the media talking to?', options: ['citizens', 'state', 'far_right'] } },
      { kind: 'loop', loop: 'loop_consent', text: 'Your vote went out and came back as consent.' },
      { kind: 'decision', lever: 'politics', text: 'The decision here is political power. Hickel’s answer is a mass democratic movement that wins power and taxes the rich. Flip it.' },
      { kind: 'end', text: 'Even with the movement in power, votes still stop at the edge of Power unless investment is democratized too: try the investment switch and follow the citizens’ arrows again.' },
    ],
  },
  wealth: {
    title: 'Where does the North’s wealth come from?',
    steps: [
      { kind: 'intro', node: 'south_workers', text: 'Start in the South, with the workers whose labor feeds Northern supply chains.' },
      { kind: 'flow', flow: 'drain_labor', text: 'This arrow crosses from the South into production in the North.' },
      { kind: 'flow', flow: 'surplus' },
      { kind: 'flow', flow: 'capture', predict: { q: 'Capital now holds the surplus. Where does it turn to keep the arrangement in place?', options: ['state', 'media', 'workers_north'] } },
      { kind: 'flow', flow: 'military_budget' },
      { kind: 'flow', flow: 'intervention', predict: { q: 'Where is that force aimed?', options: ['south_states', 'citizens', 'imf'] } },
      { kind: 'flow', flow: 'kept_cheap' },
      { kind: 'loop', loop: 'loop_imperial', text: 'Watch it cross between North and South, through force and trade, and end exactly where it began.' },
      { kind: 'decision', lever: 'empire', text: 'The decision here is the North–South arrangement. Hickel’s alternative is Southern sovereignty: development for the South’s own needs. Flip it and watch the touchpoint go quiet.' },
      { kind: 'end', text: 'With the drain closed, look at core workers: Hickel warns that without a movement at home, capital turns the squeeze on them instead. The map is yours.' },
    ],
  },
  fossil: {
    title: 'Why are we still burning fossil fuels?',
    steps: [
      { kind: 'intro', node: 'fossil', text: 'Start with fossil fuels. Today their condition reads entrenched. Follow their money.' },
      { kind: 'flow', flow: 'returns_fossil' },
      { kind: 'flow', flow: 'profit_filter' },
      { kind: 'flow', flow: 'inv_fossil', predict: { q: 'Renewables are cheaper. Where does the investment go?', options: ['fossil', 'renewables'] } },
      { kind: 'loop', loop: 'loop_fossil_lockin', text: 'Cheaper is not enough: the rule picks what pays more, and the profits fund the next round.' },
      { kind: 'flow', flow: 'emissions_fossil', text: 'Now follow what burning them does.' },
      { kind: 'flow', flow: 'degradation_south', predict: { q: 'The atmosphere is shared. Where does the damage land hardest?', options: ['south_nature', 'capital', 'luxury'] } },
      { kind: 'decision', lever: 'invest', text: 'Back to the rule that started it: who decides investment. Flip it.' },
      { kind: 'end', text: 'Investment alone does not scale down energy use. Try the material-throughput switch at Less-necessary production too, and watch Earth.' },
    ],
  },
}

/** Drives a story on top of an App: the bar at the bottom of the map, prediction, travel, decisions. */
export class StoryController {
  app: App
  id: string | null = null
  i = 0
  answers = new Map<number, string>()
  snapshots = new Map<number, { cfg: LeverConfig; trail: App['trail'] }>()
  private ticker = 0

  constructor(app: App) {
    this.app = app
    app.hasStories = true
    app.onEntry = (id) => (STORIES[id] ? (this.start(id), true) : false)
    app.storyBar.addEventListener('click', (e) => this.onClick(e))
    // levers flipped from the bar: refresh the bar once the app has updated
    document.addEventListener('click', (e) => {
      if (this.id && (e.target as Element).closest('#story [data-lever]')) requestAnimationFrame(() => this.render())
    })
  }

  get story() {
    return this.id ? STORIES[this.id] : null
  }
  get step(): Step | null {
    return this.story?.steps[this.i] ?? null
  }

  start(id: string) {
    this.id = id
    this.answers.clear()
    this.snapshots.clear()
    this.app.storyActive = true
    this.app.hideToast()
    this.app.trail = []
    this.app.setWorld(configFor('today'))
    this.enter(0)
  }
  exit() {
    clearInterval(this.ticker)
    this.id = null
    this.app.storyActive = false
    this.app.quiz = false
    this.app.storyBar.hidden = true
    document.body.classList.remove('in-story')
    // land on the last box, ready to explore
    const last = this.app.trail[this.app.trail.length - 1]
    if (last) this.app.go({ kind: 'node', node: last.node })
  }

  private enter(i: number, restoring = false) {
    clearInterval(this.ticker)
    this.i = i
    const app = this.app
    if (!restoring) this.snapshots.set(i, { cfg: { ...app.cfg }, trail: [...app.trail] })
    const s = this.step!
    app.quiz = s.kind === 'flow' && !!s.predict && !this.answers.has(i)
    if (s.kind === 'intro') app.go({ kind: 'node', node: s.node })
    if (s.kind === 'flow' && (!s.predict || this.answers.has(i))) this.travel(s.flow)
    if (s.kind === 'flow' && s.predict && !this.answers.has(i)) {
      const f = flowById.get(s.flow)!
      app.go({ kind: 'node', node: f.from })
    }
    if (s.kind === 'look') app.go({ kind: 'flow', flow: s.flow })
    if (s.kind === 'loop') {
      app.go({ kind: 'loop', loop: s.loop, step: 0 })
      const n = loopById.get(s.loop)!.path.length
      if (app.motion)
        this.ticker = window.setInterval(() => {
          const m = app.mode
          if (m.kind === 'loop') app.go({ ...m, step: (m.step + 1) % n })
        }, 1600)
    }
    if (s.kind === 'decision') {
      const h = app.model.leverHome[s.lever]
      app.go('gate' in h ? { kind: 'gate', gate: h.gate } : { kind: 'node', node: h.node })
    }
    if (s.kind === 'end') {
      const last = app.trail[app.trail.length - 1]
      if (last) app.go({ kind: 'node', node: last.node })
    }
    document.body.classList.add('in-story')
    this.render()
  }

  private travel(flowId: string) {
    const f = flowById.get(flowId)!
    const app = this.app
    const last = app.trail[app.trail.length - 1]
    if (!last || last.node !== f.from) app.trail.push({ node: f.from })
    app.go({ kind: 'node', node: f.to }, { via: f.id })
  }

  private back() {
    if (this.i === 0) return
    const prev = this.i - 1
    const snap = this.snapshots.get(prev)
    if (snap) {
      this.app.setWorld(snap.cfg)
      this.app.trail = [...snap.trail]
    }
    this.enter(prev, true)
  }

  private onClick(e: Event) {
    const t = e.target as Element
    const el = t.closest<HTMLElement>('[data-story]')
    if (!el) return
    const act = el.dataset.story!
    if (act === 'next') return this.enter(Math.min(this.i + 1, this.story!.steps.length - 1))
    if (act === 'back') return this.back()
    if (act === 'exit') return this.exit()
    if (act === 'another') {
      this.exit()
      return this.app.renderStart()
    }
    if (act.startsWith('answer:')) {
      this.answers.set(this.i, act.slice(7))
      this.app.quiz = false
      const s = this.step
      if (s?.kind === 'flow') this.travel(s.flow)
      this.render()
    }
  }

  render() {
    const bar = this.app.storyBar
    const story = this.story
    const s = this.step
    if (!story || !s) {
      bar.hidden = true
      return
    }
    const n = story.steps.length
    const dots = story.steps.map((_, k) => `<span class="sdot${k < this.i ? ' done' : k === this.i ? ' cur' : ''}"></span>`).join('')
    const nav = (nextLabel = 'Next →', nextOk = true) =>
      `<div class="story-nav"><button type="button" class="pill" data-story="back"${this.i === 0 ? ' disabled' : ''}>← Back</button>
        <span class="muted small">${this.i + 1} / ${n}</span>
        <button type="button" class="pill solid" data-story="next"${nextOk ? '' : ' disabled'}>${nextLabel}</button></div>`
    let body = ''
    if (s.kind === 'intro') {
      body = `<p class="story-text">${esc(s.text)}</p>${this.app.statusHtml(s.node)}${nav('Start walking →')}`
    } else if (s.kind === 'flow') {
      const f = flowById.get(s.flow)!
      const answer = this.answers.get(this.i)
      if (s.predict && !answer) {
        body = `<div class="predict"><div class="eyebrow">Your guess</div><p class="story-q">${esc(s.predict.q)}</p>
          <div class="options">${s.predict.options.map((o) => `<button type="button" class="option" data-story="answer:${o}">${esc(label(o))}</button>`).join('')}</div></div>${nav('Next →', false)}`
      } else {
        const verdict = s.predict
          ? answer === f.to
            ? `<div class="verdict yes">Yes. In Hickel’s account it goes to <strong>${esc(label(f.to))}</strong>.</div>`
            : `<div class="verdict no">Not in Hickel’s account: it goes to <strong>${esc(label(f.to))}</strong>.</div>`
          : ''
        body = `${verdict}${s.text ? `<p class="story-text">${esc(s.text)}</p>` : ''}
          <div class="story-arrow"><span>${esc(label(f.from))}</span><span class="sa-label">${esc(f.label)} ⟶</span><span>${esc(label(f.to))}</span></div>
          <p class="small">${esc(f.description)}</p>${links(f.sources)}${this.landing(f.to)}${nav()}`
      }
    } else if (s.kind === 'look') {
      const f = flowById.get(s.flow)!
      body = `<p class="story-text">${esc(s.text)}</p><div class="story-arrow blocked"><span>${esc(label(f.from))}</span><span class="sa-label">${esc(f.label)} ✕</span><span>${esc(label(f.to))}</span></div>
        <p class="small">${esc(f.description)}</p>${links(f.sources)}${nav()}`
    } else if (s.kind === 'loop') {
      const l = loopById.get(s.loop)!
      this.app.traced.add(l.id)
      body = `<div class="loop-reveal tone-${l.tone}"><span class="lr-glyph">↻</span><div><div class="eyebrow">Cycle closed · ${l.tone} · ${l.kind}</div><div class="rp-title">${esc(l.label)}</div></div></div>
        <p class="story-text">${esc(s.text)}</p><p class="small">${esc(l.description)}</p>${links(l.sources)}${nav()}`
    } else if (s.kind === 'decision') {
      const lever = this.app.cfg[s.lever]
      const flipped = this.app.lastRipple?.lever === s.lever && lever
      body = `<p class="story-text">${esc(s.text)}</p>${this.app.switchHtml(s.lever)}
        ${flipped ? `<div class="ripple-box">${this.app.lastRipple!.html}</div>` : '<p class="small muted">Flip the switch to continue, or skip ahead.</p>'}${nav(flipped ? 'Next →' : 'Skip →')}`
    } else {
      body = `<p class="story-text">${esc(s.text)}</p>
        <div class="story-nav"><button type="button" class="pill" data-story="back">← Back</button>
        <button type="button" class="pill" data-story="another">Another question</button>
        <button type="button" class="pill solid" data-story="exit">Explore from here →</button></div>`
    }
    bar.innerHTML = `<div class="story-head"><div class="eyebrow">Story · ${esc(story.title)}</div><div class="sdots" aria-hidden="true">${dots}</div>
      <button type="button" class="story-x" data-story="exit" aria-label="Leave the story">×</button></div>${body}`
    bar.hidden = false
  }

  /** The condition of the box an arrow lands on, as a single line. */
  private landing(id: string) {
    const n = nodeById.get(id)!
    if (!n.condition) return ''
    const lv = this.app.levels.get(id) ?? 0
    return `<div class="landing"><span class="lg-sw ${lvClass(lv)}"></span>${esc(n.label)}: <strong>${esc(levelWord(id, lv))}</strong></div>`
  }
}
