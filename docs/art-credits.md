# Art credits

None of the pictures below is licensed for reuse. They were chosen by the owner (ADR-34, ADR-35) knowing that; the site and this public repository show them, and any of them can be taken down at once (see "If someone asks for a picture to be removed").

## Genre pictures

The 40 pictures in `public/images/genres/` are the pictures StartPlaying shows for each genre on its [genres page](https://startplaying.games/play/genres), downloaded on 2026-11-02 and cropped to 480 x 600 WebP. File names are our genre keys (`src/lib/categories.ts`); three differ from StartPlaying's: `sci-fi` is its Sci-Fi, `urban` its Urban Fantasy and `superhero` its Super Heroes. The pictures are StartPlaying's, or its stock and commissioned art; the site does not know each picture's artist. The public domain engravings that were here before (from Inside Out Library, Public Domain Mark 1.0) are in the git history before the commit "Genre tiles use StartPlaying's genre pictures".

## Game system pictures

The 139 pictures in `public/images/systems/`: 108 are the book covers shown on StartPlaying's [game systems page](https://startplaying.games/play/game-systems), downloaded on 2026-11-02 and cropped to 480 x 600 WebP. **This art belongs to the games' publishers** (for example Wizards of the Coast, Chaosium, Paradox Interactive, Evil Hat, Paizo, Free League, Monte Cook Games). Which picture belongs to which system is `src/lib/system-covers.ts`; a system without a picture there shows its soonest listing's cover, or appears as a compact card (none at the moment: every listed system has a picture).

The other 31 pictures are for editions StartPlaying does not list. They were found on 2026-11-02 on publishers' and shops' product pages (the page's own preview image, so what the shop shows for the book), Wikipedia's infobox covers, the Open Library cover service and the Traveller Wiki: Shadowrun 3e, 4e and 6e (Dragonstrove, Noble Knight, Gap Games); Cairn 1e and 2e (Yochai Gal's itch.io pages, the 2e picture is the Player's Guide art, cropped above its logo and label); Nimble 5e (Travelling Man) and Nimble 2e (Nimble Co. blog); Electric Bastionland, Monsterhearts 1e and Classic Traveller (Wikipedia, Traveller Wiki); the older White Wolf books, Call of Cthulhu 6e, AD&D 1e (Open Library, the 1983 Jeff Easley cover), GURPS 3e, Exalted 2e, Mutants & Masterminds 2e, Savage Worlds Deluxe, Traveller (Mongoose 1st Edition), Fate Accelerated and Fate Condensed, The One Ring 1e, Legend of the Five Rings 4e, and Warhammer Fantasy Roleplay 2e and 3e (Dragonstrove, Noble Knight, itch.io, Open Library, Troll and Toad, Zulu's Games). Where a shop page was small or had a white border the picture is a little soft or shows a white edge.

## If someone asks for a picture to be removed

Delete the file in `public/images/genres/` or `public/images/systems/`. For a system also delete its line in `src/lib/system-covers.ts` and the tile falls back to the cover of its soonest listing. For a genre, put a replacement file of the same name (a genre tile without a picture file shows a plain colour block). Then push; the next build drops it. The file stays in git history, so if the request needs it gone completely, the history has to be rewritten too.

A second pass the same day replaced 14 of those 30 with sharper pictures (2e/3e/4e covers and older books): Fate Condensed (Evil Hat's itch.io page), GURPS 3e (Warehouse 23), Call of Cthulhu 6e and Shadowrun 4e (Open Library), Nimble 5e and Savage Worlds Deluxe (Nimble Co. and Pinnacle shop pages), Mutants & Masterminds 2e, Vampire: The Requiem 1st Edition, Warhammer Fantasy Roleplay 2e (Wikipedia) and 3e, Pokémon Tabletop United (its own cover instead of StartPlaying's icon pattern), The One Ring 1e (the 2011 box; it had wrongly shown the 2nd edition cover), Classic Traveller (the Starter Edition box art, without its title) and Traveller (Mongoose 1st Edition) (its black cover, centred). Shadowrun 3e (a 389 px Open Library scan) and Legend of the Five Rings 4th Edition (300 px) are the best scans found; both are upscaled in two steps with edge sharpening (scratch script, not in the repo), so they are crisper but not more detailed.

Warhammer Fantasy Roleplay 1e is the last one found: the cover of the 1995 reprint of the 1986 core rulebook, from Open Library (cover 946179, 367 px).

Werewolf: The Apocalypse 20th Anniversary Edition (W20) is Noble Knight's product photo (the "1500 px" file is an upscale of a roughly 200 px original), trimmed to the book, so the white edge is gone, and sharpened in two steps; it is crisper but not more detailed. The only scan with more detail found was the Spanish edition's, which carries the Spanish title.

Warhammer Fantasy Roleplay 2e is now a 377 x 500 cover scan (a library catalogue's copy of the retail cover image, from Amazon's image server) instead of Wikipedia's 277 px one, sharpened in two steps.

Vampire: The Masquerade Revised Edition is now Open Library's 349 x 475 scan (cover 802185) instead of Dragonstrove's 199 x 260 photo, sharpened in two steps and toned down a little (the scan is brighter green than the printed cover looks).

Dungeons & Dragons 5.5e 2024 is the 2024 Player's Handbook cover, a 2732 x 3579 image the owner supplied (Wizards of the Coast's art), instead of the 2014 cover StartPlaying shows. The 2014 entry keeps StartPlaying's picture.
