/**
 * Quest Board TPK: the Google Sheet's script. It is the whole backend, and it is free.
 *
 *   GM Google Forms  ->  this Sheet  ->  this script  ->  the website (public JSON) and the admin page (API)
 *
 * What it does
 *   - Gives every form response an Id and a Status (pending / approved / rejected). A response that a GM
 *     edits goes back to pending, so nothing unreviewed stays live.
 *   - doGet?action=public  returns only approved, unexpired games and their approved GMs, with only the
 *     fields that are meant to be public. Emails, notes and rejected rows never leave the Sheet this way.
 *   - doPost  is the admin API. Every call carries a Google ID token; the script checks it with Google and
 *     then checks the email against the Admins tab. Nobody else can read or change anything.
 *   - tick (every minute) picks up new responses, tells the admins, and asks Cloudflare Pages to rebuild
 *     the site shortly after something public changed.
 *
 * Install: docs/setup.md. Run setup() once. Pure helpers (names ending in _) are unit-tested with node:
 * tests/unit/apps-script.test.ts loads this file in a sandbox, so keep Google calls out of them.
 */

const VERSION = '1.0.0';

// ---------------------------------------------------------------------------------------------
// Names the sheet and the forms must agree on (docs/forms.md lists the same words for the forms).
// ---------------------------------------------------------------------------------------------

const TAB = { games: 'Games', gms: 'GM profiles', admins: 'Admins' };

/** Added by setup() to the right of the form's own columns. */
const ADMIN_COLUMNS = ['Id', 'Status', 'Featured', 'AdminNote', 'ReviewedBy', 'ReviewedAt', 'RejectReason', 'Slug', 'Hash', 'Superseded'];

const COMMON_COLUMNS = { timestamp: 'Timestamp', email: 'Email Address' };

const GM_COLUMNS = {
  name: 'Display name',
  bio: 'Short bio',
  city: 'City',
  systems: 'Systems you usually run',
  photo: 'Photo',
  whatsapp: 'WhatsApp number',
  discord: 'Discord (optional)',
  consent: 'Public listing',
};

const GAME_COLUMNS = {
  title: 'Game title',
  system: 'Game system',
  systemOther: 'Other system (if you chose Other)',
  summary: 'One-line summary',
  description: 'Full description',
  format: 'Format',
  genres: 'Genres (pick up to 3)',
  styles: 'Play styles (pick up to 3)',
  locationType: 'Where will you play?',
  platform: 'Platform (online games)',
  city: 'City (in-person games)',
  venueName: 'Venue name (in-person games)',
  venueMapsUrl: 'Google Maps link (in-person games)',
  date: 'Date of the first session',
  time: 'Start time',
  zone: 'Time zone',
  scheduleNote: 'Other sessions or schedule notes',
  listUntil: 'Keep this listing until (optional)',
  price: 'Price per seat (Rupiah, 0 = free)',
  seats: 'Seats',
  language: 'Play language',
  level: 'Experience level',
  minAge: 'Minimum age',
  contentWarnings: 'Content warnings',
  safetyTools: 'Safety tools',
  cover: 'Cover image (4:5 portrait)',
  consent: 'Community guidelines',
};

/** Titles the forms may have been renamed to (the Sheet's header is the question's title), by the title this script reads. */
const COLUMN_ALIASES = {
  'Date of the first session': ['Session Date'],
  'Other sessions or schedule notes': ['Schedule Notes'],
  'Cover image (4:5 portrait)': ['Game Cover Image (4 : 5 Potrait)', 'Game Cover Image (4 : 5 Portrait)'],
};

/** Capitals, spaces and punctuation don't matter: "Game Title" and "Game title" are the same column (or tab). */
function columnKey_(s) {
  return str_(s).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function buildCanonicalKeys_() {
  const map = {};
  const add = function (title, canonical) { map[columnKey_(title)] = canonical; };
  [GM_COLUMNS, GAME_COLUMNS, COMMON_COLUMNS].forEach(function (cols) {
    Object.keys(cols).forEach(function (f) { add(cols[f], cols[f]); });
  });
  ADMIN_COLUMNS.forEach(function (h) { add(h, h); });
  Object.keys(COLUMN_ALIASES).forEach(function (c) { COLUMN_ALIASES[c].forEach(function (a) { add(a, c); }); });
  return map;
}

const CANONICAL_BY_KEY = buildCanonicalKeys_();

/** A Sheet header as the title this script reads ("Session Date" -> "Date of the first session"); unknown headers stay as they are. */
function canonicalHeader_(raw) {
  const h = str_(raw);
  return CANONICAL_BY_KEY[columnKey_(h)] || h;
}

/** The tab with this name, ignoring capitals ("GM Profiles" is "GM profiles"); null if there is none. */
function findTab_(ss, name) {
  const want = columnKey_(name);
  return ss.getSheets().filter(function (s) { return columnKey_(s.getName()) === want; })[0] || null;
}

/**
 * The genres and play styles: the form's option text mapped to the site's keys (src/lib/categories.ts). Generated from
 * the site's English names, so the forms and the site can't drift apart (a unit test checks).
 */
// BEGIN GENERATED LABELS (npm run form-options: the form's option text -> the site's key)
const GENRE_LABELS = {
  "Fantasy": "fantasy",
  "Dark fantasy": "dark-fantasy",
  "Horror": "horror",
  "Sci-fi": "sci-fi",
  "Cyberpunk": "cyberpunk",
  "Mystery": "mystery",
  "Post-apocalyptic": "post-apocalyptic",
  "Urban fantasy": "urban",
  "Historical": "historical",
  "Cozy": "cozy",
  "High fantasy": "high-fantasy",
  "Gritty fantasy": "gritty-fantasy",
  "Low magic": "low-magic",
  "Grimdark": "grimdark",
  "Imaginative": "imaginative",
  "Supernatural": "supernatural",
  "Gothic horror": "gothic-horror",
  "Eldritch horror": "eldritch-horror",
  "Survival": "survival",
  "Modern": "modern",
  "Futuristic": "futuristic",
  "Space opera": "space-opera",
  "Space western": "space-western",
  "Steampunk": "steampunk",
  "Superhero": "superhero",
  "Anime": "anime",
  "Isekai": "isekai",
  "Pirate": "pirate",
  "Viking": "viking",
  "Western": "western",
  "Victorian": "victorian",
  "Rustic": "rustic",
  "Political intrigue": "political-intrigue",
  "Espionage": "espionage",
  "Comedy": "comedy",
  "Wacky": "wacky",
  "Heartwarming": "heartwarming",
  "Romance": "romance",
  "Battle royale": "battle-royale",
  "Universal": "universal",
};
const STYLE_LABELS = {
  "Roleplay-heavy": "roleplay-heavy",
  "Combat-heavy": "combat-heavy",
  "Tactical": "tactical",
  "Rule of cool": "rule-of-cool",
  "Theater of the mind": "theater-of-mind",
  "Sandbox": "sandbox",
  "Puzzles & mysteries": "puzzle-mystery",
  "Dungeon crawl": "dungeon-crawl",
  "Narrative": "narrative",
  "Roleplay-light": "roleplay-light",
  "Combat-light": "combat-light",
  "Rules as written": "rules-as-written",
  "Hexcrawl & exploration": "hexcrawl",
  "Kingdom building": "kingdom-building",
  "West Marches": "west-marches",
  "Organized play": "organized-play",
  "Play-by-post": "play-by-post",
};
// END GENERATED LABELS
const GENRE_KEYS = Object.keys(GENRE_LABELS).map(function (l) { return GENRE_LABELS[l]; });
const STYLE_KEYS = Object.keys(STYLE_LABELS).map(function (l) { return STYLE_LABELS[l]; });
const MAX_PER_GAME = 3;

/** Indonesia has no daylight saving: a zone is a fixed offset from UTC. */
const ZONE_OFFSET_HOURS = { WIB: 7, WITA: 8, WIT: 9 };

const HOUR_MS = 3600 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** A game with no "keep until" date stays listed this long after its first session starts. */
const LISTING_GRACE_MS = 24 * HOUR_MS;

// ---------------------------------------------------------------------------------------------
// Pure helpers (no Google calls). Unit-tested.
// ---------------------------------------------------------------------------------------------

function str_(v) {
  return v === null || v === undefined ? '' : String(v).replace(/\r\n?/g, '\n').trim();
}

function clip_(v, max) {
  const s = str_(v);
  return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s;
}

function slugify_(input) {
  const s = String(input || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/g, '');
  return s || 'x';
}

/** "0812-3456-7890", "+62 812 3456 7890", "62812…" all become "628123456789 0" without spaces; '' if not a phone number. */
function normalizePhone_(raw) {
  let d = str_(raw).replace(/[^\d+]/g, '');
  if (!d) return '';
  if (d.startsWith('+')) d = d.slice(1);
  else if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = '62' + d.slice(1);
  return /^[1-9]\d{7,14}$/.test(d) ? d : '';
}

/**
 * An https URL as { host, path }, or null. Apps Script has no URL class, so this is a regex: no user info,
 * no port, no spaces; the query and fragment are cut off.
 */
function parseHttpsUrl_(raw) {
  const m = /^https:\/\/([A-Za-z0-9.-]+)(\/[^?#\s<>"']*)?(?:[?#][^\s<>"']*)?$/.exec(str_(raw));
  return m ? { host: m[1].toLowerCase(), path: m[2] || '/' } : null;
}

/** A Discord username ("raka_gm", "@raka_gm") or an invite link; '' if neither. */
function normalizeDiscord_(raw) {
  const s = str_(raw);
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) {
    const u = parseHttpsUrl_(s);
    if (!u) return '';
    const ok = (u.host === 'discord.gg' && u.path.length > 1) || (/^(www\.)?discord\.com$/.test(u.host) && u.path.indexOf('/invite/') === 0);
    return ok ? 'https://' + u.host + u.path : '';
  }
  const handle = s.replace(/^@/, '').toLowerCase();
  return /^[a-z0-9_.]{2,32}$/.test(handle) ? handle : '';
}

/** "9/28/2026" or "2026-09-28" -> "2026-09-28" (the Sheet's locale is set to en_US by setup()). */
function parseDate_(raw) {
  const s = str_(raw);
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  let y, mo, d;
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s))) { mo = +m[1]; d = +m[2]; y = +m[3]; }
  else return '';
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) return '';
  return y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}

/** "7:00:00 PM", "7:00 PM", "19:00", "19.00" -> "19:00". */
function parseTime_(raw) {
  const m = /^(\d{1,2})[:.](\d{2})(?:[:.]\d{2})?\s*([AaPp][Mm])?$/.exec(str_(raw));
  if (!m) return '';
  let h = +m[1];
  const min = +m[2];
  if (m[3]) {
    if (h < 1 || h > 12) return '';
    h = h % 12 + (/p/i.test(m[3]) ? 12 : 0);
  }
  if (h > 23 || min > 59) return '';
  return String(h).padStart(2, '0') + ':' + String(min).padStart(2, '0');
}

/** A date, a time and a zone label as the instant they mean, in ISO 8601 UTC. '' if any part is missing or wrong. */
function toStartsAt_(date, time, zone) {
  const offset = ZONE_OFFSET_HOURS[zone];
  const d = parseDate_(date);
  const t = parseTime_(time);
  if (offset === undefined || !d || !t) return '';
  const ms = Date.parse(d + 'T' + t + ':00Z') - offset * HOUR_MS;
  return new Date(ms).toISOString();
}

function zoneLabel_(raw) {
  const s = str_(raw).toUpperCase();
  const m = /\b(WIB|WITA|WIT)\b/.exec(s);
  return m ? m[1] : 'WIB';
}

/** Checkbox answers arrive as "A, B, C". */
function splitChoices_(raw) {
  return str_(raw).split(',').map(function (s) { return s.trim(); }).filter(Boolean);
}

/**
 * The form's option texts ("Dark fantasy", "Puzzles & mysteries") back to taxonomy keys; labels is GENRE_LABELS or
 * STYLE_LABELS. Matching ignores case. Unknown options are dropped, repeats are counted once, at most MAX_PER_GAME.
 */
function categoryKeys_(raw, labels) {
  const byLabel = {};
  Object.keys(labels).forEach(function (l) { byLabel[l.toLowerCase()] = labels[l]; });
  const seen = {};
  const out = [];
  splitChoices_(raw).forEach(function (choice) {
    const key = byLabel[choice.toLowerCase()];
    if (key && !seen[key]) { seen[key] = true; out.push(key); }
  });
  return out.slice(0, MAX_PER_GAME);
}

/** The first Drive file id in "https://drive.google.com/open?id=ABC, https://…" (a form's file-upload answer). */
function driveId_(raw) {
  const m = /[?&]id=([A-Za-z0-9_-]{10,})|\/d\/([A-Za-z0-9_-]{10,})/.exec(str_(raw));
  return m ? (m[1] || m[2]) : '';
}

function parseIdr_(raw) {
  const digits = str_(raw).replace(/[^\d]/g, '');
  if (!digits) return 0;
  const n = Number(digits);
  return n > 10000000 ? 10000000 : n;
}

function intIn_(raw, min, max, fallback) {
  const n = parseInt(str_(raw).replace(/[^\d-]/g, ''), 10);
  if (isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function isGoogleMapsUrl_(v) {
  const s = str_(v);
  if (!s || s.length > 500) return false;
  const u = parseHttpsUrl_(s);
  if (!u) return false;
  if (u.host === 'maps.app.goo.gl') return u.path.length > 1;
  if (u.host === 'goo.gl') return u.path.indexOf('/maps/') === 0;
  if (/^(www\.)?google\.(com|co\.id)$/.test(u.host)) return u.path === '/maps' || u.path.indexOf('/maps/') === 0;
  return /^maps\.google\.(com|co\.id)$/.test(u.host);
}

function hashOf_(parts) {
  // A short checksum of what the GM wrote, to notice edits. Any stable string hash will do.
  const s = parts.join('\u0001');
  let h1 = 5381;
  let h2 = 52711;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = ((h1 * 33) ^ c) >>> 0;
    h2 = ((h2 * 31) + c) >>> 0;
  }
  return h1.toString(36) + h2.toString(36);
}

/** A stable id from something unique to the row (kind prefix + 8 base-36 chars). */
function makeId_(prefix, seed) {
  const h = hashOf_([prefix, seed]) + hashOf_([seed, prefix, 'x']);
  return prefix + h.replace(/[^a-z0-9]/g, '').slice(0, 8).padEnd(8, '0');
}

function cell_(row, columns, field) {
  const header = columns[field];
  if (header === undefined) return '';
  const v = row.cells[header];
  return v === undefined ? '' : v;
}

function displayCell_(row, columns, field) {
  const header = columns[field];
  if (header === undefined) return '';
  const v = row.display[header];
  return v === undefined ? '' : v;
}

function iso_(v) {
  if (v instanceof Date) return isNaN(v.getTime()) ? '' : v.toISOString();
  const t = Date.parse(str_(v));
  return isNaN(t) ? '' : new Date(t).toISOString();
}

function admin_(row, field) {
  const v = row.cells[field];
  return v === undefined || v === '' ? '' : v;
}

function adminFields_(row) {
  const status = str_(admin_(row, 'Status')).toLowerCase();
  return {
    id: str_(admin_(row, 'Id')),
    slug: str_(admin_(row, 'Slug')),
    status: status === 'approved' || status === 'rejected' ? status : 'pending',
    featured: /^(yes|true|1|x)$/i.test(str_(admin_(row, 'Featured'))),
    adminNote: str_(admin_(row, 'AdminNote')),
    reviewedBy: str_(admin_(row, 'ReviewedBy')),
    reviewedAt: iso_(admin_(row, 'ReviewedAt')),
    rejectReason: str_(admin_(row, 'RejectReason')),
    superseded: /^(yes|true|1)$/i.test(str_(admin_(row, 'Superseded'))),
    submittedAt: iso_(row.cells[COMMON_COLUMNS.timestamp]),
    email: str_(row.cells[COMMON_COLUMNS.email]).toLowerCase(),
    row: row.rowNum,
  };
}

/** One GM-profile row as a record (admin fields included; the public view drops them). */
function gmFromRow_(row) {
  const a = adminFields_(row);
  const g = function (f) { return cell_(row, GM_COLUMNS, f); };
  return Object.assign(a, {
    kind: 'gm',
    name: clip_(g('name'), 60),
    bio: clip_(g('bio'), 800),
    city: clip_(g('city'), 60),
    systems: splitChoices_(g('systems')).slice(0, 8).map(function (s) { return clip_(s, 40); }),
    photoId: driveId_(g('photo')),
    whatsapp: normalizePhone_(g('whatsapp')),
    discord: normalizeDiscord_(g('discord')),
    consent: str_(g('consent')) !== '',
  });
}

/** One game row as a record. Fields that can't be read stay empty; the admin page flags them (src/lib/checks.ts). */
function gameFromRow_(row) {
  const a = adminFields_(row);
  const g = function (f) { return cell_(row, GAME_COLUMNS, f); };
  const d = function (f) { return displayCell_(row, GAME_COLUMNS, f); };
  const system = str_(g('system')).toLowerCase() === 'other' ? str_(g('systemOther')) : str_(g('system'));
  const zone = zoneLabel_(g('zone'));
  const locationType = /person|luring|offline/i.test(str_(g('locationType'))) ? 'in_person' : 'online';
  const startsAt = toStartsAt_(d('date'), d('time'), zone);
  const listUntil = parseDate_(d('listUntil'));
  const fallbackEnd = startsAt ? new Date(Date.parse(startsAt) + LISTING_GRACE_MS).toISOString() : '';
  const until = listUntil ? new Date(Date.parse(listUntil + 'T23:59:00Z') - ZONE_OFFSET_HOURS[zone] * HOUR_MS).toISOString() : '';
  const level = /begin|pemula/i.test(str_(g('level'))) ? 'beginner' : /experienced|mahir/i.test(str_(g('level'))) ? 'experienced' : 'any';
  const lang = str_(g('language'));
  const venueMapsUrl = str_(g('venueMapsUrl'));
  return Object.assign(a, {
    kind: 'game',
    title: clip_(g('title'), 100),
    system: clip_(system, 80),
    summary: clip_(g('summary'), 200),
    description: clip_(g('description'), 4000),
    format: /campaign|kampanye/i.test(str_(g('format'))) ? 'campaign' : 'one_shot',
    locationType: locationType,
    platform: clip_(g('platform'), 80),
    city: clip_(g('city'), 60),
    venueName: clip_(g('venueName'), 80),
    venueMapsUrl: isGoogleMapsUrl_(venueMapsUrl) ? venueMapsUrl : '',
    venueMapsRaw: venueMapsUrl && !isGoogleMapsUrl_(venueMapsUrl) ? clip_(venueMapsUrl, 200) : '',
    startsAt: startsAt,
    zone: zone,
    scheduleNote: clip_(g('scheduleNote'), 400),
    expiresAt: until && startsAt && Date.parse(until) > Date.parse(startsAt) ? until : fallbackEnd,
    priceIdr: parseIdr_(g('price')),
    seats: intIn_(g('seats'), 1, 20, 5),
    language: /both|keduanya|&/i.test(lang) || (/indo/i.test(lang) && /engl|ingg/i.test(lang)) ? 'both' : /^eng|inggris/i.test(lang) ? 'en' : 'id',
    level: level,
    minAge: intIn_(g('minAge'), 0, 99, 0),
    contentWarnings: clip_(g('contentWarnings'), 400),
    safetyTools: clip_(g('safetyTools'), 200),
    genres: categoryKeys_(g('genres'), GENRE_LABELS),
    styles: categoryKeys_(g('styles'), STYLE_LABELS),
    coverId: driveId_(g('cover')),
    consent: str_(g('consent')) !== '',
  });
}

/** What the content of a row hashes: only the form's own columns, so admin edits don't count as GM edits. */
function contentHash_(row, headers) {
  const own = headers.filter(function (h) { return ADMIN_COLUMNS.indexOf(h) < 0 && h !== COMMON_COLUMNS.timestamp; });
  return hashOf_(own.map(function (h) { return str_(row.display[h]); }));
}

/** The current profile per email: the last row wins; earlier rows of that email are "superseded". */
function currentGms_(gms) {
  const byEmail = {};
  gms.forEach(function (g) { if (g.email) byEmail[g.email] = g; });
  return gms.filter(function (g) { return byEmail[g.email] === g; });
}

/**
 * The public site's data: approved games whose GM is approved too, not expired, with only public fields.
 * `games` and `gms` are records (gameFromRow_ / gmFromRow_ results with admin fields).
 */
function buildPublic_(games, gms, nowMs) {
  const current = currentGms_(gms).filter(function (g) { return g.status === 'approved' && g.name && g.whatsapp && g.consent; });
  const gmByEmail = {};
  current.forEach(function (g) { gmByEmail[g.email] = g; });
  const live = games.filter(function (g) {
    return g.status === 'approved' && !g.superseded && g.title && g.startsAt && g.expiresAt && Date.parse(g.expiresAt) > nowMs && gmByEmail[g.email] && g.consent;
  });
  return {
    generatedAt: new Date(nowMs).toISOString(),
    gms: current.map(function (g) {
      return { id: g.id, slug: g.slug, name: g.name, bio: g.bio, city: g.city, systems: g.systems, photoId: g.photoId, whatsapp: g.whatsapp, discord: g.discord };
    }),
    games: live.map(function (g) {
      return {
        id: g.id, slug: g.slug, gmId: gmByEmail[g.email].id, title: g.title, system: g.system, summary: g.summary, description: g.description,
        format: g.format, locationType: g.locationType, platform: g.platform, city: g.city, venueName: g.venueName, venueMapsUrl: g.venueMapsUrl,
        startsAt: g.startsAt, zone: g.zone, scheduleNote: g.scheduleNote, expiresAt: g.expiresAt, priceIdr: g.priceIdr, seats: g.seats,
        language: g.language, level: g.level, minAge: g.minAge, contentWarnings: g.contentWarnings, safetyTools: g.safetyTools,
        genres: g.genres, styles: g.styles, coverId: g.coverId, featured: g.featured, listedAt: g.reviewedAt || g.submittedAt,
      };
    }),
  };
}

/** An approved or rejected record changes the public site when it is, or was, approved. */
function affectsPublic_(before, after) {
  return before.status === 'approved' || after.status === 'approved';
}

// ---------------------------------------------------------------------------------------------
// The API, written against a store and a few services so tests can run it without Google.
//   deps = { now(): ms, verify(token): email|'' , owner(): email, store, notify(kind,{...}), markDirty(), deployNow() }
//   store = { load(kind): rows, update(kind, rowNum, patch), admins(): [{email,addedBy,addedAt}], addAdmin(email,by,at), removeAdmin(email),
//             shareFile(id, on) }
// ---------------------------------------------------------------------------------------------

function fail_(code, extra) {
  return Object.assign({ ok: false, error: code }, extra || {});
}

function loadRecords_(store, kind) {
  const rows = store.load(kind);
  return rows.map(kind === 'game' ? gameFromRow_ : gmFromRow_);
}

/**
 * Gives new rows an id and a pending status, sends edited rows back to pending, marks superseded profiles.
 * Idempotent: running it twice in a row changes nothing the second time.
 */
function sync_(store, nowMs) {
  const result = { newPending: [], edited: 0, dirty: false };
  ['game', 'gm'].forEach(function (kind) {
    const headers = store.headers(kind);
    const rows = store.load(kind);
    rows.forEach(function (row) {
      if (!str_(row.cells[COMMON_COLUMNS.timestamp]) && !str_(row.cells[COMMON_COLUMNS.email])) return; // an empty row
      const rec = kind === 'game' ? gameFromRow_(row) : gmFromRow_(row);
      const hash = contentHash_(row, headers);
      const stored = str_(admin_(row, 'Hash'));
      const picture = kind === 'game' ? rec.coverId : rec.photoId;
      if (!rec.id) {
        const id = makeId_(kind === 'game' ? 'g' : 'm', rec.email + '|' + rec.submittedAt + '|' + row.rowNum);
        const title = kind === 'game' ? rec.title : rec.name;
        store.update(kind, row.rowNum, { Id: id, Status: 'pending', Hash: hash, Slug: slugify_(title) + '-' + id.slice(-4) });
        // Viewable by link (an unguessable address) so that every admin sees it on the review page, not just the owner.
        if (picture) store.shareFile(picture, true);
        result.newPending.push({ kind: kind, id: id, title: title });
      } else if (stored !== hash) {
        if (picture && rec.status !== 'rejected') store.shareFile(picture, true);
        const wasApproved = rec.status === 'approved';
        const patch = { Hash: hash };
        if (stored) { // not the first time we see it: the GM edited the response
          patch.Status = 'pending';
          patch.ReviewedBy = '';
          patch.ReviewedAt = '';
          patch.RejectReason = '';
          result.edited++;
          if (wasApproved) result.dirty = true; // it just left the public site
        }
        store.update(kind, row.rowNum, patch);
      }
    });
  });
  // Mark older profiles of the same email as superseded.
  const gmRows = store.load('gm');
  const gms = gmRows.map(gmFromRow_);
  const current = {};
  currentGms_(gms).forEach(function (g) { current[g.row] = true; });
  gmRows.forEach(function (row) {
    const rec = gmFromRow_(row);
    if (!rec.id) return;
    const want = current[rec.row] ? '' : 'yes';
    if (str_(admin_(row, 'Superseded')) !== want) {
      store.update('gm', row.rowNum, { Superseded: want });
      if (rec.status === 'approved') result.dirty = true;
    }
  });
  return result;
}

function queue_(deps) {
  const store = deps.store;
  sync_(store, deps.now());
  const games = loadRecords_(store, 'game').filter(function (g) { return g.id && !g.superseded; });
  const gms = currentGms_(loadRecords_(store, 'gm').filter(function (g) { return g.id; }));
  const cutoff = deps.now() - 30 * DAY_MS;
  return {
    ok: true,
    now: new Date(deps.now()).toISOString(),
    games: games.filter(function (g) { return !g.expiresAt || Date.parse(g.expiresAt) > cutoff; }),
    gms: gms,
    admins: store.admins(),
    owner: deps.owner(),
    deploy: deps.deployInfo(),
  };
}

function patchOf_(kind, rec, status, reviewer, nowMs, reason) {
  const patch = { Status: status, ReviewedBy: reviewer, ReviewedAt: new Date(nowMs).toISOString(), RejectReason: status === 'rejected' ? clip_(reason, 500) : '' };
  return patch;
}

function review_(deps, email, req) {
  const store = deps.store;
  const kind = req.kind === 'gm' ? 'gm' : req.kind === 'game' ? 'game' : '';
  const status = req.status;
  if (!kind || ['pending', 'approved', 'rejected'].indexOf(status) < 0 || !Array.isArray(req.ids) || req.ids.length === 0 || req.ids.length > 50) return fail_('bad_request');
  const records = loadRecords_(store, kind);
  const done = [];
  let dirty = false;
  req.ids.forEach(function (id) {
    const rec = records.filter(function (r) { return r.id === id; })[0];
    if (!rec) return;
    const patch = patchOf_(kind, rec, status, email, deps.now(), req.reason);
    store.update(kind, rec.row, patch);
    const after = Object.assign({}, rec, { status: status });
    if (affectsPublic_(rec, after) && rec.status !== status) dirty = true;
    const fileId = kind === 'game' ? rec.coverId : rec.photoId;
    if (fileId) store.shareFile(fileId, status === 'approved' || status === 'pending');
    if (req.notify && rec.status !== status && (status === 'approved' || status === 'rejected')) {
      deps.notify(status, { kind: kind, record: rec, reason: clip_(req.reason, 500), by: email });
    }
    done.push(id);
  });
  if (dirty) deps.markDirty();
  return { ok: true, updated: done, publishing: dirty };
}

function patch_(deps, email, req) {
  const store = deps.store;
  const kind = req.kind === 'gm' ? 'gm' : req.kind === 'game' ? 'game' : '';
  const rec = kind ? loadRecords_(store, kind).filter(function (r) { return r.id === req.id; })[0] : null;
  if (!rec) return fail_('not_found');
  const patch = {};
  let dirty = false;
  if (typeof req.featured === 'boolean' && kind === 'game') {
    patch.Featured = req.featured ? 'yes' : '';
    dirty = rec.status === 'approved' && rec.featured !== req.featured;
  }
  if (typeof req.adminNote === 'string') patch.AdminNote = clip_(req.adminNote, 1000);
  if (Object.keys(patch).length === 0) return fail_('bad_request');
  store.update(kind, rec.row, patch);
  if (dirty) deps.markDirty();
  return { ok: true, publishing: dirty };
}

function addAdmin_(deps, by, req) {
  const email = str_(req.email).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) return fail_('bad_request');
  if (deps.store.admins().some(function (a) { return a.email === email; }) || email === deps.owner()) return { ok: true, admins: deps.store.admins() };
  deps.store.addAdmin(email, by, new Date(deps.now()).toISOString());
  return { ok: true, admins: deps.store.admins() };
}

function removeAdmin_(deps, by, req) {
  const email = str_(req.email).toLowerCase();
  if (email === deps.owner()) return fail_('forbidden', { message: 'owner' });
  if (email === by) return fail_('forbidden', { message: 'self' });
  deps.store.removeAdmin(email);
  return { ok: true, admins: deps.store.admins() };
}

/** Routes one admin API call. `req.token` is a Google ID token. */
function handle_(req, deps) {
  if (!req || typeof req !== 'object' || typeof req.action !== 'string') return fail_('bad_request');
  const email = deps.verify(str_(req.token));
  if (!email) return fail_('unauthorized');
  const admins = deps.store.admins().map(function (a) { return a.email; });
  const isAdmin = email === deps.owner() || admins.indexOf(email) >= 0;
  if (!isAdmin) return fail_('forbidden', { email: email });
  switch (req.action) {
    case 'whoami': return { ok: true, email: email, owner: email === deps.owner() };
    case 'queue': return queue_(deps);
    case 'review': return review_(deps, email, req);
    case 'patch': return patch_(deps, email, req);
    case 'admin.add': return addAdmin_(deps, email, req);
    case 'admin.remove': return removeAdmin_(deps, email, req);
    case 'deploy': return deps.deployNow() ? { ok: true } : fail_('deploy_failed');
    default: return fail_('bad_request');
  }
}

/** The one-line summary a notification email uses for a record. */
function titleOf_(rec) {
  return rec.kind === 'game' ? rec.title : rec.name;
}

/** Subject and body of the email a GM gets when an admin approves or rejects (English and Indonesian together). */
function decisionEmail_(status, info, siteUrl) {
  const rec = info.record;
  const title = titleOf_(rec);
  // The site's pages live under /en/ and /id/ (a bare /games/... is a 404): each half of the email links its own language.
  const link = function (lang) { return siteUrl ? '\n' + siteUrl.replace(/\/$/, '') + '/' + lang + '/' + (rec.kind === 'game' ? 'games/' : 'gm/') + rec.slug + '/' : ''; };
  if (status === 'approved') {
    return {
      subject: 'Approved: ' + title + ' / Disetujui: ' + title,
      body: 'Hi,\n\n“' + title + '” was approved and will appear on the Quest Board within a few minutes.' + link('en') + '\n\n' +
        'To change something later, open your form response with the “Edit your response” link; it goes back to review.\n\n— The Pandemonium Kollektive\n\n' +
        '—\n\nHalo,\n\n“' + title + '” sudah disetujui dan akan tampil di Quest Board dalam beberapa menit.' + link('id') + '\n\n' +
        'Untuk mengubah sesuatu nanti, buka jawaban formulirmu lewat tautan “Edit your response”; setelah itu ditinjau lagi.\n\n— The Pandemonium Kollektive',
    };
  }
  const why = info.reason ? info.reason : '(no reason given / tanpa alasan)';
  return {
    subject: 'Not approved yet: ' + title + ' / Belum disetujui: ' + title,
    body: 'Hi,\n\n“' + title + '” was not approved yet.\n\nReason: ' + why + '\n\nPlease fix it with the “Edit your response” link of your form submission; it will be reviewed again.\n\n— The Pandemonium Kollektive\n\n' +
      '—\n\nHalo,\n\n“' + title + '” belum disetujui.\n\nAlasan: ' + why + '\n\nSilakan perbaiki lewat tautan “Edit your response” pada jawaban formulirmu; nanti ditinjau lagi.\n\n— The Pandemonium Kollektive',
  };
}

// ---------------------------------------------------------------------------------------------
// Google-facing code. Not unit-tested: keep it thin.
// ---------------------------------------------------------------------------------------------

function prop_(key) {
  return PropertiesService.getScriptProperties().getProperty(key) || '';
}

function setProp_(key, value) {
  PropertiesService.getScriptProperties().setProperty(key, String(value));
}

function spreadsheet_() {
  const id = prop_('SHEET_ID');
  if (!id) throw new Error('Run setup() once from the script editor first.');
  return SpreadsheetApp.openById(id);
}

function tabOf_(kind) {
  const sheet = findTab_(spreadsheet_(), kind === 'game' ? TAB.games : TAB.gms);
  if (!sheet) throw new Error('The tab "' + (kind === 'game' ? TAB.games : TAB.gms) + '" is missing.');
  return sheet;
}

function sheetStore_() {
  return {
    headers: function (kind) {
      const sheet = tabOf_(kind);
      return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(canonicalHeader_);
    },
    load: function (kind) {
      const sheet = tabOf_(kind);
      const lastRow = sheet.getLastRow();
      const lastCol = sheet.getLastColumn();
      if (lastRow < 2) return [];
      const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(canonicalHeader_);
      const range = sheet.getRange(2, 1, lastRow - 1, lastCol);
      const values = range.getValues();
      const display = range.getDisplayValues();
      return values.map(function (vals, i) {
        const cells = {};
        const disp = {};
        headers.forEach(function (h, c) { if (h) { cells[h] = vals[c]; disp[h] = display[i][c]; } });
        return { rowNum: i + 2, cells: cells, display: disp };
      });
    },
    update: function (kind, rowNum, patch) {
      const sheet = tabOf_(kind);
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(canonicalHeader_);
      Object.keys(patch).forEach(function (h) {
        const col = headers.indexOf(h);
        if (col >= 0) sheet.getRange(rowNum, col + 1).setValue(patch[h]);
      });
    },
    admins: function () {
      const sheet = spreadsheet_().getSheetByName(TAB.admins);
      if (!sheet || sheet.getLastRow() < 2) return [];
      return sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues()
        .map(function (r) { return { email: str_(r[0]).toLowerCase(), addedBy: str_(r[1]), addedAt: iso_(r[2]) }; })
        .filter(function (a) { return a.email; });
    },
    addAdmin: function (email, by, at) {
      spreadsheet_().getSheetByName(TAB.admins).appendRow([email, by, at]);
    },
    removeAdmin: function (email) {
      const sheet = spreadsheet_().getSheetByName(TAB.admins);
      const rows = sheet.getLastRow() < 2 ? [] : sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
      for (let i = rows.length - 1; i >= 0; i--) if (str_(rows[i][0]).toLowerCase() === email) sheet.deleteRow(i + 2);
    },
    shareFile: function (fileId, on) {
      try {
        const file = DriveApp.getFileById(fileId);
        if (on) file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        else file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
      } catch (e) {
        console.warn('Could not change sharing of ' + fileId + ': ' + e);
      }
    },
  };
}

/** Checks a Google ID token with Google and returns the verified email, or ''. Cached for 10 minutes. */
function verifyToken_(token) {
  if (!token || token.length > 4096) return '';
  const cache = CacheService.getScriptCache();
  const key = 'tok_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token)).slice(0, 40);
  const hit = cache.get(key);
  if (hit) return hit;
  const res = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token), { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) return '';
  let info;
  try { info = JSON.parse(res.getContentText()); } catch (e) { return ''; }
  const clientId = prop_('CLIENT_ID');
  const valid = clientId && info.aud === clientId && String(info.email_verified) === 'true' && Number(info.exp) * 1000 > Date.now() && /^https:\/\/accounts\.google\.com$|^accounts\.google\.com$/.test(info.iss || '');
  if (!valid || !info.email) return '';
  const email = String(info.email).toLowerCase();
  cache.put(key, email, 600);
  return email;
}

function ownerEmail_() {
  return String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
}

function deployInfo_() {
  return { lastAt: Number(prop_('LAST_DEPLOY') || 0) || null, pending: !!prop_('DIRTY_AT'), configured: !!prop_('DEPLOY_HOOK') };
}

function markDirty_() {
  setProp_('DIRTY_AT', Date.now());
}

/** Asks Cloudflare Pages to rebuild the site. Returns whether the request was accepted. */
function deployNow_() {
  const hook = prop_('DEPLOY_HOOK');
  if (!hook) return false;
  try {
    const res = UrlFetchApp.fetch(hook, { method: 'post', muteHttpExceptions: true });
    const ok = res.getResponseCode() >= 200 && res.getResponseCode() < 300;
    if (ok) {
      setProp_('LAST_DEPLOY', Date.now());
      PropertiesService.getScriptProperties().deleteProperty('DIRTY_AT');
      const day = new Date().toISOString().slice(0, 10);
      setProp_('DEPLOY_COUNT', (prop_('DEPLOY_DAY') === day ? Number(prop_('DEPLOY_COUNT') || 0) : 0) + 1);
      setProp_('DEPLOY_DAY', day);
    }
    return ok;
  } catch (e) {
    console.error('Deploy hook failed: ' + e);
    return false;
  }
}

function notify_(status, info) {
  const rec = info.record;
  if (!rec.email) return;
  const mail = decisionEmail_(status, info, prop_('SITE_URL'));
  try {
    MailApp.sendEmail({ to: rec.email, subject: mail.subject, body: mail.body, name: 'Quest Board TPK' });
  } catch (e) {
    console.warn('Could not email ' + rec.email + ': ' + e);
  }
}

function sheetDeps_() {
  return {
    now: function () { return Date.now(); },
    verify: verifyToken_,
    owner: ownerEmail_,
    store: sheetStore_(),
    notify: notify_,
    markDirty: markDirty_,
    deployNow: deployNow_,
    deployInfo: deployInfo_,
  };
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Compares two secrets without stopping at the first difference. */
function safeEqual_(a, b) {
  const x = str_(a);
  const y = str_(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x.charCodeAt(i) || 0) ^ (y.charCodeAt(i) || 0);
  return diff === 0;
}

/** The public data for the website build: GET <web app url>?action=public&key=<BUILD_KEY> */
function doGet(e) {
  const action = e && e.parameter ? e.parameter.action : '';
  if (action === 'public') {
    // The web app's address is public (the admin page needs it), and this data holds the GMs' WhatsApp numbers: only
    // the site's build, which knows the key, may read it. No key set means closed, not open.
    const key = prop_('BUILD_KEY');
    if (!key || !safeEqual_(e.parameter.key, key)) return json_(fail_('forbidden'));
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      const deps = sheetDeps_();
      sync_(deps.store, deps.now());
      const games = loadRecords_(deps.store, 'game');
      const gms = loadRecords_(deps.store, 'gm');
      return json_(buildPublic_(games, gms, deps.now()));
    } finally {
      lock.releaseLock();
    }
  }
  return json_({ ok: true, name: 'quest-board-tpk', version: VERSION });
}

/** The admin API: POST <web app url> with a JSON body sent as text/plain (no CORS pre-flight). */
function doPost(e) {
  let req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_(fail_('bad_request'));
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    return json_(handle_(req, sheetDeps_()));
  } catch (err) {
    console.error(err);
    return json_(fail_('server_error'));
  } finally {
    lock.releaseLock();
  }
}

/** Every minute: pick up new and edited responses, tell the admins, and rebuild the site when something public changed. */
function tick() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return;
  try {
    const deps = sheetDeps_();
    const result = sync_(deps.store, deps.now());
    if (result.dirty) markDirty_();
    notifyAdminsOfNew_(result.newPending, deps);
    const dirtyAt = Number(prop_('DIRTY_AT') || 0);
    const now = Date.now();
    const last = Number(prop_('LAST_DEPLOY') || 0);
    const day = new Date().toISOString().slice(0, 10);
    const today = prop_('DEPLOY_DAY') === day ? Number(prop_('DEPLOY_COUNT') || 0) : 0;
    // Wait a minute after the last change (so a burst of approvals is one build), at most one build per 5 minutes and 20 a day.
    if (dirtyAt && now - dirtyAt >= 60 * 1000 && now - last >= 5 * 60 * 1000 && today < 20) deployNow_();
  } finally {
    lock.releaseLock();
  }
}

function notifyAdminsOfNew_(newPending, deps) {
  if (!newPending.length) return;
  const waiting = loadRecords_(deps.store, 'game').filter(function (g) { return g.status === 'pending' && !g.superseded; }).length +
    currentGms_(loadRecords_(deps.store, 'gm')).filter(function (g) { return g.status === 'pending'; }).length;
  const last = Number(prop_('LAST_NOTIFY') || 0);
  const pendingNow = Number(prop_('NOTIFY_BACKLOG') || 0) + newPending.length;
  if (Date.now() - last < 30 * 60 * 1000) { setProp_('NOTIFY_BACKLOG', pendingNow); return; }
  const to = [deps.owner()].concat(deps.store.admins().map(function (a) { return a.email; })).filter(function (v, i, a) { return v && a.indexOf(v) === i; });
  const adminUrl = prop_('SITE_URL') ? prop_('SITE_URL').replace(/\/$/, '') + '/en/admin/' : '';
  const titles = newPending.slice(0, 5).map(function (p) { return '• ' + p.title; }).join('\n');
  const body = pendingNow + ' new submission(s) on Quest Board TPK:\n' + titles + (newPending.length > 5 ? '\n…' : '') + '\n\n' + waiting + ' waiting for review in total.' + (adminUrl ? '\nReview: ' + adminUrl : '');
  try {
    MailApp.sendEmail({ to: to.join(','), subject: waiting + ' waiting for review on Quest Board TPK', body: body, name: 'Quest Board TPK' });
    setProp_('LAST_NOTIFY', Date.now());
    setProp_('NOTIFY_BACKLOG', 0);
  } catch (e) {
    console.warn('Could not email the admins: ' + e);
  }
}

/** Every night: rebuild once so listings whose date has passed disappear. */
function nightly() {
  deployNow_();
}

const BACKUP_FOLDER = 'Quest Board TPK backups';
const BACKUPS_KEPT = 8;

/** Which backup files to trash: everything but the newest `keep`. files = [{ id, createdMs }]. */
function backupsToTrash_(files, keep) {
  return files.slice().sort(function (a, b) { return b.createdMs - a.createdMs; }).slice(keep).map(function (f) { return f.id; });
}

/** Every Monday: a dated copy of the whole Sheet (it is the database) in a Drive folder; the newest few are kept. */
function backup() {
  const file = DriveApp.getFileById(spreadsheet_().getId());
  const folders = DriveApp.getFoldersByName(BACKUP_FOLDER);
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(BACKUP_FOLDER);
  file.makeCopy('Quest Board TPK backup ' + new Date().toISOString().slice(0, 10), folder);
  const copies = [];
  const files = folder.getFiles();
  while (files.hasNext()) {
    const f = files.next();
    copies.push({ id: f.getId(), createdMs: f.getDateCreated().getTime() });
  }
  backupsToTrash_(copies, BACKUPS_KEPT).forEach(function (id) { DriveApp.getFileById(id).setTrashed(true); });
}

function newBuildKey_() {
  return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
}

function logBuildKey_() {
  console.log('Build key: in Cloudflare, TPK_API_URL = <the web app URL ending in /exec>?key=' + prop_('BUILD_KEY') + '  (keep it private)');
}

/** Run by hand to replace the build key (say, after it was shown somewhere). Then put the new key in Cloudflare's TPK_API_URL. */
function rotateBuildKey() {
  setProp_('BUILD_KEY', newBuildKey_());
  logBuildKey_();
}

/**
 * Run once from the script editor (Run > setup). Prepares the Sheet and the triggers; safe to run again.
 * Check View > Logs afterwards: it lists anything still missing.
 */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  setProp_('SHEET_ID', ss.getId());
  ss.setSpreadsheetTimeZone('Asia/Jakarta');
  ss.setSpreadsheetLocale('en_US'); // dates as 9/28/2026 and times as 7:00:00 PM, which parseDate_ and parseTime_ read
  const problems = [];
  [['game', TAB.games, GAME_COLUMNS], ['gm', TAB.gms, GM_COLUMNS]].forEach(function (t) {
    const sheet = findTab_(ss, t[1]);
    if (!sheet) { problems.push('Tab "' + t[1] + '" is missing: link the form to this Sheet, then rename its tab.'); return; }
    const headers = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0].map(canonicalHeader_);
    ADMIN_COLUMNS.forEach(function (h) {
      if (headers.indexOf(h) < 0) { sheet.getRange(1, headers.length + 1).setValue(h); headers.push(h); }
    });
    sheet.setFrozenRows(1);
    Object.keys(t[2]).forEach(function (f) {
      if (headers.indexOf(t[2][f]) < 0) problems.push('Tab "' + t[1] + '": no column titled "' + t[2][f] + '" (a form question was renamed or is missing).');
    });
    [COMMON_COLUMNS.timestamp, COMMON_COLUMNS.email].forEach(function (h) {
      if (headers.indexOf(h) < 0) problems.push('Tab "' + t[1] + '": no column titled "' + h + '" (turn on "Collect email addresses" in the form).');
    });
  });
  let admins = ss.getSheetByName(TAB.admins);
  if (!admins) {
    admins = ss.insertSheet(TAB.admins);
    admins.appendRow(['Email', 'AddedBy', 'AddedAt']);
    admins.setFrozenRows(1);
  }
  ScriptApp.getProjectTriggers().forEach(function (tr) {
    if (['tick', 'nightly', 'backup'].indexOf(tr.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(tr);
  });
  ScriptApp.newTrigger('tick').timeBased().everyMinutes(1).create();
  ScriptApp.newTrigger('nightly').timeBased().atHour(0).nearMinute(30).everyDays(1).create();
  ScriptApp.newTrigger('backup').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(3).create();
  if (!prop_('BUILD_KEY')) setProp_('BUILD_KEY', newBuildKey_());
  logBuildKey_();
  ['CLIENT_ID', 'DEPLOY_HOOK', 'SITE_URL'].forEach(function (k) {
    if (!prop_(k)) problems.push('Script property ' + k + ' is not set yet (Project Settings > Script properties).');
  });
  console.log(problems.length ? 'Setup done, but:\n- ' + problems.join('\n- ') : 'Setup done. Everything is in place.');
  return problems;
}
