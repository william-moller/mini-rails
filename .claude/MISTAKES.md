# Mistakes — Mini Rails

A behaviour log, not a changelog. Git records what changed; this records **what I got wrong and the
rule that prevents a repeat**. Read it before starting work here.

Game-specific only. BGA-wide mistakes are in [`../../.claude/MISTAKES.md`](../../.claude/MISTAKES.md)
and apply here too.

**Append an entry whenever something breaks or Will has to correct me** — in the same session it
happened, newest first, directly under the divider. Four fields, no more:

- **What happened** — the observable event, plainly.
- **Root cause** — the belief or shortcut behind it, not the symptom.
- **Consequence** — what it actually cost.
- **Rule** — a testable instruction that would have prevented it.

Entries are permanent. If a rule later turns out to be wrong, add a new entry saying so rather than
editing the old one — the point is the pattern over time, and a silently corrected log teaches
nothing.

---

## Shipped a visual feature without ever looking at it

- **What happened** — Added the six map frames, built clean, deployed, and told Will he "should see
  the six frames drawn as a ring around the map". None of them rendered. He found it on a real table.
- **Root cause** — Treated "TypeScript compiles and PHP brace-balances" as evidence the thing draws.
  It is evidence of neither. `scripts/preview/` exists in this repo precisely so the placeholder
  layer can be opened in a plain browser with no BGA table and no server, and I never opened it.
- **Consequence** — Will set up a fresh test table to look at a feature that could not work, and had
  to report the failure back. A wasted deploy and a wasted table.
- **Rule** — Before claiming any rendering change works, open `scripts/preview/` and LOOK at it, or
  say plainly that it is unverified. Never write "you should see X" about pixels I have not seen.

## Appended a CSS declaration onto a helper that returns no trailing semicolon

- **What happened** — `renderFrame()` built its style as
  `` `${hexStyleVars(spec.hex)} --mr-frame-facing:...` ``. `hexStyleVars()` returns
  `--mr-q:X;--mr-r:Y` with **no trailing semicolon**, so the result was one malformed declaration:
  `--mr-r:-5 --mr-frame-facing: 0deg`. `--mr-r` became a garbage token stream, both `left` and `top`
  use it, both went invalid-at-computed-value-time and fell back to `auto`, and all six frames
  stacked at the board's top-left corner — which, now that the board box had grown to include the
  frame anchors, was off the top of the page.
- **Root cause** — Assumed a helper that emits CSS custom properties ends in a separator. Never
  checked the one line of `hex.ts` that says otherwise, and the failure is silent: CSS drops a bad
  declaration without an error, so nothing in the build or the console flags it.
- **Consequence** — The whole frame ring was invisible on a live table. Cost one deploy and one
  round trip with Will.
- **Rule** — `hexStyleVars()` does NOT end in `;`. Anything concatenated after it must supply the
  separator. More generally: when appending to a string that will be parsed as CSS, check what the
  producer emits at the join rather than assuming — a malformed declaration fails silently.

