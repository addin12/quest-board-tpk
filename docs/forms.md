# The two Google Forms

Game Masters send their profile and their games through two Google Forms. You create them once, in your own Google
account. The question titles below are **exact**: the Sheet's script finds each answer by its column title, and
`setup()` tells you if one is missing or renamed. Capitals, spaces and punctuation don't matter ("Game Title" is fine),
and three renames are known (`COLUMN_ALIASES` in Code.gs: *Session Date*, *Schedule Notes*, *Game Cover Image (4 : 5
Potrait)*); any other new wording needs an alias there. Multiple-choice and dropdown options are in
[form-options.md](form-options.md) (generated from the site's own words: paste them as they are).

## Settings for both forms

| Setting (Form → Settings) | Value | Why |
|---|---|---|
| Responses → Collect email addresses | **Verified** | The GM's Google account links their profile to their games, and lets you email them. It is never shown on the site. |
| Responses → Allow response editing | **On** | A GM fixes a mistake with the "Edit your response" link; the listing goes back to review by itself. |
| Responses → Send responders a copy | When requested | They get the edit link in an email. |
| Presentation → Show link to submit another response | On | A GM with several games fills the game form again. |
| Responses → Limit to 1 response | **Off** | |

File upload questions make Google ask for a sign-in (that is why the forms need one). Uploaded files go to a Drive
folder owned by you; the script makes a picture viewable by link when it is first seen, so every admin sees it while
reviewing, and private again if you reject it.

Link both forms to **one** Sheet (Responses → Link to Sheets → Select existing spreadsheet), then rename the two new
tabs to **`GM profiles`** and **`Games`**.

## Form 1: GM profile

Title: *Quest Board TPK: GM profile*. Description: *Fill this in once. It is what players see about you, and how they
reach you. Your email address is never shown.*

| Question title (exact) | Type | Required | Notes |
|---|---|---|---|
| `Display name` | Short answer | Yes | Max 60 characters. |
| `Short bio` | Paragraph | Yes | Max 800 characters. |
| `City` | Dropdown | Yes | Jakarta, Bogor, Depok, Tangerang, Tangerang Selatan, Bekasi, Online only. |
| `Systems you usually run` | Short answer | No | Comma-separated, e.g. `Call of Cthulhu, Mothership`. |
| `Photo` | File upload | No | Images only, 1 file, up to 10 MB. Cropped to a square on the site. |
| `WhatsApp number` | Short answer | Yes | Response validation → Regular expression → Matches → `^\+?[0-9][0-9 \-]{7,18}$`. Help text: *With country code or starting with 0, e.g. 0812-3456-7890.* |
| `Discord (optional)` | Short answer | No | Help text: *Your username (e.g. raka_gm) or a permanent invite link (https://discord.gg/…).* |
| `Public listing` | Checkboxes | Yes | One option: *I agree that my display name, bio, city, photo and WhatsApp number (and Discord, if I add it) are shown publicly on Quest Board TPK.* |

## Form 2: Game

Title: *Quest Board TPK: list a game*. Description: *One response per game. Fill in the GM profile form first, with the
same Google account.*

| Question title (exact) | Type | Required | Notes |
|---|---|---|---|
| `Game title` | Short answer | Yes | Max 100 characters. |
| `Game system` | Dropdown | Yes | Options: [form-options.md](form-options.md#game-system-dropdown). |
| `Other system (if you chose Other)` | Short answer | No | |
| `One-line summary` | Short answer | Yes | Max 80 characters. The short description on the game's card; the card shows all of it. |
| `Full description` | Paragraph | Yes | What the game is, who it suits, what to bring. Max 4000 characters. |
| `Format` | Multiple choice | Yes | One-shot, Campaign. |
| `Genres (pick up to 3)` | Checkboxes | No | Response validation → Select at most → 3. |
| `Play styles (pick up to 3)` | Checkboxes | No | Response validation → Select at most → 3. |
| `Where will you play?` | Multiple choice | Yes | Online, In person. |
| `Platform (online games)` | Short answer | No | Discord, Foundry VTT, Roll20, Google Meet… |
| `City (in-person games)` | Dropdown | No | Jakarta, Bogor, Depok, Tangerang, Tangerang Selatan, Bekasi. |
| `Venue name (in-person games)` | Short answer | No | A public place such as a café or game store, never a home address. |
| `Google Maps link (in-person games)` | Short answer | No | In Google Maps: open the place → Share → Copy link. Response validation → Text → Contains → `https://`. |
| `Date of the first session` | Date | Yes | |
| `Start time` | Time | Yes | |
| `Time zone` | Dropdown | Yes | WIB, WITA, WIT. |
| `Other sessions or schedule notes` | Paragraph | No | *Every Saturday 14.00–17.00 for 6 weeks.* |
| `Keep this listing until (optional)` | Date | No | Without it the listing leaves the site a day after the first session. A campaign should set it. |
| `Price per seat (Rupiah, 0 = free)` | Short answer | Yes | Response validation → Number → Greater than or equal to → 0. Information only: Quest Board takes no payment. |
| `Seats` | Short answer | Yes | Response validation → Number → Between → 1 and 20. |
| `Play language` | Multiple choice | Yes | Indonesian, English, Both. |
| `Experience level` | Multiple choice | Yes | Beginner friendly, All experience levels, Experienced players. |
| `Minimum age` | Short answer | No | Response validation → Number → Between → 0 and 99. |
| `Content warnings` | Paragraph | No | Help text: *Help players make an informed choice.* |
| `Safety tools` | Short answer | No | X-Card, Lines & Veils… |
| `Cover image (4:5 portrait)` | File upload | No | Images only, 1 file, up to 10 MB. Cropped to 4:5 (1080×1350 works best), like an Instagram post. |
| `Community guidelines` | Checkboxes | Yes | One option: *I confirm this information is true, I will not ask players for fees through this listing, and I will follow the content warnings and safety tools I list.* |

## The Sheet's own columns

The script adds these to the right of the form's columns when you run `setup()`. Don't rename them.

The script also keeps an **Activity** tab (created by `setup()`): one line for each change, with the time and who made it.

`Id`, `Status`, `Featured`, `AdminNote`, `ReviewedBy`, `ReviewedAt`, `RejectReason`, `Slug`, `Hash`, `Superseded`, `WasLive`, `Full`.
(`Full` is set from the admin page: a game marked full shows a "Full" badge and sinks in the lists. `WasLive` is `yes` once a listing has been approved: its address then keeps a "no longer listed" page when it goes
offline, see DECISIONS.md ADR-11.)

You can read the Sheet, but make decisions on the admin page: it also emails the GM, keeps the audit trail
(`ReviewedBy`, `ReviewedAt`) and queues the site rebuild.

## Scope: Jabodetabek and online

Quest Board TPK lists games played online or in person in Jabodetabek. The city questions are dropdowns of the six areas
(the same list as `AREAS` in `apps-script/CreateForms.gs` and `src/lib/areas.ts`); the GM profile adds *Online only*.
A game's short description (`One-line summary`) is limited to 80 characters because the card shows all of it; the long one
is `Full description`. The admin page warns (it does not block) when a game's city is outside Jabodetabek or its short
description is over 80 characters.

**Changing a form that already exists** (the scripts cannot reach Google Forms; do it by hand, a few minutes each):
1. GM profile form, question `City`: change the type to *Dropdown* and add the seven options above.
2. Game form, question `City (in-person games)`: change the type to *Dropdown* and add the six areas.
3. Game form, question `One-line summary`: Response validation → Length → Maximum character count → 80, and set the description to
   *The short description on the game's card. Keep it short: up to 80 characters.*
Titles stay the same, so the Sheet keeps working. Answers already given are not changed.
