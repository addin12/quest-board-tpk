# Art credits

None of the pictures below is licensed for reuse. They were chosen by the owner (ADR-34, ADR-35) knowing that; the site and this public repository show them, and any of them can be taken down at once (see "If someone asks for a picture to be removed").

## Genre pictures

The 40 pictures in `public/images/genres/` are the pictures StartPlaying shows for each genre on its [genres page](https://startplaying.games/play/genres), downloaded on 2026-11-02 and cropped to 480 x 600 WebP. File names are our genre keys (`src/lib/categories.ts`); three differ from StartPlaying's: `sci-fi` is its Sci-Fi, `urban` its Urban Fantasy and `superhero` its Super Heroes. The pictures are StartPlaying's, or its stock and commissioned art; the site does not know each picture's artist. The public domain engravings that were here before (from Inside Out Library, Public Domain Mark 1.0) are in the git history before the commit "Genre tiles use StartPlaying's genre pictures".

## Game system pictures

The 138 pictures in `public/images/systems/`: 108 are the book covers shown on StartPlaying's [game systems page](https://startplaying.games/play/game-systems), downloaded on 2026-11-02 and cropped to 480 x 600 WebP. **This art belongs to the games' publishers** (for example Wizards of the Coast, Chaosium, Paradox Interactive, Evil Hat, Paizo, Free League, Monte Cook Games). Which picture belongs to which system is `src/lib/system-covers.ts`; a system without a picture there shows its soonest listing's cover, or appears as a compact card (only Warhammer Fantasy Roleplay 1e, whose cover could not be fetched).

The other 30 pictures are for editions StartPlaying does not list. They were found on 2026-11-02 on publishers' and shops' product pages (the page's own preview image, so what the shop shows for the book), Wikipedia's infobox covers, the Open Library cover service and the Traveller Wiki: Shadowrun 3e, 4e and 6e (Dragonstrove, Noble Knight, Gap Games); Cairn 1e and 2e (Yochai Gal's itch.io pages, the 2e picture is the Player's Guide art, cropped above its logo and label); Nimble 5e (Travelling Man) and Nimble 2e (Nimble Co. blog); Electric Bastionland, Monsterhearts 1e and Classic Traveller (Wikipedia, Traveller Wiki); the older White Wolf books, Call of Cthulhu 6e, AD&D 1e (Open Library, the 1983 Jeff Easley cover), GURPS 3e, Exalted 2e, Mutants & Masterminds 2e, Savage Worlds Deluxe, Traveller (Mongoose 1st Edition), Fate Accelerated and Fate Condensed, The One Ring 1e, Legend of the Five Rings 4e, and Warhammer Fantasy Roleplay 2e and 3e (Dragonstrove, Noble Knight, itch.io, Open Library, Troll and Toad, Zulu's Games). Where a shop page was small or had a white border the picture is a little soft or shows a white edge.

## If someone asks for a picture to be removed

Delete the file in `public/images/genres/` or `public/images/systems/`. For a system also delete its line in `src/lib/system-covers.ts` and the tile falls back to the cover of its soonest listing. For a genre, put a replacement file of the same name (a genre tile without a picture file shows a plain colour block). Then push; the next build drops it. The file stays in git history, so if the request needs it gone completely, the history has to be rewritten too.
