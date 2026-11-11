# Hickel's Political Economy

An interactive, cited map of the political economy Jason Hickel describes across five talks and interviews: how decisions get made, who controls production, how labor and nature move from the Global South to the Global North, and what a democratic alternative could look like.

**Live site:** https://zamirsworld.github.io/hickels-political-economy/

- **The map** (`/`): capital, the state, labor, empire and the ecosystem as boxes and arrows, with feedback loops, seven on/off switches and a ripple of vicious ↔ virtuous conditions.
- **Guided cycles** (`/cycles/`): eight major cycles told step by step, either as a story or as a guess-and-reveal game, written for readers new to the subject.

## Sources

Every box and arrow cites a timestamp in one of these talks:

| ID | Talk | Venue |
|---|---|---|
| BF1 | [Why Capitalism Can't Save Us](https://www.youtube.com/watch?v=MU1QdQsjGpM) | Better Future Podcast, ep. 003 |
| BF2 | [How to Overcome Capitalism](https://www.youtube.com/watch?v=X5WU51sVn3Y) | Better Future Podcast |
| FACTO | [Why Jason Hickel Now Thinks Capitalism Can't Save the Climate](https://www.youtube.com/watch?v=ejsHXeds6Y0) | Studio Fakto |
| BERGEN | [The struggle for development in the 21st century](https://www.youtube.com/watch?v=wRQeC65hHfA) | Lecture, Bergen Global |
| TEA | [When Both Parties Serve the Rich, What Are You Voting For?](https://www.youtube.com/watch?v=HoxXswIyre8) | The Tea with Dr Myriam François |

Material that isn't Hickel's is kept visibly separate:

- **Figures from other sources** carry a "non-Hickel source" badge and say how they were checked.
- **Outside voices** (talks by others: MEAR, FINK, IAI) are shown under the speaker's name. Anything resting only on them is drawn dashed and never feeds the ripple.

The site paraphrases the talks and uses only short quotes with timestamps. It is an independent project, not affiliated with Jason Hickel.

## Develop

```bash
npm install
npm run dev
```

Code: the map in `src/map/` and `src/shared/`; the guided cycles in `src/cycles/` (pages in `cycles/`).

## Data

The model is hand-edited in `annotations/` and built into `src/data/system.json`:

```bash
npm run data                          # validate annotations and rebuild src/data/system.json
npm run lookup -- "some phrase"       # find when a phrase is said, in every talk (needs local subtitles)
npm run lookup -- --ep BF2 "phrase"   # … in one talk only (BF1, BF2, FACTO, BERGEN, TEA, MEAR, FINK, IAI)
```

Transcripts and subtitles are third-party material and are not included. If you place them in `txt_sources/`, `npm run data` also checks every source timestamp against its talk's subtitles (within ±5 s).

Before committing, run `npm run data`, `npx tsc --noEmit` and `npm run build`.

## Deploy

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds and publishes `dist/` to GitHub Pages.
One-time setup: in the GitHub repo, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
