# Design direction

The one page to read before changing how the site looks. The decisions behind it are in [DECISIONS.md](DECISIONS.md) (ADR-30; ADR-22, 28 and 29
are earlier directions that were dropped); the mandatory rules for any screen real people use are in [CLAUDE.md](CLAUDE.md). The tokens live in
`src/app/tokens.css` (light) and `src/app/globals.css` (dark and components).

Design Read: a listing board for tabletop players in Jabodetabek and the Game Masters who run for them, in a **minimal tavern** language: warm paper,
ink, one oxblood accent, and four quiet tavern touches and one typeface. Dial: ENERGY 1 / RHYTHM 2 / MOTION 2 (raised from 1 on 2026-11-02, ADR-37).

## Who it is for

Players who want to find a tabletop game this week, and the Game Masters who run them. Most arrive on a phone, from a WhatsApp link or a search,
read Indonesian or English, and have a few seconds of patience. The page's job is one thing: *attend*. Find a game, read when and where,
message the GM. The site takes no bookings and no money, and the design must never suggest it does.

## The idea: a quiet room with a few tavern details

Three earlier directions were tried and dropped at the owner's request (Halftone: print poster; a tavern board with oak planks and chains; a tavern at
night). The lesson: the more the page is dressed as a tavern, the less it reads as a place to find a game. So the page is plain (paper, ink, space, rules,
the listings' own cover art as the only colour) and the tavern is carried by four touches and one typeface. Each touch does something; none is decoration.

| Touch | What it is | Why it is there (R-31) |
|---|---|---|
| **Oak strip** (`.oak-strip`) | A 6 px band of oak across the very top and the very foot of every page | A beam over the door and a sill under it: the one place the page has a colour of its own, and it frames the page without a panel |
| **Double rule** (`.rule-double`, `border-double`) | A thin double line under the masthead, above the footer and above the closing call | How an old broadside is ruled under its title: it separates without a heavy bar, and it is the only "ornament" |
| **Nail** (`.tack`) | Each game card is a hairline box with a small nail at the top: a notice on a board | The product is a board of notices; one dot says so, with no shadow, tilt or texture |
| **Rank numeral** (`.rank`) | An outlined Garamond numeral in the text zone of each "Browse by system" tile on the home page | The tiles are ordered by how many games each system has; a number says so at a glance (the idea comes from style.ai.id's "Top today"); it is faint, decorative and never over a picture |
| **Book face** (EB Garamond) | Headings and the wordmark are set in a Garamond, a 1500s old-style serif | The voice of a tavern's menu and broadside, in the one place type can carry it without costing readability |

## Visual language

- **Palette (R-29).** Warm paper and ink (the two core colours) and one accent, oxblood (the red of a wax seal and a painted sign). The accent is
  a deep oxblood on paper (7:1 or better for text and buttons) and a lifted brick on the dark stock. Oak appears only in the strip and is the nail's colour
  family. Light is the primary stock; dark is the same room after hours. The OS preference decides unless the person picks a theme (`html[data-theme]`).
- **Type.** EB Garamond (medium) for heads and the wordmark; Plus Jakarta Sans for everything people read (drawn in Indonesia, 2026-11-02: it replaced Chivo; ADR-36). Garamond has a small x-height, so heads are set larger, and
  facts stay in the sans: a date, a price, a seat count or a time (R-06, readability, tabular figures). It was chosen by the owner from seven options (IM Fell English,
  Alegreya, EB Garamond, Lora, Besley, Almendra, Young Serif); Fell was dropped for its one thin weight and old-style figures. 14 px is the smallest text;
  running text stays near 65 characters wide. **Weights (unslop audit, 2026-11-03):** 400 for text and labels, 500 for facts, values, links and buttons, 600 only for the filled primary
  button and the "full" tag, never 700: hierarchy comes from size and colour. Plus Jakarta Sans is loaded as a variable font so 500 and 600 are real weights. Digits are tabular everywhere (`body`).
- **Home hero.** One centered column: the headline, the intro, the search and the "Do you run games?" prompt. The soonest game is not shown twice: it is the first card of "Starting soon" below (six cards, soonest first), and the "New to tabletop RPGs?" list skips the first row. The search field keeps its label left-aligned above it.
- **Shape.** Photographs and wells are square or nearly (radii 2 to 4 px); tags are small rectangles, not pills (R-11); ruled lists use a 2 px bar and hairlines.
- **Nothing is drawn.** No planks, chains, frames, shadows, dot screens or icons beside labels, and no gradients or grain on the page itself. The brand marks and genre icons stay. The one exception (R-01, with its reason): a listing **without a picture** shows its colour field with a soft light from the corner and a little grain (`.grain`), so a bare card still reads as a poster and not as an empty box.
- **Masthead links.** No underlines: the current page sits in a tinted rounded rectangle, any other link gets a neutral one on hover, and "List your game" is the one filled accent button (the same look as the page buttons).
- **Masthead controls.** A light/dark toggle (it names the mode it switches to: a moon and "Dark" while the page is light; icon only under 1024 px) and the language switch in capitals, EN and ID. There is no second theme control in the footer.
- **Layout.** Home: a left-set head and the search; the next six games as a grid of cards, three across; the game systems as a grid of tiles (the publisher's book cover where one is known, else the cover of the system's soonest listing, ADR-34, with the name and how many games use it; a button beside the heading opens the page with all of them); the genres as a grid of picture tiles in the same shape, and the play styles and mechanics as rounded text cards (name and count, no picture) (each with its picture from StartPlaying's genres page, the name and the count; a button opens the page with every genre); beginner
  games as rows beside a short text; a closing call under a double rule. Inner pages open straight on their list, listing or form under the masthead. A game
  page is two columns from 1024 px: the cover with the facts list under it (no empty space under the picture), and beside them the title, the Game Master, the contact box (a plain tinted well), then the text blocks stacked with their headings above (About this game, Schedule, then Content warnings and Safety tools side by side, the tags, the listing date). On a phone one column in the order cover, title and contact, facts, text.

## The three dials

| Dial | Setting | In practice |
|---|---|---|
| Energy | 1, calm | one accent, one big heading per screen, no loud colour except the listings' covers |
| Rhythm | 2, consistent with a few breaks | sections share one left edge and one rule style; the genre list, the beginner split and the closing call break the pattern in composition |
| Motion | 2, a few transitions with a reason | focus and hover states, plus the five motions in the next list; nothing loops, nothing is scroll-linked, nothing plays on load; `prefers-reduced-motion` turns all of it off (one global rule in `globals.css`) |

The five motions (R-19: each has a UX purpose, written here):

1. **The filter sheet on a phone slides up** (220 ms): it is a separate layer, and the slide shows where it came from and where it goes.
2. **The header slides away going down and back going up** on a phone: the page needs the height, and the way back is one flick away.
3. **The games list fades in after a change of page** (220 ms, 6 px): the whole list changed under the reader's thumb.
4. **A folded section opens and closes smoothly** (the GM form's "More about how you run it"), where the browser supports `::details-content`.
5. **The cover morphs from a game card to the game page** (React `<ViewTransition>`, named `cover-<slug>`, the browser's default 250 ms): the reader sees it is the same game they tapped, which is the one place a page change has no other cue.

## Rules that follow from it

1. One accent. A second colour needs a reason written here.
2. The tavern stays at these five touches (the table above). A sixth needs a reason written here first. No wood textures, parchment filters, torn edges,
   flourishes, gold, glow, sword icons, and no illustration that is not a listing's own cover (R-22, R-23). The one exception is the d20 outline
   beside the wordmark "Quest Board" (`src/components/dice-mark.tsx`), drawn on the owner's explicit request; it is the site's only mark.
   The system tiles carry the publishers' book covers (ADR-34, `public/images/systems`), chosen on the owner's request and credited in `docs/art-credits.md`; they are the only pictures that are not a listing's own cover. Genres, play styles and mechanics are text cards with a short description (ADR-60).
3. Real content over templates: no three-step explainers, stat tiles or testimonial rows. How it works has its own page.
4. Every control is at least 44 px in both directions; labels sit above fields; focus is always visible.
5. Both languages are first class. Indonesian copy is written, not translated word for word, and can run longer: nothing may be clipped.
6. No em dashes in copy or emails.
7. The first screen on a phone shows what the page is for, not a banner.

## Decisions on the record (2026-10-31)

- **The theme follows the visitor's device by default**, and the header toggle then pins light or dark. Dark is not forced on everyone: the page is read mostly on phones in daylight and the light stock is the primary one. The footer has no theme control (it repeated the header toggle), so a pinned choice stays until the browser forgets it.
- **The tavern stays at four touches and a typeface** (oak strip, double rule, a nail on each card, a rank numeral on the system tiles, Garamond). It is deliberately quiet after three heavier directions were rejected. Turning it up later means adding one touch at a time, each with a reason in the table above.
- **Play styles and mechanics are optional and collapsed** in the GM's listing form (genres stay open): they are long and most GMs will skip them.

- **The product is "Quest Board"** everywhere people read it (header, titles, emails and their signature, share text, structured data). No page names the community behind it (The Pandemonium Kollektive, TPK): the copy speaks of "Game Masters" and "the admins".
- **The games list is paged, nine to a page.** The pager is numbered rounded rectangles (the current page filled with the accent), 48 px high; more than 7 pages show the first, the last and the neighbours of the current page with "…".

- **The header stays in view** (sticky, paper-coloured) on every page, so the language, the theme and the way back are always one tap away on the long pages; on a phone it slides away while reading downwards.
- **Home blocks vary** (R-05): systems and genres are picture grids; play styles and mechanics sit side by side as two columns of text cards (stacked on a phone). The filter fields are a bottom sheet on a phone and an inline panel from 640 px; the system field in the GM form and the system, genre, play style and mechanic filters are searchable lists (ARIA combobox, `SearchPicker`) instead of long dropdowns; the empty list offers "Clear filters" in place.
- **On a phone the home browse blocks are one row that scrolls sideways** (the next tile peeking in, snapping to each); from 640 px up they are grids. "Starting soon" stays a grid, because the owner asked for no scrollbar there.
- **The systems page has a search box** (`?q=`, accents ignored): 143 tiles are too many to scan. Its closing note tells a Game Master to choose "Other" for a missing system and, when `NEXT_PUBLIC_REPORT_URL` is set, links to tell the admins.
- **Buttons that lead on carry the number**, such as "All 143 game systems"; the hero asks Game Masters in too ("Do you run games?" and the list button), as well as players.

## How to change it

Change a token in `tokens.css` (light) or the dark blocks in `globals.css` before changing a component. Check both stocks and both languages at a 400 px
width. Run `npm run preview` and `node scripts/audit-frontend.mjs` (see [docs/anti-slop-audit.md](docs/anti-slop-audit.md)) to re-measure the rules that can be measured.

- **Play styles and mechanics carry a short description** (25 to 35 words, our own wording, English and Indonesian) under the name on their browse pages; those cards are wider (three across on a desktop) than the plain count cards elsewhere. Each is the name, the description, then a footer under a hairline: a dot (filled when games are listed), the count, and an arrow that says the card opens the list.

- **The phone view (2026-11-04).** A game in a long list (the games list, a Game Master's games) is one row on a phone: a small cover, the title, system, price, and when and where; the full card stays on the home page and from 640 px up. The game page opens with a landscape cover filling the column, then the title; its facts sit two to a row; a bar above the tab bar keeps the price, the day and WhatsApp within reach and steps aside while the contact panel is on screen (`StickyContact`). On the home page the hero is shorter and one sentence long on a phone, and Starting soon is a row that swipes sideways. The filter sheet pairs the short dropdowns and has a Clear button. Measured at 390, 360 and 320 px: no sideways scroll, no tap target under 44 px, no text under 14 px, no axe violations; the games list page went from about 9,700 to 3,000 px and the home page from 10,300 to 5,500 px.

- **Learned from a marketplace app (GameConsign, 2026-11-04), phone only.** The tab bar has an icon over each label and **List your game** is the accent tab (the bar is 74 px, `--tabbar-h`). The games list has a row of quick-filter chips under the search (Online, In person, One-shot, Campaign, Beginner friendly, Free: one tap each, a second tap clears; the sheet keeps the rest). The browse pages without a search of their own (Game Master, genres, play styles, mechanics) keep one under the masthead. The home page has a **Browse** grid of four large picture tiles (game systems, genres, play styles, mechanics; the first and last are wide on a phone) instead of the two text blocks of styles and mechanics. The contact bar of a game page has a **more** button, shown when the Game Master gave Discord or Instagram, that opens a sheet with every way to reach them. Not copied: their two-column image grid for lists (it makes the games list about 7,500 px long; rows keep it near 3,000), and their artwork and type.

- **The game form (2026-11-06, ADR-53).** Five steps written beside the notice they make: the board's own card, nail and all, stays next to the form on a wide screen and comes at the last step on a phone. Answers are radio buttons and tick boxes with their labels, the short ones in small hairline rectangles (the chosen one: ink border and a light tint), the long ones as tick lists in columns; no pills, no icons, the accent only on the main button. The steps are a row of numbered links like the masthead's. The last step groups the answers in four parts with one "Change" each and posts.
- **The account page (2026-11-06, ADR-54).** One centred column, the width of the game form. Games are the main column with **Add a game** at its head; each is a row like the board's index rows (small cover, title, "system · when · places"), the status in quiet text at the row's edge, actions underneath. The profile sits beside them as the Game Masters list shows it, with how players reach the Game Master. A form takes the page's place while it is open. The profile form has the game form's frame: header with Cancel, two parts, the area as radio buttons in columns, systems as a search plus a tick list, the card beside it. Erasing the account is a plain closing section, not a box.
- **Landing pages and the quiz (2026-11-06, ADR-56).** A landing page is the board's own thing under a plain heading: back link, one-line lead, the count, the cards, one quiet button on to the filters, then the sibling pages as a row of plain links. The quiz is the game form's answer boxes (small hairline rectangles) in one column with the matches beside them (under them on a phone): three rows as on the index, one accent button.
