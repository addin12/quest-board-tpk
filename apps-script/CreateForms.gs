/**
 * One-time helper: builds the two Google Forms, and the Sheet they answer into, from docs/forms.md.
 *
 * It is not part of the backend (Code.gs). Run `createForms` once from a new project at script.google.com, then follow
 * the log. Google's Forms scripting service cannot add file-upload questions or choose "Verified" email collection,
 * so the log lists those few steps to do by hand. A unit test keeps every question title equal to the column
 * Code.gs reads.
 */

// BEGIN GENERATED OPTIONS (npm run form-options: the options to put on the forms' questions)
const FORM_OPTIONS = {
  system: [
    "D&D 5.5e (2024)",
    "D&D 5e (2014)",
    "Pathfinder 2e",
    "Call of Cthulhu",
    "Daggerheart",
    "Blades in the Dark",
    "Vampire: The Masquerade",
    "Mothership",
    "Shadowrun",
    "Starfinder",
    "A Song of Ice and Fire Roleplaying",
    "Advanced Dungeons & Dragons 2e",
    "Alice is Missing",
    "Alien RPG Evolved Edition",
    "Alien: The Roleplaying Game",
    "Avatar Legends: The RPG",
    "Blade Runner: The Roleplaying Game",
    "Blades '68",
    "Brindlewood Bay",
    "Candela Obscura",
    "CBR+PNK",
    "Changeling: The Lost Second Edition",
    "City of Mist",
    "Coriolis – The Third Horizon",
    "Cosmere Roleplaying Game",
    "CY_BORG",
    "Cyberpunk Red",
    "Cypher",
    "Cypher System",
    "Dark Matter",
    "Death in Space",
    "Delta Green",
    "DIE: The Roleplaying Game",
    "Dragonbane",
    "Draw Steel",
    "Dune: Adventures in the Imperium",
    "Dungeon Crawl Classics",
    "Dungeons & Dragons 3/3.5e",
    "Dungeons & Dragons B/X",
    "Exalted 3rd Edition",
    "Fablecraft",
    "Fabula Ultima",
    "Fallout: The Roleplaying Game",
    "Fate",
    "Forbidden Lands",
    "Girl By Moonlight",
    "GURPS",
    "Hunter: The Reckoning",
    "Invincible Superhero Roleplaying",
    "Kids on Bikes",
    "Kids on Brooms",
    "Lancer",
    "Legend in the Mist",
    "Legend of the Five Rings 5th Edition",
    "Mage: The Ascension 20th Anniversary Edition",
    "Mage: The Awakening 2nd Edition",
    "Marvel Multiverse Role-Playing Game",
    "Masks: A New Generation",
    "Monster of the Week",
    "Monsterhearts 2",
    "Mörk Borg",
    "Mutant: Year Zero",
    "Mutants & Masterminds (3e)",
    "Mythic Bastionland",
    "Old-School Essentials",
    ":Otherscape",
    "Pathfinder 1e",
    "Pendragon 6th Edition",
    "Pirate Borg",
    "Pokemon Tabletop United",
    "Power Rangers Roleplaying Game",
    "Pulp Cthulhu",
    "Savage Worlds",
    "Scum and Villainy",
    "Shadowdark RPG",
    "SHIFT RPG",
    "Slugblaster",
    "Star Trek Adventures - First Edition",
    "Star Trek Adventures - Second Edition",
    "Star Wars 5e",
    "Star Wars RPG by Fantasy Flight Games",
    "Starfinder 2e",
    "Tales From the Loop",
    "Tales of the Valiant",
    "The Last Caravan: A Cars and Aliens RPG",
    "The One Ring 2e",
    "The Sword, The Crown, and The Unspeakable Power",
    "The Walking Dead Universe Roleplaying Game",
    "The Wildsea",
    "Thirsty Sword Lesbians",
    "Transformers Roleplaying Game",
    "Traveller",
    "Triangle Agency",
    "Vaesen",
    "Vampire: The Requiem 2nd Edition",
    "Warhammer 40,000 Imperium Maledictum",
    "Warhammer 40,000 Wrath & Glory",
    "Warhammer Fantasy Roleplay",
    "Werewolf: The Apocalypse 5th Edition",
    "Other",
  ],
  format: [
    "One-shot",
    "Campaign",
  ],
  genres: [
    "Fantasy",
    "Dark fantasy",
    "Horror",
    "Sci-fi",
    "Cyberpunk",
    "Mystery",
    "Post-apocalyptic",
    "Urban fantasy",
    "Historical",
    "Cozy",
    "High fantasy",
    "Gritty fantasy",
    "Low magic",
    "Grimdark",
    "Imaginative",
    "Supernatural",
    "Gothic horror",
    "Eldritch horror",
    "Survival",
    "Modern",
    "Futuristic",
    "Space opera",
    "Space western",
    "Steampunk",
    "Superhero",
    "Anime",
    "Isekai",
    "Pirate",
    "Viking",
    "Western",
    "Victorian",
    "Rustic",
    "Political intrigue",
    "Espionage",
    "Comedy",
    "Wacky",
    "Heartwarming",
    "Romance",
    "Battle royale",
    "Universal",
  ],
  styles: [
    "Roleplay-heavy",
    "Combat-heavy",
    "Tactical",
    "Rule of cool",
    "Theater of the mind",
    "Sandbox",
    "Puzzles & mysteries",
    "Dungeon crawl",
    "Narrative",
    "Roleplay-light",
    "Combat-light",
    "Rules as written",
    "Hexcrawl & exploration",
    "Kingdom building",
    "West Marches",
    "Organized play",
    "Play-by-post",
  ],
  where: [
    "Online",
    "In person",
  ],
  zone: [
    "WIB",
    "WITA",
    "WIT",
  ],
  language: [
    "Bahasa Indonesia",
    "English",
    "Indonesian & English",
  ],
  level: [
    "Beginner friendly",
    "All experience levels",
    "Experienced players",
  ],
};
// END GENERATED OPTIONS

const CONSENT_PROFILE = 'I agree that my display name, bio, city, photo and WhatsApp number (and Discord, if I add it) are shown publicly on Quest Board TPK.';
const CONSENT_GAME = 'I confirm this information is true, I will not ask players for fees through this listing, and I will follow the content warnings and safety tools I list.';

function createForms() {
  const sheet = SpreadsheetApp.create('Quest Board TPK');
  const gm = gmForm_();
  const game = gameForm_();
  gm.setDestination(FormApp.DestinationType.SPREADSHEET, sheet.getId());
  game.setDestination(FormApp.DestinationType.SPREADSHEET, sheet.getId());
  SpreadsheetApp.flush();
  nameTab_(sheet, gm, 'GM profiles');
  nameTab_(sheet, game, 'Games');
  const blank = sheet.getSheetByName('Sheet1');
  if (blank && sheet.getSheets().length > 1) sheet.deleteSheet(blank);

  Logger.log([
    'DONE. Keep these links:',
    '  Sheet:                 ' + sheet.getUrl(),
    '  GM profile form (give to GMs): ' + gm.getPublishedUrl(),
    '  Game form (give to GMs):       ' + game.getPublishedUrl(),
    '  GM profile form, edit:         ' + gm.getEditUrl(),
    '  Game form, edit:               ' + game.getEditUrl(),
    '',
    'BY HAND (Google does not allow these from a script), in each form\'s edit page:',
    '  1. Add a question of type "File upload": GM profile form, title exactly  Photo',
    '     Game form, title exactly  Cover image (4:5 portrait)',
    '     Not required. Allow only: Image. Maximum number of files: 1. Maximum file size: 10 MB.',
    '     (Google asks you to turn on sign-in when you add it: say yes.)',
    '  2. Settings > Responses: "Collect email addresses" = Verified; "Send responders a copy" = When requested.',
    '',
    'THEN: open the Sheet > Extensions > Apps Script and continue with docs/setup.md, step 2.',
  ].join('\n'));
}

function gmForm_() {
  const form = newForm_('Quest Board TPK: GM profile',
    'Fill this in once. It is what players see about you, and how they reach you. Your email address is never shown.');
  short_(form, 'Display name', true, '', textMax_(60));
  long_(form, 'Short bio', true, '', paragraphMax_(800));
  short_(form, 'City', true);
  short_(form, 'Systems you usually run', false, 'Comma-separated, e.g. Call of Cthulhu, Mothership.');
  short_(form, 'WhatsApp number', true, 'With country code or starting with 0, e.g. 0812-3456-7890.',
    FormApp.createTextValidation().requireTextMatchesPattern('^\\+?[0-9][0-9 \\-]{7,18}$').setHelpText('Enter a phone number, e.g. 0812-3456-7890.').build());
  short_(form, 'Discord (optional)', false, 'Your username (e.g. raka_gm) or a permanent invite link (https://discord.gg/...).');
  boxes_(form, 'Public listing', true, [CONSENT_PROFILE]);
  return form;
}

function gameForm_() {
  const o = FORM_OPTIONS;
  const form = newForm_('Quest Board TPK: list a game',
    'One response per game. Fill in the GM profile form first, with the same Google account.');
  short_(form, 'Game title', true, '', textMax_(100));
  pick_(form.addListItem(), 'Game system', true, o.system);
  short_(form, 'Other system (if you chose Other)', false);
  short_(form, 'One-line summary', true, 'Shown on the game\'s card.', textMax_(200));
  long_(form, 'Full description', true, 'What the game is, who it suits, what to bring.', paragraphMax_(4000));
  pick_(form.addMultipleChoiceItem(), 'Format', true, o.format);
  boxes_(form, 'Genres (pick up to 3)', false, o.genres, FormApp.createCheckboxValidation().requireSelectAtMost(3).build());
  boxes_(form, 'Play styles (pick up to 3)', false, o.styles, FormApp.createCheckboxValidation().requireSelectAtMost(3).build());
  pick_(form.addMultipleChoiceItem(), 'Where will you play?', true, o.where);
  short_(form, 'Platform (online games)', false, 'Discord, Foundry VTT, Roll20, Google Meet...');
  short_(form, 'City (in-person games)', false);
  short_(form, 'Venue name (in-person games)', false, 'A public place such as a cafe or game store, never a home address.');
  short_(form, 'Google Maps link (in-person games)', false, 'In Google Maps: open the place > Share > Copy link.',
    FormApp.createTextValidation().requireTextMatchesPattern('^https://.*').setHelpText('The link must start with https://').build());
  item_(form.addDateItem(), 'Date of the first session', true);
  item_(form.addTimeItem(), 'Start time', true);
  pick_(form.addListItem(), 'Time zone', true, o.zone);
  long_(form, 'Other sessions or schedule notes', false, 'Every Saturday 14.00-17.00 for 6 weeks.');
  item_(form.addDateItem(), 'Keep this listing until (optional)', false,
    'Without it the listing leaves the site a day after the first session. A campaign should set it.');
  short_(form, 'Price per seat (Rupiah, 0 = free)', true, 'Information only: Quest Board takes no payment.',
    FormApp.createTextValidation().requireNumberGreaterThanOrEqualTo(0).build());
  short_(form, 'Seats', true, '', FormApp.createTextValidation().requireNumberBetween(1, 20).build());
  pick_(form.addMultipleChoiceItem(), 'Play language', true, o.language);
  pick_(form.addMultipleChoiceItem(), 'Experience level', true, o.level);
  short_(form, 'Minimum age', false, '', FormApp.createTextValidation().requireNumberBetween(0, 99).build());
  long_(form, 'Content warnings', false, 'Help players make an informed choice.');
  short_(form, 'Safety tools', false, 'X-Card, Lines & Veils...');
  boxes_(form, 'Community guidelines', true, [CONSENT_GAME]);
  return form;
}

function newForm_(title, description) {
  return FormApp.create(title)
    .setDescription(description)
    .setCollectEmail(true)
    .setAllowResponseEdits(true)
    .setShowLinkToRespondAgain(true);
}

function item_(item, title, required, help) {
  item.setTitle(title).setRequired(required);
  if (help) item.setHelpText(help);
  return item;
}

function short_(form, title, required, help, validation) {
  const item = item_(form.addTextItem(), title, required, help);
  if (validation) item.setValidation(validation);
}

function long_(form, title, required, help, validation) {
  const item = item_(form.addParagraphTextItem(), title, required, help);
  if (validation) item.setValidation(validation);
}

function pick_(item, title, required, options) {
  item_(item, title, required).setChoiceValues(options);
}

function boxes_(form, title, required, options, validation) {
  const item = item_(form.addCheckboxItem(), title, required).setChoiceValues(options);
  if (validation) item.setValidation(validation);
}

function textMax_(n) {
  return FormApp.createTextValidation().requireTextLengthLessThanOrEqualTo(n).build();
}

function paragraphMax_(n) {
  return FormApp.createParagraphTextValidation().requireTextLengthLessThanOrEqualTo(n).build();
}

/** The tab Google made for a form's answers gets the exact name Code.gs looks for. */
function nameTab_(sheet, form, name) {
  const tab = sheet.getSheets().filter((s) => (s.getFormUrl() || '').indexOf(form.getId()) !== -1)[0];
  if (tab) tab.setName(name);
  else Logger.log('Rename the answers tab of "' + form.getTitle() + '" to exactly "' + name + '" by hand.');
}
