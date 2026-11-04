// How typed text finds things: accents, "&" and "and", and the short names and other spellings people use.
import { test } from "node:test";
import assert from "node:assert/strict";
import { matchesWords, queryWords, searchText } from "../../src/lib/search.ts";
import { SYSTEMS } from "../../src/lib/systems.ts";

const finds = (text: string, typed: string) => matchesWords(searchText(text), queryWords(typed));

test("Dungeons & Dragons is found by its short names, with or without punctuation or capitals", () => {
  for (const typed of ["DnD", "dnd", "D&D", "d&d", "d and d", "D & D", "dungeons and dragons", "dnd 5.5e", "DND 2024"]) {
    assert.ok(finds("Dungeons & Dragons 5.5e 2024", typed), `"${typed}" finds 5.5e 2024`);
  }
  assert.ok(finds("Dungeons & Dragons 5e 2014", "dnd 2014"));
  assert.ok(!finds("Dungeons & Dragons 5e 2014", "dnd 2024"), "the 2014 rules are not the 2024 ones");
  assert.ok(!finds("Daggerheart", "dnd"), "other systems are not caught");
  assert.ok(finds("Advanced Dungeons & Dragons 2e", "ad&d"));
});

test("genres are found by their other spellings, in both languages", () => {
  for (const typed of ["science fiction", "sci fi", "scifi", "Sci-Fi", "sci-fi"]) assert.ok(finds("Sci-fi", typed), `"${typed}" finds Sci-fi`);
  assert.ok(finds("Fiksi ilmiah", "science fiction"), "the Indonesian name is found by the English one");
  assert.ok(finds("Fiksi ilmiah", "scifi"));
  assert.ok(finds("Post-apocalyptic", "post apocalyptic"));
  assert.ok(finds("Pasca-kiamat", "post apocalyptic"));
  assert.ok(finds("Superhero", "super heroes"));
  assert.ok(finds("Horror", "horor") && finds("horor", "horror"));
  assert.ok(!finds("Fantasy", "science fiction"));
});

test("game systems are found by their abbreviations", () => {
  const cases: [string, string[]][] = [
    ["Call of Cthulhu 7e", ["coc"]],
    ["Vampire: The Masquerade 5e", ["vtm"]],
    ["Pathfinder 2e", ["pf2e", "pf2", "pf"]],
    ["Shadowrun 6e", ["sr6", "sr"]],
    ["Blades in the Dark", ["bitd"]],
    ["Warhammer Fantasy Roleplay 4e", ["wfrp"]],
    ["Legend of the Five Rings 5th Edition", ["l5r"]],
    ["Mutants & Masterminds 3e", ["m&m", "mnm", "mutants and masterminds"]],
    ["Old-School Essentials", ["ose"]],
    ["Mörk Borg", ["mork borg", "MORK"]],
    ["Powered by the Apocalypse", ["pbta"]],
  ];
  for (const [system, typed] of cases) for (const t of typed) assert.ok(finds(system, t), `"${t}" finds ${system}`);
  assert.ok(!finds("Pathfinder 1e", "pf2e"), "the edition number is respected");
});

test("more abbreviations from community glossaries find the system they stand for", () => {
  const cases: [string, string[]][] = [
    ["Mothership", ["mosh"]],
    ["Mörk Borg", ["mb"]],
    ["Mythic Bastionland", ["mb"]],
    ["Mutant: Year Zero", ["myz", "yze"]],
    ["Tales From the Loop", ["tftl"]],
    ["Vampire: The Requiem 2nd Edition", ["cofd", "nwod", "vtr"]],
    ["Vampire: The Masquerade Revised Edition", ["owod", "wod", "vtm"]],
    ["Vampire: The Masquerade 5e", ["v5"]],
    ["Changeling: The Lost Second Edition", ["ctl", "cofd"]],
    ["Delta Green", ["dg"]],
    ["Twilight: 2000", ["t2k"]],
    ["Classic Traveller", ["ct", "trav"]],
    ["Traveller (Mongoose 2nd Edition)", ["mgt2e", "mgt"]],
    ["Exalted 3rd Edition", ["ex3e", "ex"]],
    ["Monsterhearts 2e", ["mh2e"]],
    ["Tales of the Valiant", ["totv"]],
    ["Fabula Ultima", ["fu"]],
    ["Level Up Advanced 5th Edition", ["a5e"]],
    ["Pokemon Tabletop United", ["ptu"]],
    ["Fate Accelerated", ["fae"]],
    ["Nimble v2", ["nimble 2e", "nimble 2", "nimble 2.0"]],
    ["Nimble 5e", ["nimble v1", "nimble 1.0"]],
    ["Starfinder 2e", ["sf2e"]],
    ["Star Wars RPG by Fantasy Flight Games", ["swrpg"]],
    ["Warhammer Fantasy Roleplay 4e", ["wfrp4e"]],
    ["Warhammer 40,000 Wrath & Glory", ["w&g", "wng", "wh40k"]],
    ["Legend of the Five Rings 5th Edition", ["l5r5e"]],
    ["Mutants & Masterminds 3e", ["mm3e"]],
    ["Eldritch horror", ["cosmic", "lovecraftian"]],
    ["Fate dice", ["fudge"]],
    ["Card-based", ["cards"]],
    ["Espionage", ["spy"]],
    ["Heartwarming", ["wholesome"]],
  ];
  for (const [text, typed] of cases) for (const t of typed) assert.ok(finds(text, t), `"${t}" finds ${text}`);
  assert.ok(!finds("Pathfinder 1e", "pf2e") && !finds("Warhammer Fantasy Roleplay 4e", "wfrp3e"), "the edition numbers still count");
});

test("a game is found by its format and place in the short words people use", () => {
  assert.ok(finds("Mercusuar one_shot in_person horror", "oneshot irl"));
  assert.ok(finds("Mercusuar campaign online", "virtual"));
});

test("every word must match, and nothing matches nothing", () => {
  assert.ok(finds("Cairn 2e", "cairn 2e"));
  assert.ok(!finds("Cairn 2e", "cairn 1e"));
  assert.ok(matchesWords("anything", []), "no words: everything matches");
  assert.equal(SYSTEMS.filter((s) => finds(s, "dnd")).length >= 6, true, "all the D&D editions answer to dnd");
  assert.equal(SYSTEMS.filter((s) => finds(s, "zzzz")).length, 0);
});

test("the mechanics taken over from StartPlaying are found by what people type", () => {
  assert.ok(finds("Powered by Mörk Borg", "mork borg"), "accents are off");
  assert.ok(finds("Narrative Dice System", "genesys"));
  assert.ok(finds("Year Zero Engine", "yze"));
  assert.ok(finds("Basic Roleplaying (BRP)", "chaosium"));
  assert.ok(finds("2d20 System", "modiphius"));
  assert.ok(!finds("2d20 System", "genesys"), "and not by each other's names");
});
