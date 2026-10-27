# Reviewing submissions (for admins)

Open **`/en/admin/`** (or `/id/admin/`) on the site and sign in with your Google account. If it says your account is
not an admin, ask the owner to add it under **Admins**.

## The review loop

1. **Games** or **Game Masters** tab, **Waiting** list: the oldest submission is first. A new Game Master profile has to be
   approved before their games can show.
2. Pick one. The page shows, from top to bottom:
   - **Checks**: what is missing or looks wrong. *Problem* means it could not show properly (for example the date can't be
     read): **Approve** stays off until the GM fixes their response. *Look closer* is for you to judge: wording that often
     means a scam (OTP, PIN, "pay to my new account", admin fees…), a map link that isn't Google Maps, a profile that is
     still waiting. *Note* is just good to know.
   - **Approve / Reject**, and a box *Email the GM about this decision* (on by default; the email is in English and Indonesian).
   - **How it will look**: the card as players will see it, and every detail the GM wrote.
   - **Contact**: the WhatsApp number as it will appear, with a button to test the chat, and the GM's Google email (admins only).
   - A **private note** only admins see.
3. **Approve** → the game leaves the Waiting list; the site rebuilds in a minute or two (the bar at the top says *Changes are
   waiting to go live*; *Publish now* does it immediately). You have 9 seconds to **Undo**.
4. **Reject…** → tick why (several reasons are fine) and add a few words. The GM gets the reasons by email, with the link
   to edit their response. When they edit, it comes back to Waiting by itself.

## Quicker

- **Keyboard**: `J` / `K` next and previous, `A` approve, `R` reject, `Esc` closes the reject form.
- **Several at once**: in the Waiting list, tick the games that have no problems and press *Approve … selected*.
- **Search** finds a title, a GM's name or email.
- **Featured**: on an approved game, *Feature* pins it first in the lists and gives it a badge.
- **Full**: on an approved game, *Mark as full* adds a "Full" badge, sinks it to the end of the lists and tells visitors it is
  full (they can still message the Game Master, for example about a waiting list). *Reopen* undoes it. A Game Master who
  wants it marked asks an admin; editing the form would send the whole game back to review.

## Things worth knowing

- A game whose date is more than a day past leaves the site on its own (a campaign stays until its *Keep this listing until* date).
- A GM who edits an approved listing sends it back to review, and it is off the site until you approve it again.
- A rejected game's cover is made private again. *Back to waiting* makes it viewable again.
- To take a listing down, open it under *Approved* and press **Reject…** (or *Back to waiting*).
- The Sheet is the record of everything (`ReviewedBy`, `ReviewedAt`, `RejectReason`, `AdminNote`). Decide on the admin page,
  not in the Sheet, so the GM is emailed and the site is rebuilt.

## Spotting a scam

Players pay GMs directly, so the risk is a listing that exists to collect money. Reject, and consider telling the other admins, when:
the GM asks for money *before* anything else and from a different account than the profile's; asks for an OTP, PIN or password;
promises returns; uses a shortened link; or the WhatsApp number and the Google account clearly belong to different people.
