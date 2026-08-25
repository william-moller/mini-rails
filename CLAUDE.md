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
| **Mistakes I've made here, and the rules that prevent a repeat** | [`.claude/MISTAKES.md`](.claude/MISTAKES.md) |
| Open work: bootstrap steps still outstanding, release blockers | [`.claude/backlog.md`](.claude/backlog.md) |
| Game rules, components, scoring — **and the 1st/2nd edition caveat** | [`.claude/game-rules.md`](.claude/game-rules.md) |
| Official rulebook, 1st edition (PDF) | [`docs/Mini_Rails_Rules_ENG-0615.pdf`](docs/Mini_Rails_Rules_ENG-0615.pdf) |
| **Abandoned prior implementation of this same game** (study, do not fork) | [`../_reference/minirails/CLAUDE.md`](../_reference/minirails/CLAUDE.md) |
| Component preview — open locally, no deploy needed | [`scripts/preview/index.html`](scripts/preview/index.html) |
| SFTP/deploy, test tables, framework conventions, PHP-lint scar | [`../.claude/`](../.claude/) (shared) |

`.claude/architecture.md` follows the same layout as `../ugly-christmas-sweater/.claude/`; write it
once there is a state machine to describe, not before.

## Project facts

- **Framework:** Modern / Studio (PHP state classes + TypeScript client).
- **BGA project name:** `minirailsmospinach`, all lowercase · **SFTP remote path:** `/minirailsmospinach/` (in the gitignored `.vscode/sftp.json`, verified against the server). `minirails` is held by a stale project for this game and **cannot** be used — the suffix disambiguates. The name also fixes the stylesheet filename (`minirailsmospinach.css`) and the `Gamehelpminirailsmospinach` wiki page.
- **PHP namespace:** `Bga\Games\minirailsmospinach` — the project name verbatim, **not** StudlyCase. Read out of the generated `modules/php/Game.php` on the server, not derived.
- **Local additions over the skeleton.** BGA generated `package.json`, `rollup.config.mjs`, `tsconfig.json` and `src/`. Only three things here are ours: the `deploy` / `clean:remote` / `ship` scripts plus the `ssh2-sftp-client` dep in `package.json`, the copyright `banner` in `rollup.config.mjs`, and `scripts/`. Keep that boundary visible — re-pulling the skeleton would silently drop all three.
- **GitHub:** https://github.com/william-moller/mini-rails (public). Repo/directory use kebab-case (`mini-rails`); only the BGA project is run-together, exactly as `ugly-christmas-sweater` ↔ `uglychristmassweaters`.
- **BGG ID:** `gameinfos.jsonc` carries `bgg_id` 225818, which the abandoned `minirails` project has too — so it is probably the real Mini Rails id BGA pre-filled, not a placeholder. Still unverified against boardgamegeek.com.
- **The `disc` table is Deck-backed, so its columns are `card_*`, not `disc_*`.** The Deck component takes the TABLE name from `createDeck('disc')` but hard-codes the COLUMN prefix. Getting this wrong makes every game fail to start — see [`../.claude/MISTAKES.md`](../.claude/MISTAKES.md).
- **Build:** `npm run build` (rollup TS + sass SCSS); `npm run watch`. Edit `src/`, never the generated `modules/js/Game.js` / `minirailsmospinach.css`.
- **Deploy:** **`npm run ship`** = build + push the game files to BGA (`build` then `deploy -- --yes`). ⚠️ **Never** use the VS Code `SFTP: Sync Local → Remote` — its ignore is broken on Windows and dumps `node_modules/` onto BGA (see `../.claude/deploy.md`). `npm run deploy` alone does a dry-run; `npm run clean:remote -- --yes` purges stray remote files — **run it before the first test table** to clear BGA's skeleton `PlayerTurn.php` / `NextPlayer.php` state classes, which collide fatally with the game's own state ids.
- **No art yet — every component is a CSS placeholder.** Hexes, discs, order markers, action tiles, the three market tracks and the Profit Board are drawn with shapes and clip-paths (`src/scss/_tokens.scss` holds the palette and sizing). This is deliberate: the game can be built and played before art exists, and unlike borrowed art a placeholder cannot accidentally ship. **Preview it without deploying** — `npm run build`, then open `scripts/preview/index.html` in a browser; it renders from the real `src/ts/components.ts` against the real compiled CSS, so it cannot drift from what ships. The sprite generators in `../ugly-christmas-sweater/scripts/` and their `sharp` dependency are still **not** ported; bring across only what this game needs, once there is art.
