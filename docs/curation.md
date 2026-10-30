# Reviewing submissions (for admins)

Open **`/en/admin/`** (or `/id/admin/`) on the site and sign in with your email: you are sent a link that works once. If it says your
account is not an admin, ask the owner to add your email under **Admins**.

## The review loop

1. **Games** or **Game Masters** tab, **Waiting** list: the oldest submission is first. A new Game Master profile has to be
   approved before their games can show.
2. Pick one. The page shows, from top to bottom:
   - **Checks**: what is missing or looks wrong. *Problem* means it could not show properly (for example the date can't be
     read): **Approve** stays off until the GM fixes it. *Look closer* is for you to judge: wording that often
     means a scam (OTP, PIN, "pay to my new account", admin fees…), a map link that isn't Google Maps, a profile that is
     still waiting, or a WhatsApp number that another profile also uses (see *Two profiles, one person* below). *Note* is just good to know.
   - **Approve / Reject**, and a box *Email the GM about this decision* (on by default; the email is in English and Indonesian).
   - **How it will look**: the card as players will see it, and every detail the GM wrote.
   - **Contact**: the WhatsApp number as it will appear, with a button to test the chat, and the GM's sign-in email (admins only).
   - A **private note** only admins see.
3. **Approve** → the game leaves the Waiting list; the site rebuilds in a minute or two (the bar at the top says *Changes are
   waiting to go live*; *Publish now* does it immediately). You have 9 seconds to **Undo**.
4. **Reject…** → tick why (several reasons are fine) and add a few words. The GM gets the reasons by email, with the link
   to sign in and fix it. When they save a change, it comes back to Waiting by itself.

## Quicker

- **Keyboard**: `J` / `K` next and previous, `A` approve, `R` reject, `Esc` closes the reject form.
- **Several at once**: in the Waiting list, tick the games that have no problems and press *Approve … selected*.
- **Search** finds a title, a GM's name or email.

## What Game Masters do themselves

A Game Master signs in at `/en/account/` with an emailed link (one email is one account). They can, without waiting for you:
**mark a game full** (a "Full" badge, it sinks to the end of the lists; visitors can still message them), **reopen** it, **remove** a game,
and **erase their account** with all their data and pictures. Any other change (a new game, an edit) goes back to your Waiting list, and
the old version stays off the site until you approve it again.

## Two profiles, one person

If two profiles share a WhatsApp number, each is flagged *Look closer* with the other's name. If it is the same person with two email
addresses, open the one that should go and use **Merge into…**: the games move to the profile you keep, and both emails still sign in to it.

## Things worth knowing

- A game whose date is more than a day past leaves the site on its own (a campaign stays until its *Keep this listing until* date).
- A rejected game's cover is made private again. *Back to waiting* makes it viewable again.
- To take a listing down, open it under *Approved* and press **Reject…** (or *Back to waiting*).
- Every decision and who made it is recorded in the database's activity log (the owner can read it: [runbook](runbook.md)). Decide on the admin page, so the GM is emailed and the site is rebuilt.
- An account nobody has signed in to for two years gets a warning email, and is erased 30 days later if still unused. Admins never expire.

## Spotting a scam

Players pay GMs directly, so the risk is a listing that exists to collect money. Reject, and consider telling the other admins, when:
the GM asks for money *before* anything else and from a different account than the profile's; asks for an OTP, PIN or password;
promises returns; uses a shortened link; or the WhatsApp number and the sign-in email clearly belong to different people.
