# Design direction

The one page to read before changing how the site looks. The decisions behind it are in [DECISIONS.md](DECISIONS.md) (ADR-22, ADR-24); the
mandatory rules for any screen real people use are in [CLAUDE.md](CLAUDE.md). The tokens live in `src/app/tokens.css`, the choices and
exceptions are stamped at the top of `src/app/globals.css`.

## Who it is for

Players in Jabodetabek (and online) who want to find a tabletop game this week, and the Game Masters who run them. Most arrive on a phone,
from a WhatsApp link or a search, read Indonesian or English, and have a few seconds of patience. The page's job is one thing: *attend*.
Find a game, read when and where, message the GM. The site takes no bookings and no money, and the design must never suggest it does.

## Visual language: Halftone

A printed playbill, not a fantasy tavern (the wood, parchment and gold look was dropped in ADR-22).

- **Stock and ink.** A butter-cream paper, a brown-black ink, and one vermilion accent. Nothing else carries colour except the listings' own cover art.
  A dark stock is derived from the light one: the hue never moves, the accent loses chroma and gains lightness. The OS preference decides unless the
  person picks a theme (`html[data-theme]`).
- **Type.** Ultra (a heavy slab serif) for display and titles only; Chivo for everything people read. Sizes come from the token scale; 14 px is the
  smallest text anywhere. Running text stays near 65 characters wide.
- **Shape.** Square wells and photographs (radii 0 to 3 px), ruled lines instead of boxes, a dot screen (`.halftone`) as the only decoration.
  No icons beside labels; the brand marks and genre icons stay.
- **Signature.** Each game is a playbill: its cover over a ruled label panel. Listings show their own art; there is no stock photography.
- **Layout.** Home is a Corridor (hero), a Rail of the soonest games, an Index of genres, Rows for beginners and a closing band for Game Masters.
  Inner pages open straight on their list, listing or form under the masthead (no hero stage). A game page is a Split Studio: cover beside the facts.

## The three dials

| Dial | Setting | In practice |
|---|---|---|
| Energy | committed, playful | one loud accent, big display type, but plain reading text and plain words |
| Rhythm | open, ruled | generous space between sections, hairline rules inside them, cards only where an object is meant (a game) |
| Motion | almost none | focus and hover states only; nothing animates in; `prefers-reduced-motion` is respected |

## Rules that follow from it

1. One accent. A second colour needs a reason written here.
2. Real content over templates: no three-step explainers, stat tiles or testimonial rows on the home page. How it works has its own page.
3. Every control is at least 44 px in both directions; labels sit above fields; focus is always visible.
4. Both languages are first class. Indonesian copy is written, not translated word for word, and can run longer: nothing may be clipped.
5. No em dashes in copy or emails.
6. The first screen on a phone shows what the page is for (a game, a list, a form), not a banner.

## Exceptions on the record

Four Hallmark checks are waived on purpose; each is stamped in `src/app/globals.css` and explained here so the next person knows they are
decisions and not oversights.

| Check | Why it is waived |
|---|---|
| 44c, 79 | The inner pages have no hero stage: the list, listing or form starts right under the masthead, so there is no empty first screen to fill and no dead band under the masthead. |
| 77 | A listing's about, schedule and safety rows are plain reading text beside their heads, set as one ruled list across the page. |
| 78 | The games list has no section heads: each listing's title is its own `h2` inside its link, set at item size so four fit across. |

## How to change it

Change a token in `tokens.css` before changing a component. Check both stocks (light and dark) and both languages at a 400 px width. Run
`npm run preview` and `node scripts/audit-frontend.mjs` (see [docs/anti-slop-audit.md](docs/anti-slop-audit.md)) to re-measure the rules that can be measured.
