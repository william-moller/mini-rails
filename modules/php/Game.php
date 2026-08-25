<?php
/**
 *------
 * BGA framework: Gregory Isabelli & Emmanuel Colin & BoardGameArena
 * Mini Rails implementation : © Will Moller <will.moller@gmail.com>
 *
 * This code has been produced on the BGA studio platform for use on http://boardgamearena.com.
 * See http://en.boardgamearena.com/#!doc/Studio for more information.
 * -----
 *
 * Game.php
 *
 * Core game logic: setup, the disc Deck, and the shared helpers the state classes call.
 * Rules: .claude/game-rules.md (1st edition, 3-5 players). Schema: dbmodel.sql.
 */
declare(strict_types=1);

namespace Bga\Games\minirailsmospinach;

use Bga\GameFramework\Components\Deck;
use Bga\Games\minirailsmospinach\States\DrawPhase;

class Game extends \Bga\GameFramework\Table
{
    /** The 72 Train Company Discs. Every disc in the game is a row here. */
    public Deck $discs;

    public function __construct()
    {
        parent::__construct();

        $this->initGameStateLabels([
            'round_no' => 10,
        ]);

        // NOTE: $this->deckFactory (no ->bga) is DEPRECATED in this framework version — _ide_helper.php
        // says so explicitly. The wiki mirror in ../../.claude/reference/component-deck.md still shows
        // the old form; do not copy it.
        $this->discs = $this->bga->deckFactory->createDeck('disc');
    }

    // ── Progression ───────────────────────────────────────────────────────────────────────────

    public function getGameProgression()
    {
        $round = (int) $this->getGameStateValue('round_no');
        if ($round <= 0) {
            return 0;
        }
        return (int) min(100, round(($round - 1) / Material::ROUNDS * 100));
    }

    public function upgradeTableDb($from_version)
    {
    }

    // ── Shared accessors ──────────────────────────────────────────────────────────────────────

    public function playerCount(): int
    {
        return (int) $this->getPlayersNumber();
    }

    public function trackLength(): int
    {
        return Material::trackLength($this->playerCount());
    }

    public function currentRound(): int
    {
        return (int) $this->getGameStateValue('round_no');
    }

    /** The map, as stored at setup. Keyed by hex_id. */
    public function getHexes(): array
    {
        return $this->getCollectionFromDb(
            'SELECT `hex_id`, `hex_id` AS `id`, `hex_q` AS `q`, `hex_r` AS `r`,
                    `tile_id` AS `tile`, `tile_pos` AS `position`, `space`,
                    `terrain`, `is_start_for`
             FROM `hex`'
        );
    }

    /**
     * The 7 map tiles as laid out for this game — the physical component behind the 49 hexes.
     * Ordered by slot so the centre (The Big City tile) comes first.
     */
    public function getTiles(): array
    {
        return $this->getObjectListFromDB(
            'SELECT `tile_id` AS `tile`, `face`, `rotation`, `slot` FROM `tile` ORDER BY `slot`'
        );
    }

    public function getMarkers(): array
    {
        return $this->getObjectListFromDB(
            'SELECT `marker_id` AS `id`, `player_id`, `track`, `slot` FROM `marker` ORDER BY `track`, `slot`'
        );
    }

    /**
     * Every disc that is anywhere visible, grouped by zone. Discs still in the bag are deliberately
     * NOT listed individually — their colours are hidden information — only counted.
     */
    public function getBoardDiscs(): array
    {
        $out = [
            'market' => [],
            'hex'    => [],
            'frame'  => [],
            'taxed'  => [],
            'stocks' => [],
        ];

        foreach (['market', 'hex', 'frame', 'taxed'] as $zone) {
            foreach ($this->discs->getCardsInLocation($zone) as $disc) {
                $out[$zone][] = [
                    'id'      => (int) $disc['id'],
                    'company' => $disc['type'],
                    'arg'     => (int) $disc['location_arg'],
                ];
            }
        }

        foreach ($this->loadPlayersBasicInfos() as $playerId => $_player) {
            foreach ($this->discs->getCardsInLocation('stock_' . $playerId) as $disc) {
                $out['stocks'][] = [
                    'id'      => (int) $disc['id'],
                    'company' => $disc['type'],
                    'player'  => (int) $playerId,
                    'value'   => (int) $disc['location_arg'],
                ];
            }
        }

        return $out;
    }

    public function bagCount(): int
    {
        return (int) $this->discs->countCardInLocation('bag');
    }

    // ── getAllDatas ───────────────────────────────────────────────────────────────────────────

    protected function getAllDatas(int $currentPlayerId): array
    {
        $result = [];

        $result['players'] = $this->getCollectionFromDb(
            'SELECT `player_id` AS `id`, `player_name` AS `name`, `player_color` AS `color`,
                    `player_score` AS `score`,
                    `player_buy_spent` AS `buySpent`, `player_build_spent` AS `buildSpent`
             FROM `player`'
        );

        $result['tiles']       = $this->getTiles();
        $result['tileSlots']   = Material::TILE_SLOTS;
        $result['hexes']       = array_values($this->getHexes());
        $result['markers']     = $this->getMarkers();
        $result['discs']       = $this->getBoardDiscs();
        $result['bagCount']    = $this->bagCount();
        $result['round']       = $this->currentRound();
        $result['roundsTotal'] = Material::ROUNDS;
        $result['trackLength'] = $this->trackLength();
        $result['companies']   = Material::COMPANIES;
        $result['terrainValue'] = Material::TERRAIN_VALUE;
        $result['profitMin']   = Material::PROFIT_MIN;
        $result['profitMax']   = Material::PROFIT_MAX;

        return $result;
    }

    // ── Setup ─────────────────────────────────────────────────────────────────────────────────

    protected function setupNewGame($players, $options = [])
    {
        $gameinfos = $this->getGameinfos();
        $default_colors = $gameinfos['player_colors'];

        $query_values = [];
        foreach ($players as $player_id => $player) {
            $query_values[] = vsprintf("(%s, '%s', '%s')", [
                $player_id,
                array_shift($default_colors),
                addslashes($player['player_name']),
            ]);
        }
        static::DbQuery(
            sprintf(
                'INSERT INTO `player` (`player_id`, `player_color`, `player_name`) VALUES %s',
                implode(',', $query_values)
            )
        );

        $this->reattributeColorsBasedOnPreferences($players, $gameinfos['player_colors']);
        $this->reloadPlayersBasicInfos();

        $this->setGameStateInitialValue('round_no', 0);

        $playerCount = count($players);
        $setup = Material::SETUP[$playerCount] ?? Material::SETUP[3];
        $startHexIds = $this->setupMap($setup['start']);
        $this->setupDiscs($playerCount, $startHexIds);
        $this->setupMarkers(array_keys($players));

        // The Draw Phase opens round 1; it is a GAME state, so no player is active yet.
        return DrawPhase::class;
    }

    /**
     * Lay out the 7 map tiles, expand them into the 49 board spaces, and choose each company's
     * starting hexes.
     *
     * The tiles are the physical component and the source of truth: each gets a random face (A/B)
     * and a random rotation, The Big City tile takes the centre slot, and the other six are shuffled
     * around it (rulebook Game Setup step 2). `hex` is the derived expansion of that.
     *
     * ⚠️ Which terrain sits on which SPACE is still provisional — see Material::TERRAIN_BY_SPACE.
     * The tile layout, rotation and flip above it are not.
     *
     * @param int $startPerCompany how many starting hexes each company seeds, by player count
     * @return array company => list of hex_id
     */
    private function setupMap(int $startPerCompany): array
    {
        $tiles = Material::rollTiles();

        $tileRows = [];
        foreach ($tiles as $t) {
            $tileRows[] = sprintf('(%d, %d, %d, %d)', $t['tile'], $t['face'], $t['rotation'], $t['slot']);
        }
        static::DbQuery(
            'INSERT INTO `tile` (`tile_id`, `face`, `rotation`, `slot`) VALUES ' . implode(',', $tileRows)
        );

        $spaces = Material::expandTiles($tiles);

        // Each company is seeded on one of the six OUTER tiles — "next to their respective frame
        // colours". Which outer tile belongs to which company is randomised per game.
        //
        // ⚠️ PROVISIONAL. The rulebook shows the starting hexes as diagrams only, and the 3-player
        // layout differs from the 4/5-player one. Choosing the spaces furthest from the map centre
        // is a stand-in that puts them against the frame, which is what the diagrams show.
        $spacesBySlot = [];
        foreach ($spaces as $i => $s) {
            $slot = $this->slotOfTile($tiles, $s['tile']);
            $spacesBySlot[$slot][] = $i;
        }

        $outerSlots = [1, 2, 3, 4, 5, 6];
        shuffle($outerSlots);

        $startClaim = [];
        foreach (Material::COMPANIES as $i => $company) {
            $candidates = $spacesBySlot[$outerSlots[$i]];
            // Furthest from the map centre first — those sit against the frame.
            usort($candidates, function ($a, $b) use ($spaces) {
                return Material::distance($spaces[$b]['q'], $spaces[$b]['r'], 0, 0)
                     <=> Material::distance($spaces[$a]['q'], $spaces[$a]['r'], 0, 0);
            });
            // Claim ONLY the spaces that will actually receive a disc, so is_start_for matches
            // where the discs land rather than marking the whole tile.
            $startClaim[$company] = array_slice($candidates, 0, $startPerCompany);
        }

        $claimBySpace = [];
        foreach ($startClaim as $company => $indices) {
            foreach ($indices as $i) {
                $claimBySpace[$i] = $company;
            }
        }

        $rows = [];
        foreach ($spaces as $i => $s) {
            $claim = $claimBySpace[$i] ?? null;
            $rows[] = sprintf(
                "(%d, %d, %d, %d, '%s', '%s', %s)",
                $s['q'],
                $s['r'],
                $s['tile'],
                $s['position'],
                $s['space'],
                $s['terrain'],
                $claim === null ? 'NULL' : "'" . $claim . "'"
            );
        }
        static::DbQuery(
            'INSERT INTO `hex` (`hex_q`, `hex_r`, `tile_id`, `tile_pos`, `space`, `terrain`, `is_start_for`)
             VALUES ' . implode(',', $rows)
        );

        // Map axial back to the generated hex_ids so the caller can seed discs.
        $idByKey = [];
        foreach ($this->getHexes() as $hex) {
            $idByKey[$hex['q'] . ',' . $hex['r']] = (int) $hex['hex_id'];
        }
        $out = [];
        foreach ($startClaim as $company => $indices) {
            $ids = [];
            foreach ($indices as $i) {
                $ids[] = $idByKey[$spaces[$i]['q'] . ',' . $spaces[$i]['r']];
            }
            $out[$company] = $ids;
        }
        return $out;
    }

    /** Which board slot a given tile was placed in. */
    private function slotOfTile(array $tiles, int $tileId): int
    {
        foreach ($tiles as $t) {
            if ($t['tile'] === $tileId) {
                return $t['slot'];
            }
        }
        throw new \BgaVisibleSystemException("Tile $tileId was not placed");
    }

    /**
     * Create the discs and split them between the starting hexes and the bag, per player count
     * (rulebook Game Setup step 4).
     */
    private function setupDiscs(int $playerCount, array $startHexIds): void
    {
        $setup = Material::SETUP[$playerCount] ?? Material::SETUP[3];

        $cards = [];
        foreach (Material::COMPANIES as $company) {
            $cards[] = ['type' => $company, 'type_arg' => 0, 'nbr' => $setup['total']];
        }
        $this->discs->createCards($cards, 'bag');

        // Move this company's starting discs out of the bag and onto its starting hexes.
        foreach (Material::COMPANIES as $company) {
            $available = array_values($this->discs->getCardsInLocation('bag'));
            $mine = [];
            foreach ($available as $disc) {
                if ($disc['type'] === $company) {
                    $mine[] = $disc;
                }
            }
            for ($i = 0; $i < $setup['start']; $i++) {
                if (!isset($mine[$i]) || !isset($startHexIds[$company][$i])) {
                    break;
                }
                $this->discs->moveCard((int) $mine[$i]['id'], 'hex', $startHexIds[$company][$i]);
            }
        }

        $this->discs->shuffle('bag');
    }

    /**
     * Place the order markers (rulebook Game Setup step 6).
     *
     * Clockwise from the start player each places one marker, then counter-clockwise from the last
     * player each places their second — a snake, so for players A-E the order is A B C D E E D C B A
     * and the first player is also the last.
     */
    private function setupMarkers(array $playerIds): void
    {
        $order = array_values($playerIds);
        $snake = array_merge($order, array_reverse($order));

        $rows = [];
        foreach ($snake as $slot => $playerId) {
            $rows[] = sprintf('(%d, %s, %d)', (int) $playerId, "'order'", $slot);
        }
        static::DbQuery(
            'INSERT INTO `marker` (`player_id`, `track`, `slot`) VALUES ' . implode(',', $rows)
        );
    }

    // ── Helpers used by the state classes ─────────────────────────────────────────────────────

    /**
     * Draw Phase step 1: draw 2*players+1 discs from the bag onto the market track, left to right.
     *
     * @return array the discs placed, in slot order
     */
    public function drawMarket(): array
    {
        $count = Material::drawCount($this->playerCount());
        $bag = array_values($this->discs->getCardsInLocation('bag', null, 'location_arg'));

        $placed = [];
        for ($slot = 0; $slot < $count; $slot++) {
            if (!isset($bag[$slot])) {
                break; // the bag empties exactly as the last round is drawn; never mid-draw
            }
            $disc = $bag[$slot];
            $this->discs->moveCard((int) $disc['id'], 'market', $slot);
            $placed[] = [
                'id'      => (int) $disc['id'],
                'company' => $disc['type'],
                'arg'     => $slot,
            ];
        }
        return $placed;
    }

    /** Draw Phase step 2: every player gets both action tiles back. */
    public function resetActionTiles(): void
    {
        static::DbQuery('UPDATE `player` SET `player_buy_spent` = 0, `player_build_spent` = 0');
    }

    public function setRound(int $round): void
    {
        $this->setGameStateValue('round_no', $round);
    }

    /**
     * Whose turn it is: the owner of the leftmost remaining marker on the order track. Markers leave
     * the order track as their owners act, so "leftmost remaining" walks the round forward on its own.
     */
    public function firstOrderPlayerId(): ?int
    {
        $row = $this->getObjectFromDB(
            'SELECT `player_id` FROM `marker` WHERE `track` = \'order\' ORDER BY `slot` ASC LIMIT 1'
        );
        return $row === null ? null : (int) $row['player_id'];
    }

    /**
     * Move the acting player's marker from the order track onto the market track, into the slot of
     * the disc they just took.
     *
     * This is the hinge of the whole game: the markers left behind on the market track ARE next
     * round's order track (see flipTracks). A marker is never destroyed — there are exactly two per
     * player for the whole game, and they shuttle between the two tracks.
     *
     * ⚠️ Touches exactly ONE marker. The order-track markers still waiting keep the slots they were
     * placed on, so the gaps left behind show how far into the round play has got. Do NOT renumber
     * them as they leave — the only gap-closing in the game happens once per round, in flipTracks,
     * and it closes the single gap left by the TAXED DISC, not by a departed marker.
     */
    public function placeMarkerOnMarket(int $slot): void
    {
        static::DbQuery(sprintf(
            'UPDATE `marker` SET `track` = \'market\', `slot` = %d
             WHERE `track` = \'order\' ORDER BY `slot` ASC LIMIT 1',
            $slot
        ));
    }

    // ── Actions ───────────────────────────────────────────────────────────────────────────────

    /**
     * The discs still available on the market track — those whose slot has not yet been taken by a
     * marker. Keyed by disc id.
     */
    public function availableMarketDiscs(): array
    {
        $takenSlots = [];
        foreach ($this->getMarkers() as $marker) {
            if ($marker['track'] === 'market') {
                $takenSlots[(int) $marker['slot']] = true;
            }
        }

        $out = [];
        foreach ($this->discs->getCardsInLocation('market') as $disc) {
            $slot = (int) $disc['location_arg'];
            if (isset($takenSlots[$slot])) {
                continue;
            }
            $out[(int) $disc['id']] = [
                'id'      => (int) $disc['id'],
                'company' => $disc['type'],
                'slot'    => $slot,
            ];
        }
        return $out;
    }

    /**
     * Take a disc off the market track, leaving the acting player's marker in its slot.
     * Both actions open this way; they differ only in what happens to the disc afterwards.
     *
     * @return array the disc taken
     */
    public function takeMarketDisc(int $discId): array
    {
        $available = $this->availableMarketDiscs();
        if (!isset($available[$discId])) {
            throw new \BgaUserException($this->_('That disc is no longer on the market track.'));
        }
        $this->placeMarkerOnMarket($available[$discId]['slot']);
        return $available[$discId];
    }

    /** Whether the player still has each action tile this round. */
    public function actionTilesLeft(int $playerId): array
    {
        $row = $this->getObjectFromDB(sprintf(
            'SELECT `player_buy_spent` AS `buy`, `player_build_spent` AS `build`
             FROM `player` WHERE `player_id` = %d',
            $playerId
        ));
        return ['buy' => ((int) $row['buy']) === 0, 'build' => ((int) $row['build']) === 0];
    }

    public function spendActionTile(int $playerId, string $which): void
    {
        $column = $which === 'buy' ? 'player_buy_spent' : 'player_build_spent';
        static::DbQuery(sprintf(
            'UPDATE `player` SET `%s` = 1 WHERE `player_id` = %d',
            $column,
            $playerId
        ));
    }

    /**
     * Where a company may legally build: any EMPTY hex adjacent to a hex already holding a disc of
     * that same colour.
     *
     * @return array list of hex_id
     */
    public function legalHexIdsFor(string $company): array
    {
        $hexes = $this->getHexes();

        $idByKey = [];
        foreach ($hexes as $hex) {
            $idByKey[$hex['q'] . ',' . $hex['r']] = (int) $hex['hex_id'];
        }

        $occupied = [];
        $sources  = [];
        foreach ($this->discs->getCardsInLocation('hex') as $disc) {
            $hexId = (int) $disc['location_arg'];
            $occupied[$hexId] = true;
            if ($disc['type'] === $company) {
                $sources[$hexId] = true;
            }
        }

        $legal = [];
        foreach ($hexes as $hex) {
            $hexId = (int) $hex['hex_id'];
            if (!isset($sources[$hexId])) {
                continue;
            }
            foreach (Material::neighbours((int) $hex['q'], (int) $hex['r']) as $n) {
                $key = $n['q'] . ',' . $n['r'];
                if (!isset($idByKey[$key])) {
                    continue; // off the edge of the map
                }
                $neighbourId = $idByKey[$key];
                if (!isset($occupied[$neighbourId])) {
                    $legal[$neighbourId] = true;
                }
            }
        }
        return array_keys($legal);
    }

    /**
     * Move every stock of one colour, on EVERY player's Profit Board, by the given amount.
     *
     * Rulebook FAQ Q2: a stock already at a cap stays put while the others still move — which is
     * exactly what clamping each row independently does.
     */
    public function moveStocks(string $company, int $delta): void
    {
        if ($delta === 0 || !in_array($company, Material::COMPANIES, true)) {
            return;
        }
        static::DbQuery(sprintf(
            'UPDATE `disc`
                SET `card_location_arg` = GREATEST(%d, LEAST(%d, `card_location_arg` + (%d)))
              WHERE `card_type` = \'%s\' AND `card_location` LIKE \'stock\\_%%\'',
            Material::PROFIT_MIN,
            Material::PROFIT_MAX,
            $delta,
            $company
        ));
    }

    /** Every stock on the board, as the client wants it after a move. */
    public function stocksOf(string $company): array
    {
        return $this->getObjectListFromDB(sprintf(
            'SELECT `card_id` AS `id`, `card_type` AS `company`,
                    CAST(SUBSTRING(`card_location`, 7) AS UNSIGNED) AS `player`,
                    `card_location_arg` AS `value`
               FROM `disc`
              WHERE `card_type` = \'%s\' AND `card_location` LIKE \'stock\\_%%\'',
            $company
        ));
    }

    // ── Taxation ──────────────────────────────────────────────────────────────────────────────

    /** The one disc still on the market track once every player has acted. */
    public function leftoverMarketDisc(): ?array
    {
        $available = array_values($this->availableMarketDiscs());
        return $available[0] ?? null;
    }

    /** Taxed Area step 1: the leftover disc moves to the leftmost empty taxed space. */
    public function taxDisc(int $discId): int
    {
        $slot = $this->taxedCount();
        $this->discs->moveCard($discId, 'taxed', $slot);
        return $slot;
    }

    public function taxedCount(): int
    {
        return (int) $this->discs->countCardInLocation('taxed');
    }

    /**
     * The taxed area is what ends the game: one disc lands in it per round, so it fills exactly as
     * the bag empties. While it still has an empty space, another round is started.
     */
    public function taxedAreaFull(): bool
    {
        return $this->taxedCount() >= Material::ROUNDS;
    }

    /**
     * Taxed Area step 2: the market track, gap closed, becomes next round's order track.
     *
     * This is the ONLY place markers are renumbered, and it happens once per round. Exactly one gap
     * exists at this point — the slot the taxed disc vacated — because every other slot holds a
     * marker. Renumbering the markers 0..2n-1 in their existing slot order closes that one gap while
     * keeping their sequence intact, which is what makes the discs players chose this round become
     * next round's turn order.
     */
    public function flipTracks(): void
    {
        $markers = $this->getObjectListFromDB(
            'SELECT `marker_id` FROM `marker` WHERE `track` = \'market\' ORDER BY `slot` ASC'
        );
        foreach ($markers as $slot => $marker) {
            static::DbQuery(sprintf(
                'UPDATE `marker` SET `track` = \'order\', `slot` = %d WHERE `marker_id` = %d',
                $slot,
                (int) $marker['marker_id']
            ));
        }
    }

    /** Make the leftmost order-track player active. Returns false if the order track is empty. */
    public function activateFirstOrderPlayer(): bool
    {
        $playerId = $this->firstOrderPlayerId();
        if ($playerId === null) {
            return false;
        }
        $this->gamestate->changeActivePlayer($playerId);
        return true;
    }

    // ── Final scoring ─────────────────────────────────────────────────────────────────────────

    /**
     * Companies with at least one disc in the taxed area.
     *
     * PRESENCE only — a company taxed in three separate rounds counts exactly the same as one taxed
     * once. What matters is whether it appears at all.
     */
    public function taxedCompanies(): array
    {
        $out = [];
        foreach ($this->discs->getCardsInLocation('taxed') as $disc) {
            $out[$disc['type']] = true;
        }
        return array_keys($out);
    }

    /**
     * Score the game and write final scores.
     *
     * The inversion is the heart of Mini Rails:
     *   - a company that WAS taxed cannot cost you points — its stocks in the loss zone are removed,
     *     so being taxed secures a company's gains and wipes its losses;
     *   - a company that was NOT taxed cannot earn you any — its stocks in the profit zone are
     *     removed, so escaping tax wipes its gains and leaves its losses.
     *
     * Stocks at exactly 0 survive either way and score nothing, which is the same result whichever
     * way you read "loss zone" and "profit zone".
     *
     * ⚠️ A NEGATIVE TOTAL CAN WIN (rulebook FAQ Q1). If everyone is underwater the least-negative
     * total takes it, so nothing here may clamp at zero.
     *
     * @return array playerId => ['score', 'kept', 'removed', 'taxed']
     */
    public function scoreFinal(): array
    {
        $taxed = array_fill_keys($this->taxedCompanies(), true);
        $result = [];

        foreach (array_keys($this->loadPlayersBasicInfos()) as $playerId) {
            $playerId = (int) $playerId;
            $kept     = [];
            $removed  = [];

            foreach ($this->discs->getCardsInLocation('stock_' . $playerId) as $disc) {
                $discId  = (int) $disc['id'];
                $value   = (int) $disc['location_arg'];
                $company = $disc['type'];
                $entry   = ['id' => $discId, 'company' => $company, 'value' => $value];

                $wasTaxed = isset($taxed[$company]);
                $eliminate = $wasTaxed ? ($value < 0) : ($value > 0);

                if ($eliminate) {
                    // Off the Profit Board entirely, so it stops showing as a stock. The value is
                    // kept in location_arg for the log rather than being thrown away.
                    $this->discs->moveCard($discId, 'scrapped_' . $playerId, $value);
                    $removed[] = $entry;
                } else {
                    $kept[] = $entry;
                }
            }

            $values = array_column($kept, 'value');
            $score  = array_sum($values);

            $this->playerScore->set($playerId, $score);
            $this->playerScoreAux->set($playerId, self::tiebreakValue($values));

            $result[$playerId] = [
                'score'   => $score,
                'kept'    => $kept,
                'removed' => $removed,
            ];
        }

        return $result;
    }

    /**
     * Encode "compare the highest remaining stock, then the second, and so on" into the single
     * integer BGA gives us.
     *
     * BGA ranks on player_score then player_score_aux and has NO third sort column, so the whole
     * ordered comparison has to fold into one number. Stock values run -10..+10, so each becomes a
     * digit 1..21 (value + 11) with 0 reserved for "no stock here"; six digits in base 22, most
     * significant = highest stock, reproduces the comparison exactly. Max is 22^6 - 1 = 113,379,903,
     * comfortably inside a signed 32-bit column.
     *
     * A player holds six stocks — one Buy per round — but elimination can leave fewer, which is what
     * the 0 pad is for: a player with nothing in that position ranks below one who still has a stock.
     * Players tied on every position share the victory, which falls out of both scores matching.
     */
    private static function tiebreakValue(array $values): int
    {
        rsort($values);
        $aux = 0;
        for ($i = 0; $i < Material::ROUNDS; $i++) {
            $digit = isset($values[$i]) ? $values[$i] + 11 : 0;
            $aux = $aux * 22 + $digit;
        }
        return $aux;
    }

    // ── Debug ─────────────────────────────────────────────────────────────────────────────────

    public function debug_goToState(int $state = 3)
    {
        $this->gamestate->jumpToState($state);
    }
}
