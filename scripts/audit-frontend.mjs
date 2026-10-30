// Front-end audit of the built site against the measurable Anti-Slop rules (R-02 R-03 R-15 R-16 R-24 R-26 R-39 R-40) plus axe
// for contrast (R-25). Every page, both languages, both colour schemes, a phone and a desktop width. Prints findings grouped by rule.
//   npm run build && npm run preview     (in one terminal)
//   node scripts/audit-frontend.mjs      (in another; AUDIT_BASE and AUDIT_BROWSER=msedge are optional)
// Not covered (needs a person's eye): R-05 templated layouts, R-14 identical cards, R-19 motion, R-20 identity, R-29 palette.
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
const BASE = process.env.AUDIT_BASE || "http://localhost:4173";
const PAGES = ["", "games", "games/abomination-vaults-0a01", "gms", "gm/raka-pratama-0r01", "how-it-works", "list-your-game", "account", "admin"];
const BUZZ = /\b(seamless(ly)?|revolutionary|cutting[- ]edge|next[- ]gen|unleash|supercharge|game[- ]changing|world[- ]class|robust|elevate|empower|leverage|delve|streamline|effortless(ly)?)\b/i;
const GENERIC_CTA = /^(get started|learn more|click here|submit|read more|see more|continue|go|more)$/i;
const findings = {};
const add = (rule, where, msg) => ((findings[rule] ??= new Set()).add(`${where}: ${msg}`));

(async () => {
  const b = await chromium.launch(process.env.AUDIT_BROWSER ? { channel: process.env.AUDIT_BROWSER } : {});
  for (const lang of ["en", "id"]) {
    for (const scheme of ["light", "dark"]) {
      for (const [vw, vh] of [[390, 844], [1280, 900]]) {
        const ctx = await b.newContext({ viewport: { width: vw, height: vh }, colorScheme: scheme });
        for (const pg of PAGES) {
          const where = `${lang}/${pg || "home"} ${vw}px ${scheme}`;
          const p = await ctx.newPage();
          await p.goto(`${BASE}/${lang}/${pg}${pg ? "/" : ""}`, { waitUntil: "load" });
          await p.waitForTimeout(400);
          const r = await p.evaluate(({ BUZZ, GENERIC_CTA }) => {
            const out = { overflow: null, small: [], emdash: [], cta: [], buzz: [], img: [], sem: [], cursor: [], links: [], h1: 0, lang: document.documentElement.lang, title: document.title };
            const de = document.documentElement;
            if (de.scrollWidth > de.clientWidth + 1) out.overflow = `${de.scrollWidth} > ${de.clientWidth}`;
            const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
            const name = (el) => (el.getAttribute("aria-label") || el.textContent || el.getAttribute("title") || el.getAttribute("alt") || "").trim().replace(/\s+/g, " ").slice(0, 40);
            document.querySelectorAll("a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=tab]").forEach((el) => {
              if (!vis(el)) return;
              const r = el.getBoundingClientRect();
              const inline = el.tagName === "A" && getComputedStyle(el).display === "inline" && el.closest("p,li,dd,span,small");
              if ((r.height < 44 || r.width < 44) && !inline && !(el.type === "checkbox" || el.type === "radio")) out.small.push(`${el.tagName.toLowerCase()} "${name(el)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
              if ((el.tagName === "A" || el.tagName === "BUTTON") && !el.disabled && getComputedStyle(el).cursor !== "pointer") out.cursor.push(`${el.tagName.toLowerCase()} "${name(el)}" cursor ${getComputedStyle(el).cursor}`);
              if (el.tagName === "A") { const h = el.getAttribute("href"); if (!h || h === "#" || h.startsWith("javascript:")) out.links.push(`"${name(el)}" href=${h}`); }
              if (["BUTTON", "A"].includes(el.tagName) && !name(el) && !el.querySelector("img[alt]")) out.sem.push(`${el.tagName.toLowerCase()} without an accessible name`);
              if (["INPUT", "SELECT", "TEXTAREA"].includes(el.tagName) && !(el.labels && el.labels.length) && !el.getAttribute("aria-label") && !el.getAttribute("aria-labelledby")) out.sem.push(`${el.tagName.toLowerCase()}#${el.id || el.name} has no label`);
              const t = name(el); if (GENERIC_CTA.test(t)) out.cta.push(t);
            });
            const text = document.body.innerText;
            (text.match(/[^\n]{0,30}—[^\n]{0,30}/g) || []).forEach((m) => out.emdash.push(m.trim()));
            (text.match(new RegExp(BUZZ.source, "gi")) || []).forEach((m) => out.buzz.push(m));
            document.querySelectorAll("img").forEach((img) => {
              if (!vis(img)) return;
              if (!img.hasAttribute("alt")) out.img.push(`img ${img.getAttribute("src")?.slice(-30)} has no alt attribute`);
              if (!(img.getAttribute("width") && img.getAttribute("height")) && !getComputedStyle(img).aspectRatio.match(/\d/) && !img.closest("[style*=aspect], [class*=aspect]")) out.img.push(`img ${img.getAttribute("src")?.slice(-30)} has no width/height or aspect box`);
              const r = img.getBoundingClientRect();
              if (img.loading === "lazy" && r.top < innerHeight && r.height > 80) out.img.push(`img ${img.getAttribute("src")?.slice(-30)} is lazy but above the fold (R-40)`);
            });
            out.h1 = document.querySelectorAll("h1").length;
            ["main", "header", "nav", "footer"].forEach((l) => { if (!document.querySelector(l) && !document.querySelector(`[role=${l === "header" ? "banner" : l === "footer" ? "contentinfo" : l}]`)) out.sem.push(`no <${l}> landmark`); });
            return out;
          }, { BUZZ, GENERIC_CTA });
          if (r.overflow) add("R-03 overflow", where, r.overflow);
          [...new Set(r.small)].forEach((s) => add("R-03/R-26 target under 44px", where, s));
          [...new Set(r.emdash)].forEach((s) => add("R-02 em dash in visible text", where, s));
          [...new Set(r.cta)].forEach((s) => add("R-15 generic CTA", where, s));
          [...new Set(r.buzz)].forEach((s) => add("R-16 buzzword", where, s));
          r.img.forEach((s) => add("R-39/R-40 image", where, s));
          [...new Set(r.sem)].forEach((s) => add("R-39 semantics", where, s));
          [...new Set(r.cursor)].forEach((s) => add("R-39 pointer cursor", where, s));
          [...new Set(r.links)].forEach((s) => add("R-24/R-26 dead link", where, s));
          if (r.h1 !== 1) add("R-39 headings", where, `${r.h1} h1 elements`);
          if (!r.lang) add("R-39 document", where, "no html lang");
          if (!r.title) add("R-39 document", where, "no title");
          if (scheme === "light" || vw === 1280) {
            const ax = await new AxeBuilder({ page: p }).withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
            ax.violations.forEach((v) => add("R-25/R-39 axe " + v.id, where, `${v.help} (${v.nodes.length} nodes: ${v.nodes[0].target.join(" ").slice(0, 60)})`));
          }
          await p.close();
        }
        await ctx.close();
      }
    }
  }
  await b.close();
  for (const [rule, set] of Object.entries(findings).sort()) {
    const by = {};
    for (const line of set) { const [where, ...rest] = line.split(": "); (by[rest.join(": ")] ??= []).push(where); }
    console.log(`\n## ${rule}: ${Object.keys(by).length} distinct`);
    Object.entries(by).slice(0, 30).forEach(([m, w]) => console.log(`  [${w.length} runs, e.g. ${w[0]}] ${m}`));
  }
  if (!Object.keys(findings).length) console.log("no findings");
})();
