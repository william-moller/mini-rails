  import typescript from '@rollup/plugin-typescript';

  // Pre-release checklist: "Copyright headers in all source files have your name." The bundle is
  // generated, so the header has to be injected here — without it the deployed Game.js opened with
  // whichever module rollup emitted first and carried no attribution at all.
  const banner = `/**
 *------
 * BGA framework: Gregory Isabelli & Emmanuel Colin & BoardGameArena
 * Mini Rails implementation : © Will Moller <will.moller@gmail.com>
 *
 * This code has been produced on the BGA studio platform for use on http://boardgamearena.com.
 * See http://en.boardgamearena.com/#!doc/Studio for more information.
 * -----
 *
 * GENERATED — do not edit. Built from src/ts by rollup (npm run build).
 */`;

  // The game bundle BGA loads.
  const game = {
    input: 'src/ts/Game.ts',
    output: {
      file: 'modules/js/Game.js',
      format: 'es',
      sourcemap: false,
      inlineDynamicImports: true,
      banner,
    },
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
        outDir: 'modules/js',
      }),
    ],
    treeshake: false,
  };

  // Dev-only: the component preview at scripts/preview/index.html. Built from the SAME components.ts
  // the game uses, so the preview cannot drift from what ships. scripts/ is excluded from the SFTP
  // deploy allowlist, so this output never reaches BGA.
  const preview = {
    input: 'src/ts/preview-entry.ts',
    output: {
      file: 'scripts/preview/preview.js',
      // IIFE, not ESM: the preview is meant to open by double-clicking index.html, and Chrome blocks
      // module scripts loaded over file:// as a cross-origin request. A classic script just runs.
      format: 'iife',
      sourcemap: false,
      inlineDynamicImports: true,
      banner,
    },
    plugins: [
      typescript({
        tsconfig: './tsconfig.json',
        outDir: 'scripts/preview',
      }),
    ],
    treeshake: false,
  };

  export default [game, preview];
