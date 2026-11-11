// Scrollytelling: the ring stays pinned on the left while the steps scroll past on the right. Each step that
// reaches the middle of the screen draws its arrow; the closing sections run the loop and then flip its switch.
// The cycle comes from ?c=.
import '../../shared/base.css'
import '../cycles.css'
import './style.css'
import { breakHtml, closedHtml, countUp, introHtml, pickerHtml, stepHtml, themeToggle } from '../cards.ts'
import { Cycle, legendHtml } from '../diagram.ts'
import { CYCLES, current } from '../scripts/index.ts'

const c = current()
const N = c.steps.length
document.title = `${c.short} · Story`

const app = document.getElementById('app')!
app.innerHTML = `
  <div class="progress"><i></i></div>
  <header class="bar">
    <a class="sub" href="../">← all cycles</a>
    ${pickerHtml(CYCLES, c)}
    <span class="sub mode">the story · <a href="../guess/?c=${c.slug}">guess as you go instead</a></span>
    <span class="grow"></span>
    <button type="button" class="ghost" id="theme"></button>
  </header>
  <section class="hero" data-step="-1">
    <div class="hero-inner">${introHtml(c)}</div>
    <div class="cue" aria-hidden="true">Scroll down to follow the cycle <span>↓</span></div>
  </section>
  <div class="story">
    <div class="pin"><div class="dia">${legendHtml(c)}</div></div>
    <div class="steps">
      ${c.steps.map((s, i) => `<section class="step" data-step="${i}"><div class="panel">${stepHtml(s)}</div></section>`).join('')}
      <section class="step" data-step="${N}"><div class="panel">${closedHtml(c, (i) => `data-jump="${i}"`)}</div></section>
      <section class="step last" data-step="${N + 1}"><div class="panel">${breakHtml(c)}<p class="end-links"><a class="pill quiet" href="../guess/?c=${c.slug}">Now try guessing each step</a><a class="pill quiet" href="../">Pick another cycle</a></p></div></section>
    </div>
  </div>`
themeToggle(document.getElementById('theme') as HTMLButtonElement)
document.getElementById('pick-cycle')!.addEventListener('change', (e) => {
  location.search = `?c=${(e.target as HTMLSelectElement).value}`
})
const cycle = new Cycle(app.querySelector('.dia')!, c)
countUp(app.querySelector('.hero')!)

let active = -2
const counted = new Set<Element>()
function activate(step: number, el: Element) {
  if (step === active) return
  active = step
  app.querySelectorAll('.step').forEach((s) => s.classList.toggle('active', s === el))
  const sw = app.querySelector<HTMLButtonElement>('[data-break]')!
  cycle.set(Math.min(step, N))
  cycle.setBroken(step === N + 1 && sw.getAttribute('aria-checked') === 'true')
  if (!counted.has(el)) {
    counted.add(el)
    countUp(el)
  }
}
// a section counts as current when it crosses the middle band of the screen
const io = new IntersectionObserver(
  (entries) => {
    for (const e of entries) if (e.isIntersecting) activate(Number((e.target as HTMLElement).dataset.step), e.target)
  },
  { rootMargin: '-45% 0px -45% 0px' },
)
app.querySelectorAll('.step, .hero').forEach((s) => io.observe(s))

const bar = app.querySelector<HTMLElement>('.progress i')!
addEventListener(
  'scroll',
  () => {
    const max = document.documentElement.scrollHeight - innerHeight
    bar.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`
  },
  { passive: true },
)

app.addEventListener('click', (e) => {
  const t = e.target as HTMLElement
  const jump = t.closest<HTMLElement>('[data-jump]')
  if (jump) app.querySelector(`.step[data-step="${jump.dataset.jump}"]`)!.scrollIntoView({ behavior: 'smooth', block: 'center' })
  const sw = t.closest<HTMLButtonElement>('[data-break]')
  if (sw) {
    const on = sw.getAttribute('aria-checked') !== 'true'
    sw.setAttribute('aria-checked', String(on))
    cycle.setBroken(on)
  }
})
