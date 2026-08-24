# Backlog — open work

**Intent, not status.** Everything here is work we *want*; nothing here describes what the code
currently does. An item leaves this file **in the same commit that implements it** — so if it is
listed, it is not done. No "partially", no percentages, no dates.

Not ranked.

## Bootstrap (see [`../../.claude/deploy.md`](../../.claude/deploy.md), "Starting a new game")

- **Request art files** via the Request Art Files button on the studio license page.
- **Pull BGA's generated skeleton over SFTP and commit it** — `Game.php`, `modules/php/States/*`,
  `dbmodel.sql`, `*.jsonc`, `LICENCE_BGA`, `_ide_helper.php`. Do not hand-author these. Take the PHP
  namespace from what BGA generated; don't derive it from the project name.
- **Replace the placeholder `src/ts/Game.ts` and `src/scss/Game.scss`** with the skeleton's client and
  stylesheet, ported into the TypeScript/SCSS toolchain.
- **Copy the `bga-*.d.ts` typings** (`bga-framework`, `bga-cards`, `bga-animations`) from
  `../ugly-christmas-sweater/` once the client needs them — they are dev-only and never deploy.
- **Create the GitHub repo** under `github.com/william-moller` and push.
- **Set project status** to "development started" in Control Panel → Manage Games.
- **Write `.claude/game-rules.md`** from the rulebook Will is supplying, and `.claude/architecture.md`
  once the state machine exists.
