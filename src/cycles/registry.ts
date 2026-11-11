// The guided cycles in brief: loop id, page slug, title and opening question. Kept free of imports so the map's
// opening card and cycle panel can offer the walk-throughs without loading them; scripts/index.ts checks it
// against the real scripts.
export const CYCLE_CARDS: { slug: string; loop: string; title: string; question: string }[] = [
  { slug: 'drain', loop: 'loop_imperial', title: 'The Imperial drain', question: 'Where does the rich world’s wealth come from?' },
  { slug: 'debt', loop: 'loop_debt', title: 'Debt & structural adjustment', question: 'How did debt pull poorer countries back down?' },
  { slug: 'unequal', loop: 'loop_unequal_exchange', title: 'Unequal exchange', question: 'How can ordinary trade drain poorer countries?' },
  { slug: 'fossil', loop: 'loop_fossil_lockin', title: 'Fossil lock-in', question: 'Clean energy is cheaper. Why does the money still go to fossil fuels?' },
  { slug: 'discipline', loop: 'loop_discipline', title: 'The Discipline loop', question: 'Why do people keep working on terms they don’t set?' },
  { slug: 'war', loop: 'loop_war_profits', title: 'War profits', question: 'Why is there money for weapons but not for public services?' },
  { slug: 'consent', loop: 'loop_consent', title: 'The Consent loop', question: 'Why do people accept a system that works against them?' },
  { slug: 'mass-party', loop: 'loop_mass_party', title: 'The Mass party loop', question: 'How could ordinary people take back control?' },
]

/** Loop id → page slug, for the map's “walk me through this cycle” links. */
export const WALKTHROUGHS: Record<string, string> = Object.fromEntries(CYCLE_CARDS.map((c) => [c.loop, c.slug]))
