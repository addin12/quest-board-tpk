# Design direction

The one page to read before changing how the site looks. The decisions behind it are in [DECISIONS.md](DECISIONS.md) (ADR-28, ADR-29); the
mandatory rules for any screen real people use are in [CLAUDE.md](CLAUDE.md). The tokens live in `src/app/tokens.css` and the dark stock in
`src/app/globals.css`, which also records the Hallmark waivers.

Design Read: a listing board for tabletop players in Jabodetabek and the Game Masters who run for them, in a **tavern at night** language:
oak, iron, parchment sheets nailed to a board, one lantern-amber accent. Dial: ENERGY 2 / RHYTHM 3 / MOTION 1.

## Who it is for

Players who want to find a tabletop game this week, and the Game Masters who run them. Most arrive on a phone, from a WhatsApp link or a search,
read Indonesian or English, and have a few seconds of patience. The page's job is one thing: *attend*. Find a game, read when and where,
message the GM. The site takes no bookings and no money, and the design must never suggest it does.

## The idea: a quest board in a tavern at night

The site is a tavern's notice board after dark. A game is a sheet of parchment nailed to oak; the board hangs under a signboard; the genres are
the chalkboard menu; the room is lit by one lantern. This is the literal thing the product is (a board of listings), so every tavern element is a
structure that does a job, not a decoration. Dark is the primary stock because the idea is a room at night (the brand reason, R-21); the light stock
is the same room by candlelight, a parchment page, and is chosen by the OS or the theme switch.

Halftone (ADR-22: cream stock, fat Ultra heads, red dot screen, heavy ruled bars) was dropped in ADR-29 at the owner's request. What stayed from the
earlier layers is structure: the beam and sign, the board and pinned sheets, the framed cover, the menu.

| Part | What it is | Why it is there (R-31) |
|---|---|---|
| **Beam and sign** (`.beam`, `.sign`) | A timber beam over every page with an iron rail; the wordmark is a signboard hung from it by two chains; the footer is the same beam | A tavern is found by its sign: the one identity motif, repeated at the foot |
| **Board** (`.board`) | Horizontal oak planks (CSS only: seams, a one-tone alternation, two grain lines at unrelated spacings) behind the home hero, the games and the closing call | The listings are notices; a wall of notices needs a wall. The texture is the material the notices hang on, not a background pattern |
| **Pinned sheet** (`.pin`) | A game as a parchment sheet with an iron nail, tilted 0.3 to 0.4 degrees in a repeating three, with the site's one shadow. The sheet is parchment with dark ink in both stocks. The closing call to Game Masters is a sheet too | Paper stands off the board (the elevation reason, R-12); the tilt breaks a grid of identical cards (R-14) without motion; light sheets are what makes a dark room read as lit |
| **Picture frame** (`.plate.frame`) | An oak frame around the cover on a game's own page | The listing's art hangs on the page; no other picture is framed |
| **Chalkboard menu** (`.menu`, `.leader`) | The genre index as a chalkboard in an oak frame, names in the display face, a dotted leader to the count | A tavern's menu is exactly "name, dots, number": the leader makes a row of counts readable |

## Visual language

- **Palette (R-29).** Two core colours and one accent: soot and oak (the page and the board; in the light stock, parchment and oak) with bone-coloured ink,
  and lantern amber, the only bright colour (a bright amber on the dark stock, a burnt amber on parchment so text on it keeps 4.5:1). Iron (nails, rail,
  chains) and the chalkboard are neutrals. The OS preference decides unless the person picks a theme (`html[data-theme]`).
- **Type.** IM Fell English (a 1600s English printer's type: a tavern broadside) for heads and the wordmark; Chivo for everything people read. Fell has
  one weight, a small x-height and old-style figures, so heads are set larger, and **facts never use it**: a date, a price, a seat count or a time is Chivo
  (R-06, readability). 14 px is the smallest text; running text stays near 65 characters wide.
- **Shape.** Photographs and wells are square or nearly (radii 2 to 4 px); tags are small rectangles, not pills (R-11); ruled lists use a 2 px bar and hairlines.
- **No icons beside labels, no dot screens, no gradients.** The brand marks and genre icons stay.
- **Layout.** Home: a board that carries the hero (the search is the action) and the next games pinned on it; a chalkboard menu; rows for beginners; a
  closing sheet for Game Masters on the board. Inner pages open straight on their list, listing or form under the beam. A game page is a Split Studio: a
  framed cover beside the facts, the contact box pinned.

## The three dials

| Dial | Setting | In practice |
|---|---|---|
| Energy | 2, committed and warm | one accent, big display type, a dark oak ground on home; plain reading text and plain words |
| Rhythm | 3, varied | board, chalkboard, open rows and a pinned closing sheet alternate and differ in composition, not only in colour |
| Motion | 1, almost none | focus and hover states only; the tilt is static; nothing animates in; `prefers-reduced-motion` is respected |

## Rules that follow from it

1. One accent. A second colour needs a reason written here.
2. Oak, iron and chalk are materials, not colours to spread: they appear only in the parts above. No wood behind running text, no parchment filter,
   no torn edges, no flourishes, no gold, no glow, no dice or sword icons.
3. A sheet pinned on oak is parchment with dark ink in both stocks (the `--sheet*` tokens are constants).
4. Real content over templates: no three-step explainers, stat tiles or testimonial rows. How it works has its own page.
5. Every control is at least 44 px in both directions; labels sit above fields; focus is always visible (light amber on dark ground, burnt amber on parchment).
6. Both languages are first class. Indonesian copy is written, not translated word for word, and can run longer: nothing may be clipped.
7. No em dashes in copy or emails.
8. The first screen on a phone shows what the page is for, not a banner. The sign must fit beside the language switch at 390 px.
9. Illustrations and marks are CSS plus one inline SVG (the chain link). No logo, mascot, avatar or stock picture was invented for this look (R-23); the
   listings' own cover art is the imagery.

## Exceptions on the record

Four Hallmark checks are waived on purpose; each is noted at the top of `src/app/globals.css` and explained here so the next person knows they are
decisions and not oversights. They date from the Halftone design; the Hallmark linter has not been run on this direction.

| Check | Why it is waived |
|---|---|
| 44c, 79 | The inner pages have no hero stage: the list, listing or form starts right under the beam, so there is no empty first screen to fill and no dead band under it. |
| 77 | A listing's about, schedule and safety rows are plain reading text beside their heads, set as one ruled list across the page. |
| 78 | The games list has no section heads: each listing's title is its own `h2` inside its link, set at item size so three fit across. |

## How to change it

Change a token in `tokens.css` (light) or the dark blocks in `globals.css` before changing a component. Check both stocks and both languages at a 400 px
width. Run `npm run preview` and `node scripts/audit-frontend.mjs` (see [docs/anti-slop-audit.md](docs/anti-slop-audit.md)) to re-measure the rules that can be measured.
