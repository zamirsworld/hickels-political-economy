// Reads the local (git-ignored) subtitle files in txt_sources/srt/ and finds when a phrase is spoken.
// Supports SRT ("00:00:01,520 --> 00:00:03,560") and NoteGPT ("00:00:00 - 00:00:03") formats.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Episode, EpisodeId } from '../src/model/types.ts'

export type Cue = { start: number; end: number; text: string }

const ROOT = new URL('..', import.meta.url).pathname
export const SUBTITLE_DIR = join(ROOT, 'txt_sources', 'srt')

export function toSeconds(t: string): number {
  return t.split(':').map(Number).reduce((acc, n) => acc * 60 + n, 0)
}

export function formatTime(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  const mm = String(m).padStart(h ? 2 : 1, '0')
  return `${h ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`
}

export function parseCues(path: string): Cue[] {
  const lines = readFileSync(path, 'utf8').replace(/^\uFEFF/, '').replace(/\r/g, '').split('\n')
  const cues: Cue[] = []
  for (let i = 0; i < lines.length; i++) {
    const m =
      lines[i].match(/^(\d\d:\d\d:\d\d)[,.]\d+ --> (\d\d:\d\d:\d\d)[,.]\d+/) ?? // SRT
      lines[i].match(/^(\d\d:\d\d:\d\d) - (\d\d:\d\d:\d\d)$/) // NoteGPT
    if (!m) continue
    const text: string[] = []
    for (let j = i + 1; j < lines.length && lines[j].trim() !== '' && !/^\d+$/.test(lines[j].trim()); j++) text.push(lines[j].trim())
    if (text.length) cues.push({ start: toSeconds(m[1]), end: toSeconds(m[2]), text: text.join(' ') })
  }
  return cues
}

const normalize = (s: string) =>
  s.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim()

/** Builds a searcher over the joined cue text; returns start times (seconds) of every match. */
export function makeSearcher(cues: Cue[]) {
  let joined = ''
  const owner: number[] = [] // char index -> cue index
  cues.forEach((cue, i) => {
    const t = normalize(cue.text) + ' '
    joined += t
    for (let k = 0; k < t.length; k++) owner.push(i)
  })
  return (phrase: string): number[] => {
    const p = normalize(phrase)
    const hits: number[] = []
    for (let at = joined.indexOf(p); at !== -1; at = joined.indexOf(p, at + 1)) hits.push(cues[owner[at]].start)
    return hits
  }
}

/** One searcher per episode whose subtitle file exists locally. */
export function loadSearchers(episodes: Episode[]) {
  const searchers = new Map<EpisodeId, (phrase: string) => number[]>()
  const missing: EpisodeId[] = []
  for (const ep of episodes) {
    const path = join(SUBTITLE_DIR, ep.subtitles)
    if (existsSync(path)) searchers.set(ep.id, makeSearcher(parseCues(path)))
    else missing.push(ep.id)
  }
  return { searchers, missing }
}

// CLI: node scripts/subtitles.ts [--ep BF2] "phrase one" "phrase two" ...
if (import.meta.url === `file://${process.argv[1]}`) {
  const model = JSON.parse(readFileSync(join(ROOT, 'annotations', 'system.json'), 'utf8'))
  const args = process.argv.slice(2)
  const epIdx = args.indexOf('--ep')
  const only = epIdx >= 0 ? args.splice(epIdx, 2)[1] : null
  const episodes: Episode[] = model.meta.episodes.filter((e: Episode) => !only || e.id === only)
  const { searchers, missing } = loadSearchers(episodes)
  if (missing.length) console.error(`(no subtitle file for: ${missing.join(', ')})`)
  for (const phrase of args) {
    const found = [...searchers].map(([id, search]) => [id, search(phrase)] as const).filter(([, hits]) => hits.length)
    console.log(
      `${found.length ? found.map(([id, hits]) => `${id} ${hits.map(formatTime).join(', ')}`).join(' | ') : 'NOT FOUND'}  ←  "${phrase}"`,
    )
  }
}
