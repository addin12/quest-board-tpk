// An iCalendar (.ics) file for one game's first session, so a player can put it in their own calendar (Google, Apple, Outlook all read it). No account and no
// server: the file is made in the browser. Pure module. RFC 5545: lines end in CRLF, are folded at 75 octets, and text escapes backslash, semicolon, comma and newline.
import type { SiteGame } from "./types.ts";

const pad = (n: number) => String(n).padStart(2, "0");
/** 2026-11-14T12:00:00.000Z becomes 20261114T120000Z. */
export function icsTime(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

export const icsText = (s: string): string => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Folds a long line: the first 75 octets, then the rest in lines that start with one space (a multi-byte letter is never split). */
export function icsFold(line: string): string {
  const bytes = new TextEncoder();
  const out: string[] = [];
  let current = "";
  let size = 0;
  let limit = 75;
  for (const ch of line) {
    const n = bytes.encode(ch).length;
    if (size + n > limit) {
      out.push(current);
      current = " ";
      size = 1;
      limit = 75;
    }
    current += ch;
    size += n;
  }
  out.push(current);
  return out.join("\r\n");
}

/** The calendar file for a game: `url` is the game's page, `sessionHours` falls back to 3 when the Game Master did not say. */
export function gameIcs(game: Pick<SiteGame, "id" | "title" | "summary" | "startsAt" | "expiresAt" | "repeatDays" | "sessionHours" | "locationType" | "venueName" | "city" | "platform">, url: string, nowMs: number): string {
  const start = Date.parse(game.startsAt);
  const end = start + (game.sessionHours > 0 ? game.sessionHours : 3) * 3_600_000;
  const where = game.locationType === "online" ? game.platform : [game.venueName, game.city].filter(Boolean).join(", ");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Quest Board//Game//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${game.id}@quest-board`,
    `DTSTAMP:${icsTime(nowMs)}`,
    `DTSTART:${icsTime(start)}`,
    `DTEND:${icsTime(end)}`,
    // a repeating game is one series: every 7, 14 or 28 days until its listing runs out
    ...(game.repeatDays > 0 ? [`RRULE:FREQ=WEEKLY;INTERVAL=${game.repeatDays / 7};UNTIL=${icsTime(Date.parse(game.expiresAt))}`] : []),
    `SUMMARY:${icsText(game.title)}`,
    ...(where ? [`LOCATION:${icsText(where)}`] : []),
    `DESCRIPTION:${icsText([game.summary, url].filter(Boolean).join("\n"))}`,
    `URL:${url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(icsFold).join("\r\n") + "\r\n";
}

/** The file name for the download: letters and digits of the title, so no path or odd character reaches the file system. */
export const icsFileName = (title: string): string => `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "game"}.ics`;
