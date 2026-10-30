/**
 * Quest Board TPK: the mail relay. It is all that is left of the Google Sheet backend (ADR-27).
 *
 *   Cloudflare backend  --POST {action:'mail', secret, to, subject, body}-->  this web app  -->  the owner's Gmail
 *
 * The backend (worker/) has no domain of its own to send from, so it asks this script to send its sign-in links and decision
 * emails. Pushed with `npm run script:deploy`, which puts the secret into the pushed copy: it is never committed.
 * Pure helpers (names ending in _) are unit-tested with node: tests/unit/mail-relay.test.ts loads this file in a sandbox, so
 * keep Google calls out of them.
 */

const VERSION = '2.0.0';

/** The relay's shared secret, put here by scripts/push-apps-script.mjs. With the placeholder still in place the relay is off. */
const MAIL_SECRET = '__MAIL_SECRET__';
/** Gmail's own limit for a free account is about 100 recipients a day: stay under it, so a flood cannot lock the owner out of Gmail. */
const MAIL_DAILY_LIMIT = 90;

function str_(v) {
  return v === null || v === undefined ? '' : String(v).trim();
}

function clip_(v, max) {
  const s = str_(v);
  return s.length > max ? s.slice(0, max) : s;
}

/** Compares two secrets without stopping at the first difference. */
function safeEqual_(a, b) {
  const x = str_(a);
  const y = str_(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x.charCodeAt(i) || 0) ^ (y.charCodeAt(i) || 0);
  return diff === 0;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Checks one relay request; returns the mail to send, or { error }. Pure: the sending itself is in doPost. */
function mailRequest_(req, secret, sentToday) {
  if (!secret || secret.indexOf('__') === 0) return { error: 'mail_not_configured' };
  if (!safeEqual_(req.secret, secret)) return { error: 'unauthorized' };
  const to = str_(req.to).toLowerCase();
  if (!/^[^\s@,;<>"']+@[^\s@,;<>"']+\.[a-z]{2,}$/.test(to) || to.length > 254) return { error: 'bad_request' };
  const subject = clip_(req.subject, 200).replace(/[\r\n]+/g, ' ');
  const body = clip_(req.body, 5000);
  if (!subject || !body) return { error: 'bad_request' };
  if (sentToday >= MAIL_DAILY_LIMIT) return { error: 'quota' };
  return { to: to, subject: subject, body: body };
}

/** A browser or a monitor asking "is it there?": says nothing about the data. */
function doGet() {
  return json_({ ok: true, name: 'quest-board-tpk-mail', version: VERSION });
}

/** The relay: POST <web app url> with a JSON body sent as text/plain (no CORS pre-flight). */
function doPost(e) {
  let req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'bad_request' });
  }
  if (!req || req.action !== 'mail') return json_({ ok: false, error: 'bad_request' });
  const props = PropertiesService.getScriptProperties();
  const today = Utilities.formatDate(new Date(), 'Etc/UTC', 'yyyy-MM-dd');
  const counter = (props.getProperty('MAIL_DAY') || '').split(':');
  const sent = counter[0] === today ? Number(counter[1]) || 0 : 0;
  const m = mailRequest_(req, MAIL_SECRET, sent);
  if (m.error) return json_({ ok: false, error: m.error });
  props.setProperty('MAIL_DAY', today + ':' + (sent + 1));
  try {
    MailApp.sendEmail({ to: m.to, subject: m.subject, body: m.body, name: 'Quest Board TPK' });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'mail_failed' });
  }
  return json_({ ok: true });
}

/**
 * The Sheet backend ran three time triggers: tick (every minute), nightly and backup. Their functions are gone, so a trigger left
 * in the project would mail the owner an error each time it fires. Each stub removes every trigger of this project the first time
 * it is called, so the script cleans itself up within a minute of being deployed. Delete these four functions once no trigger
 * is listed under Triggers in the script editor.
 */
function retireOldTriggers_() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
}
function tick() { retireOldTriggers_(); }
function nightly() { retireOldTriggers_(); }
function backup() { retireOldTriggers_(); }
