// A game with no fixed date (ADR-52): the Game Master runs it when a group asks. Players see "on request" and message the Game Master to arrange a session. Its
// listing has an end like any other, so a forgotten listing does not stay forever: the Game Master extends it with one press, after one email that warns them. Pure module.

/** An on-request game is listed this long after it is saved; the Game Master extends it from their account page. */
export const ON_DEMAND_LISTING_DAYS = 90;
/** One press of "extend" keeps an on-request listing this much longer. */
export const EXTEND_DAYS = 30;
/** No listing, extended or not, is kept longer than this from today (a date far in the future would also break the date ordering of the stored text). */
export const MAX_LISTED_AHEAD_DAYS = 400;
/** The Game Master of an on-request listing is emailed once when it has this long left. */
export const NUDGE_BEFORE_DAYS = 3;
