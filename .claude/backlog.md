# Backlog — open work

**Intent, not status.** Everything here is work we *want*; nothing here describes what the code
currently does. An item leaves this file **in the same commit that implements it** — so if it is
listed, it is not done. No "partially", no percentages, no dates.

Not ranked.

## Bootstrap (see [`../../.claude/deploy.md`](../../.claude/deploy.md), "Starting a new game")

- **Fill in the game identity.** `gameinfos.jsonc` still ships the skeleton defaults (`"My Great
  Game"`, `bgg_id` 225818, `"My Publishing Company"`), and the `<Your name here> <Your email address
  here>` copyright header sits in `modules/php/*.php` and `src/scss/Game.scss`. The pre-release
  checklist wants a real name in every source file; `rollup.config.mjs` already injects one into the
  built bundle, so the sources are what's left.
- **Request art files** via the Request Art Files button on the studio license page.
- **Copy the `bga-cards` / `bga-animations` typings** from `../ugly-christmas-sweater/` if the client
  needs them (`bga-framework.d.ts` came with the skeleton). Dev-only; they never deploy.
- **Set project status** to "development started" in Control Panel → Manage Games.
- **Write `.claude/game-rules.md`** from the rulebook Will is supplying, and `.claude/architecture.md`
  once the state machine exists.

## Before the first test table

- **Run `npm run clean:remote -- --yes`** to clear the skeleton's `PlayerTurn.php` / `NextPlayer.php`
  and the server-side dev tooling (`package.json`, `tsconfig.json`, `rollup.config.mjs`,
  `src-disabled/`). Sequence matters: the skeleton's `Game.php` has
  `use Bga\Games\minirailsmospinach\States\PlayerTurn;`, so this belongs *after* our own states
  replace the skeleton's, not on day one.
