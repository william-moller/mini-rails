# Mini Rails — BGA implementation (index)

A Board Game Arena adaptation of **Mini Rails** (Moaideas Game Design), licensed to BGA. Built on the
BGA Studio **Modern** framework (PHP state classes + TypeScript client).

Shared BGA-wide guidance (SFTP/deploy, test tables, framework conventions, never-commit rules) lives
one level up in [`../CLAUDE.md`](../CLAUDE.md) and is inherited automatically. This repo's docs cover
only what's specific to this game.

## Ground rules

1. **Verify, don't trust.** The rulebook, the wiki mirror, *these docs* — all wrong/stale until confirmed against on-disk state or a test table. When a doc disagrees with the code, the code wins.
2. **No status in docs. Git is the status.** No "not yet synced", "current state", "as of <date>". Ask git. The one exception is *intent* — what we want built, which git cannot tell you — and it lives in [`.claude/backlog.md`](.claude/backlog.md). That file says what we want, never how far along it is, and an item leaves it in the commit that implements it. Do not delete it for "carrying status"; it doesn't.
3. **History lives in commit messages, not required reading.** If a session needs history, `git log` it.
4. **Every convention line must have burned us at least once.** If it never bit anyone, cut it.

## Where to find things

| Topic | File |
|-------|------|
| Open work: bootstrap steps still outstanding, release blockers | [`.claude/backlog.md`](.claude/backlog.md) |
| SFTP/deploy, test tables, framework conventions, PHP-lint scar | [`../.claude/`](../.claude/) (shared) |

`.claude/architecture.md` and `.claude/game-rules.md` follow the same layout as
`../ugly-christmas-sweater/.claude/`; write them once there is code and a rulebook to describe,
not before.

## Project facts

- **Framework:** Modern / Studio (PHP state classes + TypeScript client).
- **BGA project name:** `minirailsmospinach`, all lowercase · **SFTP remote path:** `/minirailsmospinach/` (in the gitignored `.vscode/sftp.json`, verified against the server). `minirails` is held by a stale project for this game and **cannot** be used — the suffix disambiguates. The name also fixes the stylesheet filename (`minirailsmospinach.css`) and the `Gamehelpminirailsmospinach` wiki page.
- **PHP namespace:** `Bga\Games\minirailsmospinach` — the project name verbatim, **not** StudlyCase. Read out of the generated `modules/php/Game.php` on the server, not derived.
- **⚠️ Do not `npm run ship` until BGA's skeleton has been pulled down and committed.** The server currently holds the generated skeleton; `src/ts/Game.ts` and `src/scss/Game.scss` here are placeholders, so a deploy would overwrite the skeleton's `modules/js/Game.js` and `minirailsmospinach.css` with near-empty files. Deploy is add-and-overwrite with no undo. Pull first.
- **GitHub:** https://github.com/william-moller/mini-rails (public). Repo/directory use kebab-case (`mini-rails`); only the BGA project is run-together, exactly as `ugly-christmas-sweater` ↔ `uglychristmassweaters`.
- **BGG ID:** not yet set in `gameinfos.jsonc` (arrives with the skeleton).
- **Build:** `npm run build` (rollup TS + sass SCSS); `npm run watch`. Edit `src/`, never the generated `modules/js/Game.js` / `minirailsmospinach.css`.
- **Deploy:** **`npm run ship`** = build + push the game files to BGA (`build` then `deploy -- --yes`). ⚠️ **Never** use the VS Code `SFTP: Sync Local → Remote` — its ignore is broken on Windows and dumps `node_modules/` onto BGA (see `../.claude/deploy.md`). `npm run deploy` alone does a dry-run; `npm run clean:remote -- --yes` purges stray remote files — **run it before the first test table** to clear BGA's skeleton `PlayerTurn.php` / `NextPlayer.php` state classes, which collide fatally with the game's own state ids.
- **No art pipeline yet.** The sprite generators in `../ugly-christmas-sweater/scripts/` (`build-sprites`, `build-secondary-sprites`, `build-icons`, `rename-art`, `analyze-bleed`) and their `sharp` dependency are deliberately **not** ported. Bring across only the ones this game needs, once there is art to process.
