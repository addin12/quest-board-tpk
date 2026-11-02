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

test("every word must match, and nothing matches nothing", () => {
  assert.ok(finds("Cairn 2e", "cairn 2e"));
  assert.ok(!finds("Cairn 2e", "cairn 1e"));
  assert.ok(matchesWords("anything", []), "no words: everything matches");
  assert.equal(SYSTEMS.filter((s) => finds(s, "dnd")).length >= 6, true, "all the D&D editions answer to dnd");
  assert.equal(SYSTEMS.filter((s) => finds(s, "zzzz")).length, 0);
});
