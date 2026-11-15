// What the reader has finished (kept in this browser only), the steps cycles share, and the link from a cycle
// to the same loop on the map.
import { LEVER_ORDER } from '../model/levers.ts'
import { esc, virtuous, type CycleScript, type Step } from './model.ts'
import { CYCLES } from './scripts/index.ts'

const KEY = 'cycles-done'
export function doneCycles(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
  } catch {
    return [] // storage unavailable
  }
}
export function markDone(slug: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...new Set([...doneCycles(), slug])]))
  } catch {
    /* storage unavailable */
  }
}

/**
 * A note on a step that other cycles also contain (the same arrow), so the repeat reads as a link between them.
 * `page` is the page to link to: the guess or the story version.
 */
export function sharedNote(c: CycleScript, step: Step, page: 'guess' | 'scroll') {
  const others = CYCLES.filter((x) => x !== c && x.steps.some((s) => s.flow.id === step.flow.id))
  if (!others.length) return ''
  const done = doneCycles()
  const seen = others.filter((x) => done.includes(x.slug))
  const names = (xs: CycleScript[]) => {
    const links = xs.map((x) => `<a href="../${page}/?c=${x.slug}">${esc(x.title)}</a>`)
    return links.length > 1 ? `${links.slice(0, -1).join(', ')} and ${links[links.length - 1]}` : links[0]
  }
  return seen.length
    ? `<p class="shared-step"><b>You have met this step before,</b> in ${names(seen)}. It is the same arrow here: the cycles share it.</p>`
    : `<p class="shared-step"><b>A shared step.</b> The same arrow is part of ${names(others)}.</p>`
}

/** The same loop on the map; a hopeful cycle opens with the switches it needs turned on. */
export function mapHref(c: CycleScript) {
  const on = virtuous(c) ? c.end.levers : []
  const lv = on.length ? `&lv=${LEVER_ORDER.map((id) => (on.includes(id) ? 1 : 0)).join('')}` : ''
  return `../../#loop=${c.loop.id}${lv}`
}
