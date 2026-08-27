# Backlog — open work

**Intent, not status.** Everything here is work we *want*; nothing here describes what the code
currently does. An item leaves this file **in the same commit that implements it** — so if it is
listed, it is not done. No "partially", no percentages, no dates.

Not ranked.

## Bootstrap (see [`../../.claude/deploy.md`](../../.claude/deploy.md), "Starting a new game")

- **Confirm `bgg_id` 225818 on boardgamegeek.com.** The abandoned `minirails` project carries the
  same id, so BGA appears to pre-fill the licensed game's real BGG id — but it has never been checked
  against BGG itself.
- **Put a real copyright header in the sources.** `<Your name here> <Your email address here>` sits in
  `modules/php/*.php` and `src/scss/Game.scss`; the pre-release checklist wants a real name in every
  source file. `rollup.config.mjs` already injects one into the built bundle.
- **Swap the CSS placeholders for the real art** once the requested art files arrive. Every component
  is currently drawn with CSS shapes (see `src/scss/_tokens.scss`). The intended swap is
  background-image sprites inside `_hex.scss` and `_disc.scss`; layout, sizing and class names are
  meant to survive it. Remove the `.mr-placeholder-banner` at the same time.
- **Decide whether a hex keeps its numeral once the art lands.** The physical tiles print **no
  number at all** — value is a count of white (+1) or red (−1) dots. `renderHex()` currently writes a
  signed numeral and a terrain name into `.mr-hex__value` / `.mr-hex__name`, which is clearer at BGA
  zoom levels but is not what the tile shows. Either drop them for a dot cluster, or keep the numeral
  as a deliberate digital-only aid and say so.
- **Enter the remaining per-space terrain data.** `Material::TERRAIN_BY_SPACE` holds all 98 space
  codes (7 tiles x 2 faces x 7 positions). **1A, 2A and 3A are real**, read off the publisher scans
  at [`../../_reference/minirails/img/wheel_*.png`](../../_reference/minirails/img/) by counting the
  dots. Still invented: **tiles 4–7, both sides, and the B side of 1, 2 and 3** — those need the art
  request or the physical tiles. Overwrite the values in place; nothing else needs to change.
- **Confirm tile 1's B side still carries The Big City.** `Material::BIG_CITY_TILE` assumes it does,
  on the grounds that a 50/50 flip which could delete The Big City from the game would be absurd.
  Side A is confirmed from `wheel_0.png`; side B is not. If wrong, only `TERRAIN_BY_SPACE['121']`
  changes.
- **Resolve a second reading of tile 1's ring that does not match `wheel_0.png`.** Will read the six
  spaces around The Big City as the cycle **+1 −3 +2 −1 +3 −2** (no fixed starting space, and the
  face was not noted; possibly the same on both faces). `wheel_0.png` gives 1A as the cycle
  **+2 −1 −3 −2 +1 +3** (Farmland, Forest, Mountains, Lake, Plains, Suburbs clockwise from NE). Same
  six values, but Will's is **neither a rotation nor a reflection** of the scan's — checked all 12 —
  so the two cannot be the same face read from a different corner. Anchored at the shared `+1`
  (Plains, our W) they agree on four of six and exchange only **Suburbs +3 ↔ Mountains −3**. Most
  likely it is **side B**, which would also settle the question above; a two-space
  transcription slip is the other candidate. `TERRAIN_BY_SPACE` currently carries the scan for 1A and
  a placeholder for 1B, so nothing is wrong today — this only decides what 1B becomes. Needs one
  look at a physical tile, naming the face and one starting space.
- **Confirm which of a frame's three arrows is the primary.** WHICH three hexes are marked is
  settled — the last three of `Material::FRAME_PERIMETER_CW`, confirmed against a real 3-player
  opening where all six companies agreed. What the primary is among them is not: it only shows at
  **4 and 5 players**, where the primary alone is seeded, and a 3-player position seeds all three.
  `FRAME_ARROW_PRIMARY` assumes position 1 because the primary arrow sits centrally on the piece.
  Check it by dealing a 4-player table against a physical frame; it changes one constant.
- **Copy the `bga-cards` / `bga-animations` typings** from `../ugly-christmas-sweater/` if the client
  needs them (`bga-framework.d.ts` came with the skeleton). Dev-only; they never deploy.
- **Set project status** to "development started" in Control Panel → Manage Games.
- **Get the 2nd-edition (2025) rulebook.** [`game-rules.md`](game-rules.md) documents the **1st
  edition (2017, 3–5 players)** because that is the only rulebook we have; the 2nd edition reportedly
  supports **1–5 players** and is not on BoardGameGeek. Until we have it we cannot implement solo or
  2-player at all, and cannot confirm that disc counts, terrain values or the 6-round length are
  unchanged. Worth asking BGA which edition the licence covers — that answer may also settle the
  `players` list in `gameinfos.jsonc`.
- **Write `.claude/architecture.md`** once the state machine exists.

## Game logic

- **Check whether the 2nd edition still has The Big City at +5.** +5 is **confirmed correct for the
  1st edition** — the rulebook, the five white dots on tile 1's centre in `wheel_0.png`, and Will all
  agree. It is the only terrain outside ±1..±3, so it is worth re-checking whenever the 2nd-edition
  rulebook turns up. Not a known problem; just the one value that would be easy to retune.
- **Give the cloth bag a spot in the layout.** `bagCount` already reaches the client in `getAllDatas`
  and nothing renders it. It is purely a random-draw source, so it needs a place to sit and a count,
  not a component model.

## Before the first test table

- **Run `npm run clean:remote -- --yes`** to clear the skeleton's `PlayerTurn.php` / `NextPlayer.php`
  and the server-side dev tooling (`package.json`, `tsconfig.json`, `rollup.config.mjs`,
  `src-disabled/`). Sequence matters: the skeleton's `Game.php` has
  `use Bga\Games\minirailsmospinach\States\PlayerTurn;`, so this belongs *after* our own states
  replace the skeleton's, not on day one.
