# Backlog — open work

**Intent, not status.** Everything here is work we *want*; nothing here describes what the code
currently does. An item leaves this file **in the same commit that implements it** — so if it is
listed, it is not done. No "partially", no percentages, no dates.

Not ranked, but the skeleton pull gates everything below it.

## Bootstrap (see [`../../.claude/deploy.md`](../../.claude/deploy.md), "Starting a new game")

- **Pull BGA's generated skeleton over SFTP and commit it** — it is already on the server: `Game.php`,
  `States/{PlayerTurn,NextPlayer,EndScore}.php`, `dbmodel.sql`, the `*.jsonc` set, `LICENCE_BGA`,
  `_ide_helper.php`, `bga-framework.d.ts`, `modules/js/Game.js`, and `src-disabled/{ts,scss}` (BGA's
  own TS/SCSS sources — the starting point for `src/`). Do this **before any deploy**: `ship` would
  overwrite the skeleton's `Game.js` and CSS with our placeholders, and there is no undo.
- **Replace the placeholder `src/ts/Game.ts` and `src/scss/Game.scss`** with the skeleton's
  `src-disabled/` sources, ported into the TypeScript/SCSS toolchain.
- **Fill in `gameinfos.jsonc`** — the skeleton ships defaults (`"My Great Game"`, `bgg_id` 225818,
  `"My Publishing Company"`), and `Game.php` carries a `<Your name here>` copyright header.
- **Request art files** via the Request Art Files button on the studio license page.
- **Copy the `bga-cards` / `bga-animations` typings** from `../ugly-christmas-sweater/` if the client
  needs them (`bga-framework.d.ts` comes with the skeleton). Dev-only; they never deploy.
- **Set project status** to "development started" in Control Panel → Manage Games.
- **Write `.claude/game-rules.md`** from the rulebook Will is supplying, and `.claude/architecture.md`
  once the state machine exists.

## Before the first test table

- **Run `npm run clean:remote -- --yes`** to clear the skeleton's `PlayerTurn.php` / `NextPlayer.php`
  and the server-side dev tooling. Sequence matters: the skeleton's `Game.php` has
  `use Bga\Games\minirailsmospinach\States\PlayerTurn;`, so this belongs *after* our own states
  replace the skeleton's, not on day one.
