// Every guided cycle, in gallery order, and the one the page's ?c= asks for.
import type { CycleScript } from '../model.ts'
import { CYCLE_CARDS } from '../registry.ts'
import { consent } from './consent.ts'
import { debt } from './debt.ts'
import { discipline } from './discipline.ts'
import { drain } from './drain.ts'
import { fossil } from './fossil.ts'
import { massParty } from './mass-party.ts'
import { unequal } from './unequal.ts'
import { war } from './war.ts'

export const CYCLES: CycleScript[] = [drain, debt, unequal, fossil, discipline, war, consent, massParty]

// the light registry (used by the map) must name the same cycles
for (const c of CYCLES) {
  const card = CYCLE_CARDS.find((x) => x.slug === c.slug)
  if (!card || card.loop !== c.loop.id || card.title !== c.title || card.question !== c.intro.title)
    throw new Error(`registry.ts is out of step with scripts/${c.slug}.ts (loop, title or opening question)`)
}

export function current(): CycleScript {
  const slug = new URLSearchParams(location.search).get('c')
  return CYCLES.find((c) => c.slug === slug) ?? CYCLES[0]
}
