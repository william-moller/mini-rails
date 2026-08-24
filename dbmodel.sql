
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
--   disc_type          = company colour: 'red'|'white'|'tan'|'blue'|'yellow'|'gray'
--   disc_type_arg      = unused (0)
--   disc_location      = 'bag'                 -- undrawn, in the cloth bag
--                      | 'market'              -- on the market track this round
--                      | 'hex'                 -- built as track on the map
--                      | 'frame'               -- blocked company, placed on its frame
--                      | 'taxed'               -- moved to the taxed area at end of round
--                      | 'stock_<player_id>'   -- held as a share on that player's Profit Board
--   disc_location_arg  = market -> slot index 0..2n
--                        hex    -> hex_id (see `hex` below)
--                        frame  -> 0 (the company is already disc_type)
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
-- disc_location_arg must stay SIGNED — stock values go negative.
--
-- IMPORTANT (modern framework): the Deck component auto-creates this table with the 5 standard
-- columns and IGNORES any extra columns declared here. Keep it to the standard 5; per-disc extras
-- would need a separate side table.
-- =====================================================================
CREATE TABLE IF NOT EXISTS `disc` (
  `disc_id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `disc_type` VARCHAR(8) NOT NULL,
  `disc_type_arg` INT NOT NULL DEFAULT 0,
  `disc_location` VARCHAR(24) NOT NULL,
  `disc_location_arg` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`disc_id`),
  KEY `idx_disc_location` (`disc_location`, `disc_location_arg`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 AUTO_INCREMENT=1;


-- =====================================================================
-- hex : the map, generated at setup.
-- A table rather than static data because the rulebook randomises the map every game: the six
-- non-central tiles are placed randomly around The Big City, and each tile's facing and orientation
-- are random too.
--
--   hex_q / hex_r  = AXIAL coordinates (not offset). One neighbour table, no row-parity special case.
--                    Matches src/ts/hex.ts.
--   terrain        = 'big-city'|'suburbs'|'farmland'|'plains'|'forest'|'lake'|'mountains'
--                    Printed value comes from Material::TERRAIN_VALUE, not stored here.
--   is_start_for   = company colour whose starting discs seed this hex, else NULL.
--
-- ⚠️ The SHAPE of the map is provisional — see Material::mapLayout() and src/ts/hex.ts.
-- =====================================================================
CREATE TABLE IF NOT EXISTS `hex` (
  `hex_id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `hex_q` INT NOT NULL,
  `hex_r` INT NOT NULL,
  `terrain` VARCHAR(12) NOT NULL,
  `is_start_for` VARCHAR(8) DEFAULT NULL,
  PRIMARY KEY (`hex_id`),
  UNIQUE KEY `idx_hex_axial` (`hex_q`, `hex_r`)
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
