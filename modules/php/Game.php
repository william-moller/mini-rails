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
            'SELECT `hex_id`, `hex_id` AS `id`, `hex_q` AS `q`, `hex_r` AS `r`, `terrain`, `is_start_for` FROM `hex`'
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
        $startHexIds = $this->setupMap();
        $this->setupDiscs($playerCount, $startHexIds);
        $this->setupMarkers(array_keys($players));

        // The Draw Phase opens round 1; it is a GAME state, so no player is active yet.
        return DrawPhase::class;
    }

    /**
     * Build the map and choose each company's starting hexes.
     *
     * ⚠️ PROVISIONAL on two counts — the map shape (Material::mapHexes) and the terrain mix
     * (Material::terrainBag). Both are flagged there and both are expected to change once the art
     * files arrive.
     *
     * @return array company => list of hex_id
     */
    private function setupMap(): array
    {
        $hexes = Material::mapHexes();

        // The Big City sits at the centre (rulebook Game Setup step 2).
        $terrainFor = [];
        $fillers = Material::terrainBag(count($hexes) - 1);
        shuffle($fillers);
        $f = 0;
        foreach ($hexes as $h) {
            $key = $h['q'] . ',' . $h['r'];
            $terrainFor[$key] = ($h['q'] === 0 && $h['r'] === 0) ? 'big-city' : $fillers[$f++];
        }

        // Each company is seeded on one of the six outer tiles — "next to their respective frame
        // colours". Which outer tile belongs to which company is randomised per game, standing in for
        // the rulebook's random tile placement.
        $outerCentres = [
            ['q' => 1,  'r' => 2],  ['q' => 3,  'r' => -1], ['q' => 2,  'r' => -3],
            ['q' => -1, 'r' => -2], ['q' => -3, 'r' => 1],  ['q' => -2, 'r' => 3],
        ];
        shuffle($outerCentres);

        $startFor = [];
        foreach (Material::COMPANIES as $i => $company) {
            $centre = $outerCentres[$i];
            $ring = Material::neighbours($centre['q'], $centre['r']);
            $ring[] = $centre;
            // Prefer the hexes furthest from the map centre — those sit against the frame.
            usort($ring, function ($a, $b) {
                return Material::distance($b['q'], $b['r'], 0, 0)
                     <=> Material::distance($a['q'], $a['r'], 0, 0);
            });
            $startFor[$company] = $ring;
        }

        // Persist the map, recording which company (if any) starts on each hex.
        $rows = [];
        $startClaim = [];
        foreach ($startFor as $company => $ring) {
            foreach ($ring as $h) {
                $startClaim[$h['q'] . ',' . $h['r']] = $company;
            }
        }
        foreach ($hexes as $h) {
            $key = $h['q'] . ',' . $h['r'];
            $claim = $startClaim[$key] ?? null;
            $rows[] = sprintf(
                "(%d, %d, '%s', %s)",
                $h['q'],
                $h['r'],
                $terrainFor[$key],
                $claim === null ? 'NULL' : "'" . $claim . "'"
            );
        }
        static::DbQuery(
            'INSERT INTO `hex` (`hex_q`, `hex_r`, `terrain`, `is_start_for`) VALUES ' . implode(',', $rows)
        );

        // Map axial back to the generated hex_ids so the caller can seed discs.
        $idByKey = [];
        foreach ($this->getHexes() as $hex) {
            $idByKey[$hex['q'] . ',' . $hex['r']] = (int) $hex['hex_id'];
        }
        $out = [];
        foreach ($startFor as $company => $ring) {
            $ids = [];
            foreach ($ring as $h) {
                $ids[] = $idByKey[$h['q'] . ',' . $h['r']];
            }
            $out[$company] = $ids;
        }
        return $out;
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
     * Remove the leftmost order-track marker.
     *
     * ⚠️ PARTIAL — properly this marker moves ONTO the market track, into the slot of the disc the
     * player chose, which is what makes this round's market track become next round's order track.
     * The slot choice belongs to the actions, which are not written yet. See States/NextPlayer.
     */
    public function consumeFirstOrderMarker(): void
    {
        static::DbQuery(
            'DELETE FROM `marker` WHERE `track` = \'order\' ORDER BY `slot` ASC LIMIT 1'
        );
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

    // ── Debug ─────────────────────────────────────────────────────────────────────────────────

    public function debug_goToState(int $state = 3)
    {
        $this->gamestate->jumpToState($state);
    }
}
