// Step content as HTML, shared by both presentations.
import { esc, figCite, label, sourceChips, type CycleScript, type Note, type Stat, type Step } from './model.ts'

const stats = (ss: Stat[]) =>
  `<div class="stats">${ss.map((s) => `<div class="stat"><div class="v"><span data-count="${esc(s.value)}">${esc(s.value)}</span> <span class="u">${esc(s.unit)}</span></div><div class="c">${esc(s.caption)}</div></div>`).join('')}</div>
   ${[...new Set(ss.map((s) => s.fig))].map(figCite).join('')}`

const noteHtml = (n: Note, cls = 'aside') => `<div class="${cls}"><span class="lbl">${esc(n.title)}</span>${esc(n.text)}${sourceChips(n.sources)}</div>`

export function introHtml(c: CycleScript) {
  const I = c.intro
  return `<div class="kicker">${esc(I.kicker)}</div>
    <h1 class="big-q">${esc(I.title)}</h1>
    <p class="text">${esc(I.body)}</p>
    ${sourceChips(I.sources)}
    ${I.stats ? stats(I.stats) : ''}
    <p class="text lead">${esc(I.lead)}</p>`
}

/** The arrow itself: from → to, with its kind. */
export const routeHtml = (s: Pick<Step, 'flow'>) =>
  `<div class="route kind-${s.flow.kind}"><span class="kind-tag">${esc(s.flow.kind)}</span><b>${esc(label(s.flow.from))}</b> → <b>${esc(label(s.flow.to))}</b></div>`

export function stepHtml(s: Step, opts: { route?: boolean } = {}) {
  return `<div class="kind-${s.flow.kind}">
    <div class="kicker">${esc(s.kicker)}</div>
    <h2 class="step-title">${esc(s.title)}</h2>
    ${opts.route === false ? '' : routeHtml(s)}
    <p class="text">${esc(s.body)}</p>
    ${s.examples ? `<ol class="timeline">${s.examples.map((e, i) => `<li style="animation-delay:${0.15 + i * 0.12}s" title="${esc(e.description)}"><b>${esc(e.year)}</b>${esc(e.label.replace(/^Coup against |^Assassination of /, ''))}</li>`).join('')}</ol>` : ''}
    ${s.stats ? stats(s.stats) : ''}
    <div class="why"><span class="lbl">Why it matters</span>${esc(s.why)}</div>
    <div class="hickel-says">Hear Hickel say it:</div>
    ${sourceChips(s.sources)}
    ${s.aside ? noteHtml(s.aside) : ''}
  </div>`
}

/** The loop closed: its summary and the steps as a recap; `attrs` makes each step a link back to it. */
export function closedHtml(c: CycleScript, attrs: (i: number) => string) {
  return `<div class="kicker">Back to the start</div>
    <h2 class="step-title">And round it goes again</h2>
    <p class="text">${esc(c.summary)}</p>
    <ol class="recap">${c.steps.map((s, i) => `<li><button type="button" ${attrs(i)}><span class="n">${i + 1}</span><span><b>${esc(s.title)}</b><small>${esc(label(s.flow.from))} → ${esc(label(s.flow.to))}</small></span></button></li>`).join('')}</ol>
    ${sourceChips(c.loop.sources)}`
}

export function breakHtml(c: CycleScript) {
  const E = c.end
  return `<div class="kicker">${esc(E.kicker)}</div>
    <h2 class="step-title">${esc(E.title)}</h2>
    <p class="text">${esc(E.body)}</p>
    ${sourceChips(E.sources)}
    <div class="switch-row">
      <button type="button" class="toggle" role="switch" aria-checked="false" data-break aria-label="${esc(E.toggle.label)}"></button>
      <span class="lbl"><b>${esc(E.toggle.label)}</b><span>${esc(E.toggle.hint)}</span></span>
    </div>
    ${(E.notes ?? []).map((n) => `<div class="pushback"><b>${esc(n.title)}</b> ${esc(n.text)}${sourceChips(n.sources)}</div>`).join('')}`
}

/** Counts a stat up from zero when it comes into view (numbers only; text values stay as they are). */
export function countUp(root: ParentNode) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  root.querySelectorAll<HTMLElement>('.stat [data-count]').forEach((el) => {
    const m = el.dataset.count!.match(/^([^\d]*)([\d.,]+)(.*)$/)
    if (!m) return
    const target = Number(m[2].replace(/,/g, ''))
    if (!Number.isFinite(target)) return
    const decimals = (m[2].split('.')[1] ?? '').length
    const t0 = performance.now()
    const frame = (now: number) => {
      const t = Math.min(1, (now - t0) / 1200)
      const v = target * (1 - (1 - t) ** 3)
      el.textContent = `${m[1]}${v.toLocaleString('en', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${m[3]}`
      if (t < 1) requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  })
}

/** Theme switch shared by the pages; remembered with the map's choice. */
export function themeToggle(btn: HTMLButtonElement) {
  const set = (t: string) => {
    document.documentElement.dataset.theme = t
    btn.textContent = t === 'orrery' ? 'Paper theme' : 'Night theme'
    try {
      localStorage.setItem('proto-theme', t)
    } catch {
      /* storage unavailable */
    }
  }
  let t = 'orrery'
  try {
    t = localStorage.getItem('proto-theme') === 'transit' ? 'transit' : 'orrery'
  } catch {
    /* storage unavailable */
  }
  set(t)
  btn.addEventListener('click', () => set(document.documentElement.dataset.theme === 'orrery' ? 'transit' : 'orrery'))
}

/** The header's cycle picker: a menu of the other walk-throughs in the same presentation. */
export function pickerHtml(all: CycleScript[], current: CycleScript) {
  return `<label class="picker"><span class="sr-only">Choose a cycle</span><select id="pick-cycle">${all
    .map((c) => `<option value="${c.slug}"${c === current ? ' selected' : ''}>${esc(c.title)}</option>`)
    .join('')}</select></label>`
}
