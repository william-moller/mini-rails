# Mini Rails — game rules

Derived from `docs/Mini_Rails_Rules_ENG-0615.pdf` (extracted with `pdftotext -layout`). Designer
**Mark Gerrits**, publisher **Moaideas Game Design**.

> ## ⚠️ Edition warning — read before implementing anything
>
> That PDF is the **First Edition, dated June 25 2017**, and it covers **3–5 players only**.
> A **second edition was published in 2025** which reportedly supports **1–5 players**. We do **not**
> have its rulebook — it is not on BoardGameGeek — so **what changed between editions is unknown**.
>
> BGA's licence for this game dates from 2025-03-19, so the second edition may well be what we are
> expected to implement. Everything below is 1st-edition and is a **working baseline that may need
> correcting**, not settled truth.
>
> Two consequences, and they are not the same size:
>
> - **Solo (1p) and 2-player rules do not exist in our source at all.** They cannot be inferred — a
>   solo mode needs an opponent model, and the market/order track maths below is built on
>   `2 × players + 1` and breaks down at low counts (see *Why the track sizes work*).
> - Anything else may have been retuned — disc counts, terrain values, round count — without us
>   knowing.
>
> Weak corroboration for the 1st-edition numbers: the abandoned `minirails` project
> ([`../../_reference/minirails/`](../../_reference/minirails/)) was authored in December 2025,
> *after* the 2nd edition, and still declares `players => [3, 4, 5]` with the same six companies.
> Weak, because that developer may simply have used the edition they owned, as we are.

## Overview

Players are investors manipulating the stock prices of six railway companies. There are exactly two
actions — **Buy Shares** and **Build Tracks** — and each player must take **each one exactly once per
round**. Building moves a company's stock value for *every* player holding it, so the game is about
building where it lifts the stock you hold and sinks the ones you don't.

**6 rounds.** Each round: **Draw Phase → Action Phase → Taxation Phase**.

## Components

| Count | Component |
|------:|-----------|
| 7 | Map tiles (double-sided; one is **The Big City**) |
| 6 | Frame tiles (one per company colour; sides **A** / **B**) |
| 1 | Central Market Board (order track, market track, taxed area) |
| 5 | Player Profit Boards |
| 10 | Player Action Tiles (2 per player: **Buy**, **Build**) |
| 10 | Player Order Markers (2 each of 5 player colours) |
| 72 | Train Company Discs (**12 each of 6 company colours**) |
| 1 | Cloth bag |

### Map tiles — structure (confirmed)

A **map tile** is a hexagonal tile carrying **7 hex spaces**: a centre plus a ring of six. Seven
tiles laid out as a flower-of-flowers give a **49-space board**. Confirmed from the publisher tile
scans in [`../../_reference/minirails/img/`](../../_reference/minirails/img/) (`wheel_0/1/2.png`),
which are labelled with the rulebook's own tile ids — **1A, 2A, 3A** — and each show a ring of six
spaces around a centre. **Tile 1 is The Big City tile**, carrying it on its centre space.

This resolves the old ambiguity: the rulebook never says whether a "map tile" is one hex or a flower
of seven, and 7 single hexes could not absorb 60–72 discs.

Every tile is **randomly flipped** (side A or B, 50/50) and **randomly rotated** (0–5, in 60°
steps); the six non-Big-City tiles are **randomly placed** around the centre. The two faces of a tile
carry **different space layouts**, and that is where between-game variety comes from.

Spaces are identified by a 3-digit **space code**, `tile * 100 + face * 10 + position`, where face is
1 for A and 2 for B, and position is 1 for the tile's centre with 2–7 running clockwise from NE:

```
     ( 7 )   ( 2 )          '314' = tile 3, side A, position 4
  ( 6 )   ( 1 )   ( 3 )     '721' = tile 7, side B, position 1
     ( 5 )   ( 4 )
```

Rotation shifts the **ring only** — a tile's centre space never moves, which is why The Big City
stays put however tile 1 is rotated. The position numbers are **ours, not the publisher's**: a tile
carries only a printed id (`1A`, `2A`, …), so we number the ring 2–7 clockwise from NE and treat the
scan's orientation as rotation 0. Rotation changes only where a position *lands* on the board.

### Map tiles — which terrain sits where

A hex **never prints its value as a numeral**. It shows a cluster of **dots**: **white = +1 each,
red = −1 each**, so The Big City is 5 white dots and Mountains is 3 red. Reading a tile means
counting dots; the final art must carry the dots, not numbers.

Sides **1A**, **2A** and **3A** are confirmed from the publisher scans in
[`../../_reference/minirails/img/`](../../_reference/minirails/img/) (`wheel_0/1/2.png`), centre
first then the ring clockwise from NE:

| Tile | Centre | NE | E | SE | SW | W | NW |
|------|--------|----|---|----|----|---|----|
| **1A** | Big City +5 | Farmland +2 | Forest −1 | Mountains −3 | Lake −2 | Plains +1 | Suburbs +3 |
| **2A** | Mountains −3 | Suburbs +3 | Plains +1 | Farmland +2 | Suburbs +3 | Plains +1 | Farmland +2 |
| **3A** | Suburbs +3 | Farmland +2 | Farmland +2 | Forest −1 | Lake −2 | Forest −1 | Farmland +2 |

1A's ring carries each of the six terrains **exactly once**. 2A is `+3 +1 +2` twice round the ring,
with no negative space except its centre.

⚠️ **Tiles 4–7 and every B side are still placeholders** — see `Material::TERRAIN_BY_SPACE`.

## Setup

1. Build the 6 map frames together. Frame colour order does not matter, but **all frames must show
   the same side (A or B)** to connect.
2. **The Big City** tile (the `+5` hex) goes in the **centre**; the other 6 map tiles go randomly
   around it. Tiles are double-sided — **facing and orientation are both random**.
3. Place the Market Board within reach of all players.
4. By player count, seed the starting hexes and fill the bag:

   | Players | Starting hexes per company | Discs per company in bag | Total discs per company |
   |--------:|---------------------------:|-------------------------:|------------------------:|
   | 3 | 3 | 7 | 10 |
   | 4 | 1 | 9 | 10 |
   | 5 | 1 | 11 | 12 |

   Starting discs go on the starting hexes **next to their respective frame colours** — the hexes
   that company's frame arrows point at (see *Map frames* below). Note that 5 players uses all 12
   discs of each colour (72 total), while 3 and 4 players use 10 each (60).

5. Each player takes 2 order markers, 1 Profit Board, and 2 action tiles in their colour.
6. Start player is whoever most recently bought a train ticket. **Clockwise** from the start player,
   each places 1 marker on the leftmost free space of the order track; then **counter-clockwise**
   from the last player, each places their second marker. For players A–E this yields
   **A B C D E E D C B A** — a snake, so the first player is also the last.

### Map frames

Six chevron pieces, one per company colour, clip together into a ring around the board. Each frame
**cups exactly one outer tile**, so frame ↔ tile slot is 1:1 and the ring covers all 24 perimeter
hexes, four per frame, with no overlap — verified against `Material::TILE_SLOTS`.

A frame does two jobs:

- **It marks that company's starting hexes.** Three arrows point inward: one **primary** and two
  **secondary**. 3 players seed all three; 4 and 5 players seed the primary alone. That is what the
  rulebook's two setup diagrams are — not two different maps, just how many arrows you use.
- **It is where a blocked company's disc goes** when that company has no legal hex anywhere, for −1.

The arrows target **board coordinates, not printed spaces**. A tile's rotation changes which space
lands on a given hex, but never moves the hex a frame abuts, so the starting layout is a property of
the slot alone. Colour order around the ring is **random** — the rulebook says it does not matter —
and that randomisation is the main thing that varies the opening position.

Frames are **reversible**, and all six must show the same side to connect, but the side is
**cosmetic**: both faces carry the same arrows.

⚠️ A frame abuts **four** hexes and carries **three** arrows, so one abutted hex is never marked.
Which one is unconfirmed — see `Material::FRAME_ARROW_PRIMARY`.

## Round structure

### Draw Phase

1. Draw **`2 × players + 1`** discs at random from the bag and place them left-to-right on the
   (empty) market track: **3p → 7, 4p → 9, 5p → 11**.
2. All players return their 2 action tiles face-up to their Profit Board.

### Action Phase

Turn order runs left-to-right along the **order track**. Because of the snake setup a player can take
two turns in a row. On your turn you take **one** action, and across the round you must take **each
action exactly once**.

Both actions open identically: **remove the matching action tile** from your Profit Board, then
**take your leftmost order marker and use it to replace any disc on the market track**. What differs
is what you do with the disc you took.

**Buy Shares** — place the disc on the **`0` space of your Profit Board**. It now tracks that
company's relative value for you.

**Build Tracks** — place the disc on a hex that is **empty** and **adjacent to a disc of the same
colour**, then move **every** stock of that colour, on **every** player's Profit Board, by the hex's
value:

| Hex | Value |
|-----|------:|
| The Big City | **+5** |
| Suburbs | +3 |
| Farmland | +2 |
| Plains | +1 |
| Forest | −1 |
| Lake | −2 |
| Mountains | −3 |

A hex **never shows its number** — only dots: white dots are profit (+1 each), red dots are deficit
(−1 each). The values above are the net dot count. Every hex on the three scanned tiles carries dots
of a single colour, so "net" has never yet meant a subtraction.

**Blocked company:** if the disc has **no legal hex** anywhere on the map, place it on that company's
**frame** and move all stocks of that colour **−1**. You may **not** use the frame while any legal hex
exists.

**Stock values are capped at +10 and −10.** A stock already at a cap stays put; other stocks of the
same colour still move normally.

### Taxation Phase

After every player has taken both actions, **exactly one disc remains** on the market track.

1. Move that disc to the **leftmost empty space of the Taxed Area**.
2. **Slide the player markers left** to close the gap it left. The market track, in that resulting
   order, **becomes the order track for the next round**; the now-empty order track becomes the
   market track to be refilled in the next Draw Phase.
3. Continue while the taxed area still has empty spaces.

### Why the track sizes work

`players × 2` markers are placed during the Action Phase (each player acts twice) onto a track holding
`2 × players + 1` discs — so **exactly one disc is always left over** to be taxed, and the markers
left behind are exactly the next round's turn order. This identity is what would have to be
redesigned for 1- and 2-player counts, and is the main reason the 2nd-edition rules matter.

## Game end and scoring

The game ends after **6 rounds**: the taxed area is full (6 discs, one per round) and the bag is
empty. Each player holds **exactly 6 stocks** — one Buy action per round.

1. For every company with **at least one disc in the taxed area**, each player removes all stocks of
   that company sitting in the **loss (negative) zone**.
2. For every company with **no disc in the taxed area**, each player removes all stocks of that
   company sitting in the **profit (positive) zone**.
3. Sum the relative values of the stocks that remain. Highest total wins.

That inversion is the heart of the game: **being taxed secures a company's gains and wipes its
losses; escaping tax wipes its gains and leaves its losses.**

**Ties:** compare the single most valuable remaining stock, then the second, and so on. If every
stock matches, the tied players **share the victory**.

**A negative total can win** (rulebook FAQ Q1) — if everyone is underwater, the least-negative total
wins. Scoring must not assume a positive winner or clamp at zero.

## Open questions

- **Second-edition deltas.** Everything above is 1st edition. Highest priority is the **1–2 player
  rules**, which do not exist in our source at all.
- **Hex distribution.** The rulebook gives terrain *values* but not which terrain sits on which
  space. That needs the art files or the physical tiles. **The tile *shape* is settled** — see below.
- **Starting hex positions.** The 3-player and 4/5-player layouts differ, and the starting hexes are
  only shown as diagrams. The reference implementation encodes concrete coordinates — a cross-check,
  not a source; re-derive from the rulebook or art.
- **Company colours.** The reference implementation uses red, yellow, blue, grey, tan, white. Confirm
  against the real components rather than inheriting it.
- **Frame sides.** Whether a frame's A/B side changes anything beyond connectivity.
