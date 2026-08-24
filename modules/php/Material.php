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
 * Material.php
 *
 * Static game data. No dynamic state — nothing here changes during a game.
 * Every number is sourced from .claude/game-rules.md (1st edition, 2017, 3-5 players).
 */
declare(strict_types=1);

namespace Bga\Games\minirailsmospinach;

class Material
{
    /**
     * The six train companies. These NAMES are the rulebook's — its scoring example names the Red,
     * White, Tan, Blue, Yellow and Gray companies. Display colours live in src/scss/_tokens.scss.
     */
    public const COMPANIES = ['red', 'white', 'tan', 'blue', 'yellow', 'gray'];

    /** Printed hex values. Applied to EVERY stock of the built company, on every player's board. */
    public const TERRAIN_VALUE = [
        'big-city'  => 5,
        'suburbs'   => 3,
        'farmland'  => 2,
        'plains'    => 1,
        'forest'    => -1,
        'lake'      => -2,
        'mountains' => -3,
    ];

    /** Rulebook FAQ Q2: a stock at a cap stays put while other stocks of its colour still move. */
    public const PROFIT_MIN = -10;
    public const PROFIT_MAX = 10;

    /** The game lasts 6 rounds; the taxed area holds exactly one disc per round. */
    public const ROUNDS = 6;

    /**
     * Setup by player count (rulebook "Game Setup" step 4).
     *   start  = starting hexes seeded per company
     *   bag    = discs per company placed in the bag
     *   total  = discs per company used in the game (start + bag)
     * 5 players uses all 12 discs of each colour (72); 3 and 4 use 10 each (60).
     */
    public const SETUP = [
        3 => ['start' => 3, 'bag' => 7,  'total' => 10],
        4 => ['start' => 1, 'bag' => 9,  'total' => 10],
        5 => ['start' => 1, 'bag' => 11, 'total' => 12],
    ];

    /**
     * Discs drawn to the market track each round: 2 * players + 1.
     *
     * This identity is the engine of the game. Players place 2 * players markers during the Action
     * Phase (each acts twice), so exactly one disc is always left over to be taxed, and the markers
     * left behind are precisely the next round's turn order.
     */
    public static function drawCount(int $playerCount): int
    {
        return $playerCount * 2 + 1;
    }

    /** Both the market and order tracks are this long. */
    public static function trackLength(int $playerCount): int
    {
        return self::drawCount($playerCount);
    }

    /**
     * ⚠️ PROVISIONAL MAP — the shape and the terrain mix are both guesses.
     *
     * The rulebook lists 7 map tiles with The Big City at the centre and six around it, but never says
     * whether a "map tile" is ONE hex or a flower of seven. Seven single hexes cannot absorb the 60-72
     * discs the game uses, so a flower-of-flowers (7 x 7 = 49) is the reading that fits the component
     * counts. The requested art files should settle it.
     *
     * Flower centres are 3 apart, not 2: at distance 2 a hex can be adjacent to BOTH centres and the
     * flowers overlap, which collapses 49 hexes to 31. Verified as 49 unique, 0 overlaps.
     *
     * Mirrors provisionalMap() in src/ts/hex.ts — keep the two in step, and keep this the ONLY place
     * the server defines the map shape.
     *
     * @return array list of ['q' => int, 'r' => int]
     */
    public static function mapHexes(): array
    {
        $tileCentres = [
            ['q' => 0,  'r' => 0],
            ['q' => 1,  'r' => 2],  ['q' => 3,  'r' => -1], ['q' => 2,  'r' => -3],
            ['q' => -1, 'r' => -2], ['q' => -3, 'r' => 1],  ['q' => -2, 'r' => 3],
        ];
        $dirs = [
            ['q' => 0, 'r' => 0],
            ['q' => 1, 'r' => 0],  ['q' => 1, 'r' => -1], ['q' => 0, 'r' => -1],
            ['q' => -1, 'r' => 0], ['q' => -1, 'r' => 1], ['q' => 0, 'r' => 1],
        ];

        $seen = [];
        $out = [];
        foreach ($tileCentres as $c) {
            foreach ($dirs as $d) {
                $q = $c['q'] + $d['q'];
                $r = $c['r'] + $d['r'];
                $key = "$q,$r";
                if (isset($seen[$key])) {
                    continue;
                }
                $seen[$key] = true;
                $out[] = ['q' => $q, 'r' => $r];
            }
        }
        return $out;
    }

    /**
     * ⚠️ PROVISIONAL terrain mix. The rulebook gives terrain VALUES but never how many hexes of each
     * type the map holds, so this distribution is invented to be playable, not accurate. It is
     * deliberately weighted towards low-magnitude terrain so a single build cannot swing a stock too
     * far. Replace once the art files show the real tiles.
     *
     * Excludes 'big-city', which is placed exactly once at the map centre.
     */
    public static function terrainBag(int $needed): array
    {
        $mix = [
            'plains'    => 5,
            'farmland'  => 4,
            'forest'    => 4,
            'suburbs'   => 3,
            'lake'      => 3,
            'mountains' => 3,
        ];
        $bag = [];
        while (count($bag) < $needed) {
            foreach ($mix as $terrain => $weight) {
                for ($i = 0; $i < $weight && count($bag) < $needed; $i++) {
                    $bag[] = $terrain;
                }
            }
        }
        return $bag;
    }

    /** Axial distance between two hexes, via cube coordinates. */
    public static function distance(int $q1, int $r1, int $q2, int $r2): int
    {
        $dq = $q1 - $q2;
        $dr = $r1 - $r2;
        return (int) ((abs($dq) + abs($dq + $dr) + abs($dr)) / 2);
    }

    /** The six neighbours of a hex, in a stable edge order. */
    public static function neighbours(int $q, int $r): array
    {
        $dirs = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
        $out = [];
        foreach ($dirs as $d) {
            $out[] = ['q' => $q + $d[0], 'r' => $r + $d[1]];
        }
        return $out;
    }
}
