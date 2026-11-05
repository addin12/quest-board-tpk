# Looking after the board (for admins)

Game Masters publish their own profile and games: **nothing waits for you**. What you do is look at what is *held*, what is *reported*, and take down what
should not be there. Open **`/en/admin/`** (or `/id/admin/`) and sign in with your email: you are sent a link that works once. If it says your
account is not an admin, ask the owner to add your email under **Admins**.

## What gets held, and what gets reported

- **Held** (the *Held* tab, was *Waiting*): a profile or game whose wording looks like a scam (OTP, PIN, "pay to my new account", admin fees, gambling spam,
  shortened links), or that three different visitors reported. It is off the site until you decide. A weekly-ish email says how many are held; there is
  no email for each one.
- **Live** (the *Live* tab): everything else, newest first. Skim it now and then: that is the whole moderation of clean listings.
- **Hidden** (the *Hidden* tab): what an admin took down, with the reason the Game Master was sent.

## The loop

1. Open the **Held** list. Pick one. The page shows **Checks** (a *Problem* keeps **Release** off until the Game Master fixes it; *Look closer* is yours to
   judge), how many visitors **reported** it, how it will look, the contact test button and a private note.
2. **Release** (was *Approve*) puts it on the site again; the Game Master can be emailed. A report count is cleared by your decision.
3. **Hide…** takes it down: tick why, add a few words; the Game Master gets the reasons by email with the link to sign in and fix it. When they save a
   change the listing comes back to *Held* (it never goes live by itself again), so you see it.
4. To take a **live** listing down, open it under *Live* and press **Hide…**. A Game Master's profile that is hidden takes all their games off the site with it.

## Quicker

- **Keyboard**: `J` / `K` next and previous, `A` release, `R` hide, `Esc` closes the form.
- **Several at once**: in the Held list, tick the ones with no problems and press *Release … selected*.
- **Search** finds a title, a GM's name or email.

## What Game Masters do themselves

A Game Master signs in at `/en/account/` with an emailed link (one email is one account). They add and change their profile and games (a profile may add
10 games a day and have 30 open), **mark a game full**, make a game **repeat** (every week, 2 weeks or 4 weeks: players see the next session; it stays listed 90 days and they **extend** it with one press, after one email three days before it runs out), **remove** a game and **erase their account** with all their data and pictures: all of it live at once.
Every page that lists games (home, the games list, the systems, genres, styles and mechanics pages, the Game Master pages and list) reads the live data every minute, so a change shows within
about a minute; the static copy for search engines is rebuilt later (up to 2 hours, 10 minutes after a new listing).

## Phone numbers

A visitor sees a Game Master's WhatsApp number only after tapping the button (the site asks the backend for that one number; an address gets 30 an hour). It is
not in the page, so it cannot be copied from the source or the search results. Discord and Instagram names are shown.

## Two profiles, one person

If two profiles share a WhatsApp number, each is flagged *Look closer* with the other's name. If it is the same person with two email
addresses, open the one that should go and use **Ask to merge into…**. Nothing moves yet: the person whose profile you keep is emailed, sees the
other address on their account page, and must **Accept** while signed in. Only then do the games move and both emails sign in to one account. A
request that is not answered lapses after 7 days; you can ask again (twice a day at most). Contact the person yourself first if you doubt it is
the same person: a copied WhatsApp number proves nothing. Owner and admin accounts cannot be merged.

## Things worth knowing

- A game whose date is more than a day past leaves the site on its own (a campaign stays until its *Keep this listing until* date).
- A hidden or held game's cover is private; it is public only while the game is live.
- Three strangers can hold a listing by reporting it. If that happens to a good listing, **Release** it: the reports are cleared and it takes three new ones to hold it again. The activity log says "held for a look after 3 reports".
- Every decision and who made it is recorded in the database's activity log (the owner can read it: [runbook](runbook.md)). Decide on the admin page, so the Game Master is emailed.
- An account nobody has signed in to for two years gets a warning email, and is erased 30 days later if still unused. Admins never expire.

## Spotting a scam

Players pay GMs directly, so the risk is a listing that exists to collect money. Hide, and consider telling the other admins, when:
the GM asks for money *before* anything else and from a different account than the profile's; asks for an OTP, PIN or password;
promises returns; uses a shortened link; or the WhatsApp number and the sign-in email clearly belong to different people.
