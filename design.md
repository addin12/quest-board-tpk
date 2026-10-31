# Design direction

The one page to read before changing how the site looks. The decisions behind it are in [DECISIONS.md](DECISIONS.md) (ADR-30; ADR-22, 28 and 29
are earlier directions that were dropped); the mandatory rules for any screen real people use are in [CLAUDE.md](CLAUDE.md). The tokens live in
`src/app/tokens.css` (light) and `src/app/globals.css` (dark, components, the Hallmark waivers).

Design Read: a listing board for tabletop players in Jabodetabek and the Game Masters who run for them, in a **minimal tavern** language: warm paper,
ink, one oxblood accent, and three quiet tavern touches and one typeface. Dial: ENERGY 1 / RHYTHM 2 / MOTION 1.

## Who it is for

Players who want to find a tabletop game this week, and the Game Masters who run them. Most arrive on a phone, from a WhatsApp link or a search,
read Indonesian or English, and have a few seconds of patience. The page's job is one thing: *attend*. Find a game, read when and where,
message the GM. The site takes no bookings and no money, and the design must never suggest it does.

## The idea: a quiet room with a few tavern details

Three earlier directions were tried and dropped at the owner's request (Halftone: print poster; a tavern board with oak planks and chains; a tavern at
night). The lesson: the more the page is dressed as a tavern, the less it reads as a place to find a game. So the page is plain (paper, ink, space, rules,
the listings' own cover art as the only colour) and the tavern is carried by three touches and one typeface. Each touch does something; none is decoration.

| Touch | What it is | Why it is there (R-31) |
|---|---|---|
| **Oak strip** (`.oak-strip`) | A 6 px band of oak across the very top and the very foot of every page | A beam over the door and a sill under it: the one place the page has a colour of its own, and it frames the page without a panel |
| **Double rule** (`.rule-double`, `border-double`) | A thin double line under the masthead, above the footer and above the closing call | How an old broadside is ruled under its title: it separates without a heavy bar, and it is the only "ornament" |
| **Nail** (`.tack`) | Each game card is a hairline box with a small nail at the top: a notice on a board | The product is a board of notices; one dot says so, with no shadow, tilt or texture |
| **Book face** (EB Garamond) | Headings and the wordmark are set in a Garamond, a 1500s old-style serif | The voice of a tavern's menu and broadside, in the one place type can carry it without costing readability |

## Visual language

- **Palette (R-29).** Warm paper and ink (the two core colours) and one accent, oxblood (the red of a wax seal and a painted sign). The accent is
  a deep oxblood on paper (7:1 or better for text and buttons) and a lifted brick on the dark stock. Oak appears only in the strip and is the nail's colour
  family. Light is the primary stock; dark is the same room after hours. The OS preference decides unless the person picks a theme (`html[data-theme]`).
- **Type.** EB Garamond (medium) for heads and the wordmark; Chivo for everything people read. Garamond has a small x-height, so heads are set larger, and
  facts stay in Chivo: a date, a price, a seat count or a time (R-06, readability, tabular figures). It was chosen by the owner from seven options (IM Fell English,
  Alegreya, EB Garamond, Lora, Besley, Almendra, Young Serif); Fell was dropped for its one thin weight and old-style figures. 14 px is the smallest text;
  running text stays near 65 characters wide.
- **Shape.** Photographs and wells are square or nearly (radii 2 to 4 px); tags are small rectangles, not pills (R-11); ruled lists use a 2 px bar and hairlines.
- **Nothing is drawn.** No planks, grain, chains, frames, shadows, gradients, dot screens or icons beside labels. The brand marks and genre icons stay.
- **Masthead links.** No underlines: the current page sits in a tinted rounded rectangle, any other link gets a neutral one on hover, and "List your game" is the one filled accent button (the same look as the page buttons).
- **Masthead controls.** A light/dark toggle (it names the mode it switches to: a moon and "Dark" while the page is light; icon only under 1024 px) and the language switch in capitals, EN and ID. The footer keeps the three-way switch with Automatic; both read the one `data-theme` attribute, so they never disagree.
- **Layout.** Home: a left-set head and the search; the next games as a rail of cards; the genres as a grid of tiles like the systems (the cover of the genre's soonest listing that has one, the genre's name, how many games; a button opens the page with every genre); the game systems as a grid of tiles (the cover of the system's soonest listing that has one, never publisher art, with the system's name and how many games use it; a text link under the grid opens the page with all of them); beginner
  games as rows beside a short text; a closing call under a double rule. Inner pages open straight on their list, listing or form under the masthead. A game
  page is a Split Studio: the cover beside the facts, the contact box a plain tinted well.

## The three dials

| Dial | Setting | In practice |
|---|---|---|
| Energy | 1, calm | one accent, one big heading per screen, no loud colour except the listings' covers |
| Rhythm | 2, consistent with a few breaks | sections share one left edge and one rule style; the genre list, the beginner split and the closing call break the pattern in composition |
| Motion | 1, almost none | focus and hover states only; nothing animates in; `prefers-reduced-motion` is respected |

## Rules that follow from it

1. One accent. A second colour needs a reason written here.
2. The tavern stays at these four touches (the table above). A sixth needs a reason written here first. No wood textures, parchment filters, torn edges,
   flourishes, gold, glow, sword icons, and no illustration that is not a listing's own cover (R-22, R-23). The one exception is the d20 outline
   beside the wordmark "Quest Board" (`src/components/dice-mark.tsx`), drawn on the owner's explicit request; it is the site's only mark.
3. Real content over templates: no three-step explainers, stat tiles or testimonial rows. How it works has its own page.
4. Every control is at least 44 px in both directions; labels sit above fields; focus is always visible.
5. Both languages are first class. Indonesian copy is written, not translated word for word, and can run longer: nothing may be clipped.
6. No em dashes in copy or emails.
7. The first screen on a phone shows what the page is for, not a banner.

## Exceptions on the record

Four Hallmark checks are waived on purpose; each is noted at the top of `src/app/globals.css` and explained here so the next person knows they are
decisions and not oversights. They date from the Halftone design; the Hallmark linter has not been run on this direction.

| Check | Why it is waived |
|---|---|
| 44c, 79 | The inner pages have no hero stage: the list, listing or form starts right under the masthead, so there is no empty first screen to fill and no dead band under it. |
| 77 | A listing's about, schedule and safety rows are plain reading text beside their heads, set as one ruled list across the page. |
| 78 | The games list has no section heads: each listing's title is its own `h2` inside its link, set at item size so three fit across. |

## How to change it

Change a token in `tokens.css` (light) or the dark blocks in `globals.css` before changing a component. Check both stocks and both languages at a 400 px
width. Run `npm run preview` and `node scripts/audit-frontend.mjs` (see [docs/anti-slop-audit.md](docs/anti-slop-audit.md)) to re-measure the rules that can be measured.
