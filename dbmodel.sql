
-- ------
-- BGA framework: Gregory Isabelli & Emmanuel Colin & BoardGameArena
-- Mini Rails implementation : © Will Moller <will.moller@gmail.com>
--
-- This code has been produced on the BGA studio platform for use on http://boardgamearena.com.
-- See http://en.boardgamearena.com/#!doc/Studio for more information.
-- -----

-- Database schema for Mini Rails.
-- The standard tables ("global", "stats", "gamelog", "player") already exist and must not be re-created.
-- The schema is (re)built from this file only when a NEW game starts — after changing it, recreate the
-- test table rather than reusing an old one.
--
-- Rules this schema encodes: .claude/game-rules.md (1st edition, 3-5 players).


-- =====================================================================
-- disc : the 72 Train Company Discs (12 each of 6 colours)
-- Managed by the BGA Deck component:  $this->discs = $this->deckFactory->createDeck('disc');
--
-- ⚠️ COLUMNS MUST BE NAMED `card_*`, NOT `disc_*`. The Deck component takes the TABLE name as a
-- parameter but hard-codes the COLUMN prefix as `card_`. Naming them after the table made every
-- Deck call fail at setup with "Unknown column 'card_location_arg' in 'field list'". The table name
-- is the only part that is ours to choose.
--
--   card_type          = company colour: 'red'|'white'|'tan'|'blue'|'yellow'|'gray'
--   card_type_arg      = unused (0)
--   card_location      = 'bag'                 -- undrawn, in the cloth bag
--                      | 'market'              -- on the market track this round
--                      | 'hex'                 -- built as track on the map
--                      | 'frame'               -- blocked company, placed on its frame
--                      | 'taxed'               -- moved to the taxed area at end of round
--                      | 'stock_<player_id>'   -- held as a share on that player's Profit Board
--                      | 'scrapped_<player_id>'-- discarded at FINAL SCORING by the taxed/untaxed
--                                              -- inversion. Keeps the disc (and its last value in
--                                              -- location_arg) for the log instead of deleting it.
--   card_location_arg  = market -> slot index 0..2n
--                        hex    -> hex_id (see `hex` below)
--                        frame  -> 0 (the company is already card_type)
--                        taxed  -> slot index 0..5 (one per round)
--                        stock  -> the stock's CURRENT VALUE, -10..+10
--
-- Why the owner is in the location string rather than location_arg: a stock needs BOTH an owner and a
-- value, and Deck gives one int. Value is the thing that changes constantly (every build moves every
-- stock of that colour), so value takes the int and the owner is baked into the location.
--
-- ⚠️ Each stock carries its OWN value. A share bought in round 4 enters at 0 even if its company is
-- already at +4, then moves with every later build. Buying early vs late IS the game, so value can
-- never be hoisted onto the company.
--
-- card_location_arg must stay SIGNED — stock values go negative.
--
-- Keep this to the 5 standard columns; per-disc extras would need a separate side table.
-- (An earlier note here claimed the Deck component auto-creates the table and ignores what is
-- declared. It does not — this CREATE TABLE is what actually runs, which is exactly why the wrong
-- column names above were fatal rather than harmless.)
-- =====================================================================
CREATE TABLE IF NOT EXISTS `disc` (
  `card_id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `card_type` VARCHAR(8) NOT NULL,
  `card_type_arg` INT NOT NULL DEFAULT 0,
  `card_location` VARCHAR(24) NOT NULL,
  `card_location_arg` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`card_id`),
  KEY `idx_card_location` (`card_location`, `card_location_arg`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 AUTO_INCREMENT=1;


-- =====================================================================
-- tile : the 7 physical Map Tiles, as placed for this game.
--
-- A map tile is a HEXAGONAL TILE carrying 7 hex SPACES — a centre plus a ring of six. Seven tiles
-- laid out as a flower-of-flowers give the 49-space board. (Confirmed from the publisher tile scans
-- in ../../_reference/minirails/img/wheel_*.png, labelled with the rulebook's own tile ids 1A/2A/3A.)
--
--   tile_id  = 1..7, the printed tile number. Tile 1 is The Big City tile.
--   face     = 1 (side A) | 2 (side B). Every tile is flipped 50/50 at setup; the two faces carry
--              DIFFERENT space layouts, which is where between-game variety comes from.
--   rotation = 0..5, in 60-degree steps clockwise. Shifts the tile's ring only; the centre space of
--              a tile never moves.
--   slot     = which of the 7 board positions this tile occupies. 0 is the middle — always tile 1,
--              per rulebook Game Setup step 2 — and 1..6 run clockwise from the top, filled by the
--              other six tiles in random order.
--
-- Rotation and face are stored rather than baked into `hex` because they are properties of the
-- COMPONENT: the renderer needs them to place one tile image at one angle, and they are what a
-- player would physically see. `hex` below is the derived expansion, not the source of truth.
-- =====================================================================
CREATE TABLE IF NOT EXISTS `tile` (
  `tile_id` TINYINT UNSIGNED NOT NULL,
  `face` TINYINT UNSIGNED NOT NULL,
  `rotation` TINYINT UNSIGNED NOT NULL,
  `slot` TINYINT UNSIGNED NOT NULL,
  PRIMARY KEY (`tile_id`),
  UNIQUE KEY `idx_tile_slot` (`slot`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- =====================================================================
-- hex : the 49 board SPACES, expanded from `tile` at setup.
-- A table rather than static data because the rulebook randomises the map every game: the six
-- non-central tiles are placed randomly around The Big City, and each tile's facing and orientation
-- are random too.
--
--   hex_q / hex_r  = AXIAL coordinates (not offset). One neighbour table, no row-parity special case.
--                    Matches src/ts/hex.ts. Derived: tile slot centre + rotated position offset.
--   tile_id        = which tile this space belongs to -> `tile`.
--   tile_pos       = 1..7, the space's LOCAL position on its tile. 1 is the centre; 2..7 are the ring
--                    clockwise from NE at rotation 0. Unaffected by rotation — rotation changes where
--                    a position LANDS (hex_q/hex_r), never the position number itself.
--   space          = the printed space id, tile*100 + face*10 + tile_pos. '314' is tile 3, side A,
--                    position 4; '721' is tile 7, side B, position 1. Denormalised from tile+pos for
--                    debugging and for keying the terrain data by hand.
--   terrain        = 'big-city'|'suburbs'|'farmland'|'plains'|'forest'|'lake'|'mountains'
--                    Denormalised from Material::TERRAIN_BY_SPACE[space]; it never changes during a
--                    game, so a copy here saves a lookup everywhere. Printed VALUE comes from
--                    Material::TERRAIN_VALUE, not stored.
--   is_start_for   = company colour whose starting discs seed this hex, else NULL.
--
-- ⚠️ The map SHAPE is settled (7 tiles x 7 spaces). Which terrain sits on which space is still
-- PROVISIONAL — see Material::TERRAIN_BY_SPACE.
-- =====================================================================
CREATE TABLE IF NOT EXISTS `hex` (
  `hex_id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `hex_q` INT NOT NULL,
  `hex_r` INT NOT NULL,
  `tile_id` TINYINT UNSIGNED NOT NULL,
  `tile_pos` TINYINT UNSIGNED NOT NULL,
  `space` VARCHAR(3) NOT NULL,
  `terrain` VARCHAR(12) NOT NULL,
  `is_start_for` VARCHAR(8) DEFAULT NULL,
  PRIMARY KEY (`hex_id`),
  UNIQUE KEY `idx_hex_axial` (`hex_q`, `hex_r`),
  UNIQUE KEY `idx_hex_space` (`tile_id`, `tile_pos`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 AUTO_INCREMENT=1;


-- =====================================================================
-- marker : the 2 Player Order Markers each player owns.
--
-- Markers live on the ORDER track and move to the MARKET track as their owner acts. At end of round
-- the market track becomes next round's order track, so `track` flips for every marker at once.
--
--   track = 'order' | 'market'
--   slot  = 0-based index along that track (0 = leftmost = acts first)
--
-- Both tracks are 2*players+1 long; the order track uses 2*players of those slots, which is exactly
-- why one disc is always left over to be taxed.
-- =====================================================================
CREATE TABLE IF NOT EXISTS `marker` (
  `marker_id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `player_id` INT UNSIGNED NOT NULL,
  `track` VARCHAR(8) NOT NULL,
  `slot` INT NOT NULL,
  PRIMARY KEY (`marker_id`),
  KEY `idx_marker_track` (`track`, `slot`),
  KEY `idx_marker_player` (`player_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 AUTO_INCREMENT=1;


-- =====================================================================
-- player table extensions
--
-- The two Action Tiles. Each player must take Buy exactly once and Build exactly once per round; a
-- tile is removed from the Profit Board when spent and returned in the next Draw Phase. Two flags
-- are the whole of it, so they live on `player` rather than in a table of their own.
--
-- player_score (built-in) is only meaningful at game end, after the taxed/untaxed elimination.
-- =====================================================================
ALTER TABLE `player` ADD `player_buy_spent` TINYINT UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE `player` ADD `player_build_spent` TINYINT UNSIGNED NOT NULL DEFAULT 0;


-- =====================================================================
-- Globals (framework `global` table; declared in PHP, not here):
--   round_no   1..6   -- the game lasts 6 rounds and the taxed area holds exactly 6 discs
-- =====================================================================
