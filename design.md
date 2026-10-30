# Design direction

The one page to read before changing how the site looks. The decisions behind it are in [DECISIONS.md](DECISIONS.md) (ADR-22, ADR-24, ADR-28); the
mandatory rules for any screen real people use are in [CLAUDE.md](CLAUDE.md). The tokens live in `src/app/tokens.css`, the choices and
exceptions are stamped at the top of `src/app/globals.css`.

Design Read: a listing board for tabletop players in Jabodetabek and the Game Masters who run for them, in a **tavern notice-board** language
laid over the **Halftone** print language. Dial: ENERGY 2 / RHYTHM 3 / MOTION 1.

## Who it is for

Players who want to find a tabletop game this week, and the Game Masters who run them. Most arrive on a phone, from a WhatsApp link or a search,
read Indonesian or English, and have a few seconds of patience. The page's job is one thing: *attend*. Find a game, read when and where,
message the GM. The site takes no bookings and no money, and the design must never suggest it does.

## The idea: a quest board in a tavern

The site is a tavern's notice board. A game is a sheet nailed to oak; the board hangs under a signboard; the genres are the chalkboard menu. This
is the literal thing the product is (a board of listings), so every tavern element is a structure that does a job, not a decoration.
It sits on the Halftone print language kept from ADR-22: cream stock, brown-black ink, one vermilion, square wells, ruled lists, Ultra over Chivo.
The earlier tavern look (ADR-22 dropped it) failed as a *theme*: wood textures behind everything, Cinzel capitals, a gold accent word, a fireplace
photograph. This one has no such parts.

| Part | What it is | Why it is there (R-31) |
|---|---|---|
| **Beam and sign** (`.beam`, `.sign`) | A timber beam over every page with an iron rail; the wordmark is a signboard hung from it by two chains | A tavern is found by its sign: the one identity motif, repeated at the foot as the beam |
| **Board** (`.board`) | Horizontal oak planks (CSS only: seams, a one-tone alternation, two grain lines at unrelated spacings) behind the home hero and the games | The listings are notices; a wall of notices needs a wall. The texture is the material the notices hang on, not a background pattern |
| **Pinned sheet** (`.pin`) | A game as a parchment sheet with an iron nail, tilted by 0.3 to 0.4 degrees in a repeating three, with the site's one shadow | A pinned sheet stands off the board (the elevation reason, R-12); the tilt breaks the grid of identical cards (R-14) without motion |
| **Picture frame** (`.plate.frame`) | An oak frame around the cover on a game's own page | The listing's art hangs on the page; no other picture is framed |
| **Chalkboard menu** (`.menu`, `.leader`) | The genre index as a chalkboard in an oak frame, names in Ultra, a dotted leader to the count | A tavern's menu is exactly "name, dots, number": the leader makes a long row of counts readable |
| **Standfirst face** (IM Fell English, `.lead`) | The line under a head is set in a 1600s English printer's type | A broadside's voice; reading text stays Chivo so nothing long is set in Fell (R-06) |

## Visual language

- **Palette (R-29).** Two core colours and one accent: parchment cream and oak (a brown-black that is also the ink), plus vermilion, which is the
  wax-seal and sign-paint red of the place and the only bright colour. Iron (the nails, the rail, the chains) and the chalkboard are neutrals.
  The dark stock is derived: the oak is a step lighter than the page, a sheet a step lighter than the oak, the chalkboard darker than the page.
  The OS preference decides unless the person picks a theme (`html[data-theme]`).
- **Type.** Ultra (a fat face, as a painted sign is lettered) for heads and the wordmark; IM Fell English for the standfirst under a head;
  Chivo for everything people read. 14 px is the smallest text; running text stays near 65 characters wide.
- **Shape.** Square wells and photographs (radii 0 to 3 px), ruled lists, a dot screen (`.halftone`) once, on the Game Masters band.
- **No icons beside labels.** The brand marks and genre icons stay.
- **Layout.** Home: a board that carries the hero (the search is the action) and the next games pinned on it; a chalkboard menu; rows for beginners;
  a closing band for Game Masters. Inner pages open straight on their list, listing or form under the beam. A game page is a Split Studio:
  a framed cover beside the facts, the contact box pinned.

## The three dials

| Dial | Setting | In practice |
|---|---|---|
| Energy | 2, committed and warm | one loud accent, big display type, a dark oak ground on home; plain reading text and plain words |
| Rhythm | 3, varied | board, chalkboard, open rows and a dark band alternate and differ in composition, not only in colour |
| Motion | 1, almost none | focus and hover states only; the tilt is static; nothing animates in; `prefers-reduced-motion` is respected |

## Rules that follow from it

1. One accent. A second colour needs a reason written here.
2. Oak, iron and chalk are materials, not colours to spread: they appear only in the parts above. No wood behind running text, no parchment filter,
   no torn edges, no flourishes, no gold, no candle glow, no dice or sword icons.
3. A sheet pinned on oak keeps the page's own paper and ink (`--sheet*` tokens), in both stocks.
4. Real content over templates: no three-step explainers, stat tiles or testimonial rows. How it works has its own page.
5. Every control is at least 44 px in both directions; labels sit above fields; focus is always visible (on oak it is the light vermilion).
6. Both languages are first class. Indonesian copy is written, not translated word for word, and can run longer: nothing may be clipped.
7. No em dashes in copy or emails.
8. The first screen on a phone shows what the page is for, not a banner. The sign must fit beside the language switch at 390 px.
9. Illustrations and marks are made of CSS and a few lines of inline SVG (the chain link). No logo, mascot, avatar or stock picture was
   invented for this look (R-23); the listings' own cover art is the imagery.

## Exceptions on the record

Four Hallmark checks are waived on purpose; each is stamped in `src/app/globals.css` and explained here so the next person knows they are
decisions and not oversights. The waivers date from the Halftone design and have not been re-run through the Hallmark linter since the tavern layer.

| Check | Why it is waived |
|---|---|
| 44c, 79 | The inner pages have no hero stage: the list, listing or form starts right under the beam, so there is no empty first screen to fill and no dead band under it. |
| 77 | A listing's about, schedule and safety rows are plain reading text beside their heads, set as one ruled list across the page. |
| 78 | The games list has no section heads: each listing's title is its own `h2` inside its link, set at item size so three fit across. |

## How to change it

Change a token in `tokens.css` before changing a component. Check both stocks (light and dark) and both languages at a 400 px width. Run
`npm run preview` and `node scripts/audit-frontend.mjs` (see [docs/anti-slop-audit.md](docs/anti-slop-audit.md)) to re-measure the rules that can be measured.
