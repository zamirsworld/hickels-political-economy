// The cycle picker: every guided cycle as a card, grouped by theme, each with a small ring and both ways in.
import '../shared/base.css'
import './cycles.css'
import './gallery.css'
import { themeToggle } from './cards.ts'
import { miniRing } from './diagram.ts'
import { esc, loop, virtuous, type CycleScript } from './model.ts'
import { CYCLES } from './scripts/index.ts'

const groups = [...new Set(CYCLES.map((c) => c.group))]

function card(c: CycleScript) {
  const questions = c.extras.length + c.steps.length + 1
  const folds = (c.folds ?? []).map((id) => loop(id).label.replace(/ loop$/, ''))
  return `<article class="cy-card${virtuous(c) ? ' virtuous' : ''}">
    ${miniRing(c)}
    <div class="cy-body">
      <div class="cy-meta"><span class="tone">${virtuous(c) ? '↻ a hopeful cycle' : '↻ a vicious cycle'}</span> · ${c.steps.length} steps · ${questions} questions</div>
      <h2>${esc(c.title)}</h2>
      <p>${esc(c.blurb)}</p>
      ${folds.length ? `<p class="folds">Also covers: ${folds.map(esc).join(', ')}</p>` : ''}
      <div class="cy-links">
        <a class="pill" href="./guess/?c=${c.slug}">Guess as you go</a>
        <a class="pill quiet" href="./scroll/?c=${c.slug}">Read the story</a>
      </div>
    </div>
  </article>`
}

const app = document.getElementById('app')!
app.innerHTML = `
  <header class="bar">
    <a class="sub" href="../">← the map</a>
    <span class="title">Guided cycles</span>
    <span class="grow"></span>
    <button type="button" class="ghost" id="theme"></button>
  </header>
  <main class="gallery">
    <div class="eyebrow">Step by step through Jason Hickel’s ideas</div>
    <h1>Pick a cycle to walk through</h1>
    <p class="lede">Each cycle is a chain of cause and effect that comes back to where it started, so it keeps feeding itself. Guess each next step yourself, or read it as a story while the circle draws itself. Every claim links to the moment Hickel says it, and figures from other sources are marked.</p>
    ${groups
      .map(
        (g) => `<section class="cy-group"><h3>${esc(g)}</h3><div class="cy-grid">${CYCLES.filter((c) => c.group === g)
          .map(card)
          .join('')}</div></section>`,
      )
      .join('')}
    <p class="muted small">The shorter loops on the map are told inside these walk-throughs rather than on their own. Every cycle can also be followed on the map.</p>
  </main>`
themeToggle(document.getElementById('theme') as HTMLButtonElement)
