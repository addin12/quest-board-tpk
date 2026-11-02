# Art credits

None of the pictures below is licensed for reuse. They were chosen by the owner (ADR-34, ADR-35) knowing that; the site and this public repository show them, and any of them can be taken down at once (see "If someone asks for a picture to be removed").

## Genre pictures

The 40 pictures in `public/images/genres/` are the pictures StartPlaying shows for each genre on its [genres page](https://startplaying.games/play/genres), downloaded on 2026-11-02 and cropped to 480 x 600 WebP. File names are our genre keys (`src/lib/categories.ts`); three differ from StartPlaying's: `sci-fi` is its Sci-Fi, `urban` its Urban Fantasy and `superhero` its Super Heroes. The pictures are StartPlaying's, or its stock and commissioned art; the site does not know each picture's artist. The public domain engravings that were here before (from Inside Out Library, Public Domain Mark 1.0) are in the git history before the commit "Genre tiles use StartPlaying's genre pictures".

## Game system pictures

The 99 pictures in `public/images/systems/` are the book covers shown on StartPlaying's [game systems page](https://startplaying.games/play/game-systems), downloaded on 2026-11-02 and cropped to 480 x 600 WebP. **This art belongs to the games' publishers** (for example Wizards of the Coast, Chaosium, Paradox Interactive, Evil Hat, Paizo, Free League, Monte Cook Games). Which picture belongs to which system is `src/lib/system-covers.ts`; a system without a picture there (for example Cairn 2e, Nimble 2e and Shadowrun 6e, which StartPlaying does not list) shows its soonest listing's cover, or appears as a compact card.

## If someone asks for a picture to be removed

Delete the file in `public/images/genres/` or `public/images/systems/`. For a system also delete its line in `src/lib/system-covers.ts` and the tile falls back to the cover of its soonest listing. For a genre, put a replacement file of the same name (a genre tile without a picture file shows a plain colour block). Then push; the next build drops it. The file stays in git history, so if the request needs it gone completely, the history has to be rewritten too.
