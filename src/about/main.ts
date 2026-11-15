// The About page: what the site is, which talks it rests on, how claims are sourced, what is not Hickel's and how
// each figure was checked. The lists are drawn from the data, so they stay in step with the map.
import '../shared/base.css'
import '../cycles/cycles.css'
import '../cycles/gallery.css'
import './about.css'
import { themeToggle } from '../cycles/cards.ts'
import { data, esc } from '../cycles/model.ts'
import { checkedHow } from '../model/figures.ts'

const REPO = 'https://github.com/zamirsworld/hickels-political-economy'
const talkUrl = (e: { videoId?: string; url?: string }) => e.url ?? `https://www.youtube.com/watch?v=${e.videoId}`
const talks = data.meta.episodes.filter((e) => !e.outside)
const outside = data.meta.episodes.filter((e) => e.outside)
// counted as `npm run data` counts them: the source links on boxes, arrows, events, contrasts and cycles
const sources = [...data.nodes, ...data.flows, ...data.events, ...data.contrasts, ...data.loops].reduce((n, x) => n + x.sources.length, 0)
const NUM = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
const full = data.figures.filter((f) => f.verification === 'full-text').length

const talkRow = (e: (typeof talks)[number]) =>
  `<li><a href="${esc(talkUrl(e))}" target="_blank" rel="noopener">${esc(e.title)}</a><span class="muted small"> · ${esc(e.venue)} · cited as <b>${esc(e.id)}</b></span></li>`
const outsideRow = (e: (typeof outside)[number]) =>
  `<li><a href="${esc(talkUrl(e))}" target="_blank" rel="noopener">${esc(e.title)}</a><span class="muted small"> · ${esc(e.venue)} · cited as <b>${esc(e.id)}</b></span>
    ${e.verification ? `<p class="small muted how">How it was checked: ${esc(e.verification)}</p>` : ''}</li>`
const figRow = (f: (typeof data.figures)[number]) =>
  `<li><b>${esc(f.label)}</b> ${f.author === 'other' ? '<span class="badge-other">non-Hickel source</span>' : ''}
    <a class="fig-cite" href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.citation)}</a><span class="fig-check">${esc(checkedHow(f))}</span></li>`

const app = document.getElementById('app')!
app.innerHTML = `
  <header class="bar">
    <a class="sub" href="../">← the map</a>
    <span class="title">About</span>
    <span class="grow"></span>
    <a class="sub" href="../cycles/">guided cycles</a>
    <button type="button" class="ghost" id="theme"></button>
  </header>
  <main class="gallery about">
    <div class="eyebrow">About this site</div>
    <h1>A cited map of Jason Hickel’s political economy</h1>
    <p class="lede">This site draws the political economy Jason Hickel describes across ${NUM[talks.length] ?? talks.length} talks and interviews: who decides what gets produced, how labor and nature move from the Global South to the Global North, and what a democratic alternative could look like. It is an independent project and is not affiliated with Jason Hickel.</p>

    <h2>Two ways in</h2>
    <ul>
      <li><a href="../">The map</a>: ${data.nodes.length} boxes and ${data.flows.length} arrows, ${data.loops.length} cycles, and ${data.levers.length} on/off switches that show how the picture changes.</li>
      <li><a href="../cycles/">Guided cycles</a>: the major cycles told step by step, as a story or as a guessing game, for readers new to the subject.</li>
    </ul>

    <h2>The talks</h2>
    <p>Each point of Hickel’s on the site cites the moment in one of these talks where he makes it. A source link (▶) opens the talk at that time.</p>
    <ul class="talks">${talks.map(talkRow).join('')}</ul>

    <h2>How claims are sourced</h2>
    <ul>
      <li>The boxes, arrows and cycles carry ${sources} source links, each to a timestamp. Every timestamp is checked against the talk’s subtitles, to within five seconds.</li>
      <li>The text paraphrases the talks and quotes only a few words at a time. The wording, and the text that connects one point to the next, is ours.</li>
      <li>A cycle strings together points made at different moments, and each arrow cites its own. Drawing them as one loop is our way of showing how they connect; some descriptions flag where that joining goes beyond what the speakers say.</li>
    </ul>

    <h2>What is not Hickel’s</h2>
    <p>Material from anyone else is kept visibly separate.</p>
    <ul>
      <li><b>Figures from other sources</b> carry a “non-Hickel source” badge. An arrow that rests only on such figures is drawn dashed.</li>
      <li><b>Outside voices</b> are talks by other people, used for the boxes on global institutions. Their sources appear under the speaker’s name, never as Hickel’s. A box or arrow that rests only on them is drawn dashed, and they never feed the colors that spread across the map when a switch is flipped.</li>
    </ul>
    <ul class="talks">${outside.map(outsideRow).join('')}</ul>

    <h2>The figures, and how each was checked</h2>
    <p>${data.figures.length} figures back the numbers on the site. ${full} of them have been checked against the full text of their source; the rest against an abstract or a secondary account, as marked. Each figure card on the site carries the same note.</p>
    <ol class="figs">${data.figures.map(figRow).join('')}</ol>

    <h2>Corrections and code</h2>
    <p>The code and the data are public at <a href="${REPO}" target="_blank" rel="noopener">github.com/zamirsworld/hickels-political-economy</a>. If you find a mistake, please open an issue there.</p>
  </main>`
themeToggle(document.getElementById('theme') as HTMLButtonElement)
