# Backlog — open work

**Intent, not status.** Everything here is work we *want*; nothing here describes what the code
currently does. An item leaves this file **in the same commit that implements it** — so if it is
listed, it is not done. No "partially", no percentages, no dates.

Not ranked.

## Bootstrap (see [`../../.claude/deploy.md`](../../.claude/deploy.md), "Starting a new game")

- **Fill in the game identity in `gameinfos.jsonc`.** `game_name` is still `"My Great Game"` and
  `publisher` still `"My Publishing Company"`. **`bgg_id` 225818 is most likely already correct** — the
  abandoned `minirails` project carries the same id, so BGA appears to pre-fill the licensed game’s real
  BGG id; confirm on boardgamegeek.com rather than replacing it blind. Values the reference supplies:
  `publisher_bgg_id` 23245, publisher website `https://www.wix.moaideas.net/`, `players` [3, 4, 5].
- **Put a real copyright header in the sources.** `<Your name here> <Your email address here>` sits in
  `modules/php/*.php` and `src/scss/Game.scss`; the pre-release checklist wants a real name in every
  source file. `rollup.config.mjs` already injects one into the built bundle.
- **Request art files** via the Request Art Files button on the studio license page.
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

## Before the first test table

- **Run `npm run clean:remote -- --yes`** to clear the skeleton's `PlayerTurn.php` / `NextPlayer.php`
  and the server-side dev tooling (`package.json`, `tsconfig.json`, `rollup.config.mjs`,
  `src-disabled/`). Sequence matters: the skeleton's `Game.php` has
  `use Bga\Games\minirailsmospinach\States\PlayerTurn;`, so this belongs *after* our own states
  replace the skeleton's, not on day one.
