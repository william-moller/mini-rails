# Mini Rails (Board Game Arena)

A BGA Studio implementation of **Mini Rails** by Moaideas Game Design.

Built on the BGA Studio Modern framework: PHP state classes (`modules/php/`) and a TypeScript client
compiled from `src/` by rollup + sass.

```sh
npm install
npm run build      # rollup TS -> modules/js/Game.js, sass -> minirailsmospinach.css
npm run ship       # build, then deploy the game files to the BGA studio server
```

Developer guidance lives in `CLAUDE.md` and `.claude/`. Game art (`img/`) is licensed publisher IP and
is deliberately not committed.
