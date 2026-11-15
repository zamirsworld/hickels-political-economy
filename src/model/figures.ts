// How each figure's numbers were checked, in plain words. Shown on every figure card, on the map and in the cycles.
import type { Figure } from './types.ts'

const CHECKED: Record<Figure['verification'], string> = {
  'full-text': 'Checked against the full text of the source.',
  abstract: 'Checked against the source’s abstract only, not its full text.',
  secondary: 'Checked against a secondary account (a summary, review or news report), not the full source.',
}
export const checkedHow = (f: Pick<Figure, 'verification'>) => CHECKED[f.verification]
