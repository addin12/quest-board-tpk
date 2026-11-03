// How typed text finds things: lower case, accents off, and the short names and spellings people use for the same thing (dnd, d&d, sci fi, science fiction,
// coc, vtm ...). Pure module, shared by every search box (the games list, the systems page, the filter pickers). The words are matched as parts of the
// text, so "tact" finds "Tactical"; `searchText` adds the synonyms to the text that is searched, so "dnd" finds "Dungeons & Dragons 5.5e 2024".

/** Lower case with the accents taken off, for matching what a person typed (Mork finds Mörk). */
export const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");

/** When the pattern is found in the normalised text, these extra words count as part of it. A function gets the match (an edition number, say). */
const ALIASES: [RegExp, string | ((m: RegExpMatchArray) => string)][] = [
  // game systems
  [/dungeons (?:&|and) dragons/, "dnd d&d d and d dungeons and dragons"],
  [/advanced dungeons (?:&|and) dragons/, "adnd ad&d add"],
  [/dungeons (?:&|and) dragons 5\.5e/, "dnd5.5e dnd 5.5 one dnd onednd dnd24"],
  [/dungeons (?:&|and) dragons 5e 2014/, "dnd5e dnd5 dnd14"],
  [/dungeons (?:&|and) dragons (?:3e|3\.5e)/, "dnd3e dnd3 dnd 3.5"],
  [/dungeons (?:&|and) dragons b\/x/, "bx basic dnd"],
  [/dungeon crawl classics/, "dcc"],
  [/dungeon world/, "dw"],
  [/pathfinder (\d)e/, (m) => `pf pf${m[1]} pf${m[1]}e`],
  [/call of cthulhu/, "coc cthulhu"],
  [/vampire: the masquerade/, "vtm vampire masquerade"],
  [/vampire: the requiem/, "vtr vampire requiem"],
  [/werewolf: the apocalypse/, "wta werewolf apocalypse"],
  [/mage: the (ascension|awakening)/, "mta mage"],
  [/blades in the dark/, "bitd"],
  [/monster of the week/, "motw"],
  [/shadowrun (\d)e/, (m) => `sr sr${m[1]} sr${m[1]}e`],
  [/warhammer fantasy roleplay (\d)e/, (m) => `wfrp wfrp${m[1]}e whfrp warhammer`],
  [/warhammer 40,000/, "wh40k 40k"],
  [/wrath (?:&|and) glory/, "wng w&g"],
  [/cyberpunk red/, "cpr cp red cyberpunk"],
  [/legend of the five rings (\d)/, (m) => `l5r l5r${m[1]}e legend five rings`],
  [/savage worlds/, "sw swade savage worlds"],
  [/mutants (?:&|and) masterminds (\d)e/, (m) => `mm mm${m[1]}e mnm m&m`],
  [/old-school essentials/, "ose"],
  [/star trek adventures/, "sta"],
  [/star wars rpg|star wars 5e/, "swrpg sw5e star wars sw"],
  [/kids on (?:bikes|brooms)/, "kob"],
  [/the one ring/, "tor"],
  // more, from community glossaries (RPGnet's list of game title abbreviations, Collabs Without Permission's acronym index, forum threads)
  [/mothership/, "mosh"],
  [/m(?:ö|o)rk borg|mythic bastionland|pirate borg|cy_borg/, "mb borg"],
  [/electric bastionland/, "eb ito into the odd"],
  [/mutant: year zero/, "myz year zero yze"],
  [/tales from the loop/, "tftl"],
  [/chronicles of darkness|vampire: the requiem|mage: the awakening|changeling: the lost/, "cofd nwod chronicles of darkness world of darkness wod"],
  [/changeling: the lost/, "ctl changeling"],
  [/vampire: the masquerade (?:revised|20th)|mage: the ascension|werewolf: the apocalypse 20th/, "owod old world of darkness wod"],
  [/vampire: the masquerade 5e/, "v5 vtm5 wod"],
  [/werewolf: the apocalypse 5th/, "w5 wta5 wod"],
  [/hunter: the reckoning 5th/, "h5 htr wod"],
  [/dungeons (?:&|and) dragons 4e/, "dnd4e dnd4"],
  [/starfinder (\d)e/, (m) => `sf sf${m[1]}e`],
  [/delta green/, "dg"],
  [/twilight: 2000/, "t2k t2000"],
  [/traveller/, "trav"],
  [/classic traveller/, "ct cepheus"],
  [/traveller \(mongoose (\d)/, (m) => `mgt mgt${m[1]}e mongoose`],
  [/exalted (\d)(?:nd|rd)/, (m) => `ex ex${m[1]}e`],
  [/monsterhearts (\d)e/, (m) => `mh mh${m[1]}e`],
  [/legend in the mist/, "litm"],
  [/tales of the valiant/, "totv"],
  [/fabula ultima/, "fu"],
  [/level up advanced 5th/, "a5e"],
  [/pokemon tabletop united/, "ptu pokemon"],
  [/shadowdark/, "sd"],
  [/daggerheart/, "dh"],
  [/fate accelerated/, "fae"],
  [/scum and villainy/, "sav"],
  [/apocalypse world|apocalypse keys/, "aw"],
  [/urban shadows/, "us"],
  [/gurps (\d)e/, (m) => `gurps${m[1]}e gurps`],
  // Nimble Co. calls the first book "Nimble 5e" and the second "Nimble v2" (its blog) or "Nimble 2" (its crowdfunding page); fans write "2e" or "2.0"
  [/nimble 5e/, "nimble v1 nimble 1 nimble 1e nimble 1.0 nimble5e"],
  [/nimble 2e/, "nimble v2 nimble 2 nimble 2.0 nimble2e"],
  [/knave (\d)e/, (m) => `knave${m[1]}e`],
  [/forged in the dark/, "fitd"],
  [/powered by the apocalypse/, "pbta"],
  [/percentile/, "d100 d% percentile"],
  [/diceless/, "no dice no-dice narrative"],
  [/old-school \(osr\)/, "osr oldschool old school"],
  // genres and styles
  [/sci-?fi|science fiction|fiksi ilmiah/, "sci-fi scifi sci fi science fiction fiksi ilmiah"],
  [/post-?apocalyptic|pasca-?kiamat/, "post apocalyptic postapocalyptic apocalypse post-apoc pasca kiamat pasca-kiamat"],
  [/super ?hero(?:es)?/, "superhero superheroes super hero super heroes"],
  [/high-? ?fantasy/, "high fantasy highfantasy"],
  [/dark-? ?fantasy/, "dark fantasy darkfantasy"],
  [/urban(?: fantasy)?/, "urban fantasy"],
  [/role-? ?play|roleplaying/, "roleplay role play role-play roleplaying rp rpg"],
  [/horror|horor/, "horror horor scary"],
  [/mystery|misteri/, "mystery misteri whodunit"],
  [/fantasy|fantasi/, "fantasy fantasi"],
  [/comedy|komedi/, "comedy komedi funny"],
  [/\bcozy\b/, "cozy cosy"],
  [/theater of the mind|theatre of the mind/, "theater of the mind theatre of the mind totm"],
  [/rules-as-written|rules as written/, "rules as written raw"],
  [/dungeon-? ?crawl/, "dungeon crawl dungeoncrawl delve"],
  [/west-? ?marches/, "west marches westmarches"],
  [/eldritch horror|gothic horror/, "horror cosmic lovecraftian lovecraft gothic eldritch"],
  [/hexcrawl/, "hex crawl hexcrawl"],
  [/political intrigue/, "politics intrigue"],
  [/espionage/, "spy spies espionage"],
  [/heartwarming/, "wholesome heartwarming"],
  [/wacky/, "zany silly wacky"],
  [/\bmodern\b/, "modern contemporary"],
  [/card-?based/, "cards card based card-based"],
  [/fate dice/, "fudge dice df fate fudge"],
  [/dice pool/, "dice pool dicepool pool"],
  [/\bd20 system|\bd20\b/, "d20 srd d20 system"],
  [/one[_ -]?shot/, "one-shot oneshot one shot os"],
  [/in[_ -]?person/, "in person irl offline face to face"],
  [/\bonline\b/, "online virtual remote vtt"],
  [/play-?by-?post/, "play by post pbp"],
  [/organized-? ?play/, "organized play organised play op"],
];

const cache = new Map<string, string>();

/**
 * The text to search: the normalised text, a copy with "&" written as "and", and the synonyms of whatever it contains.
 * @example searchText("Dungeons & Dragons 5.5e 2024").includes("dnd") // true
 */
export function searchText(s: string): string {
  const hit = cache.get(s);
  if (hit !== undefined) return hit;
  const text = norm(s);
  const extra: string[] = [];
  if (text.includes("&")) extra.push(text.replace(/&/g, "and"));
  for (const [pattern, words] of ALIASES) {
    const m = text.match(pattern);
    if (m) extra.push(typeof words === "string" ? words : words(m));
  }
  const out = extra.length ? `${text} ${extra.join(" ")}` : text;
  if (cache.size > 2000) cache.clear();
  cache.set(s, out);
  return out;
}

/** The words of what was typed. */
export const queryWords = (q: string): string[] => norm(q).split(/\s+/).filter(Boolean);

/** Every word typed appears somewhere in the (already `searchText`-ed) text. */
export const matchesWords = (hay: string, words: string[]): boolean => words.every((w) => hay.includes(w));
