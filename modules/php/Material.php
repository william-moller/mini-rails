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

    // == Map tiles ============================================================================
    //
    // CONFIRMED SHAPE. A map tile is a hexagonal TILE holding 7 hex SPACES — a centre plus a ring
    // of six. Seven such tiles are laid out as a flower-of-flowers, so the board is 7 x 7 = 49
    // spaces. Confirmed from the publisher tile scans in ../../_reference/minirails/img/wheel_*.png,
    // which are labelled with the rulebook's own tile ids (1A, 2A, 3A) and each show a ring of six
    // spaces around a centre. Tile 1 carries The Big City in its centre.

    /** Tile ids, as printed. */
    public const TILES = [1, 2, 3, 4, 5, 6, 7];

    /**
     * The Big City tile. Always occupies the centre tile slot (rulebook Game Setup step 2).
     *
     * ⚠️ ASSUMPTION: tile 1's CENTRE SPACE is The Big City on BOTH faces. Side A is confirmed from
     * wheel_0.png; side B is inferred, on the grounds that a 50/50 flip which could delete The Big
     * City from the game would be absurd. If the real side B differs, only TERRAIN_BY_SPACE['121']
     * changes.
     */
    public const BIG_CITY_TILE = 1;

    /** Faces. A tile is flipped 50/50 at setup; the two faces carry different space layouts. */
    public const FACE_A = 1;
    public const FACE_B = 2;
    public const FACES = [self::FACE_A, self::FACE_B];

    /** Local space positions on a tile: 1 is the centre, 2..7 are the ring. */
    public const POS_CENTRE = 1;
    public const POSITIONS = [1, 2, 3, 4, 5, 6, 7];

    /**
     * The ring directions, CLOCKWISE FROM NE — the order local positions 2..7 run in at rotation 0.
     *
     *          ( 7 )   ( 2 )
     *       ( 6 )   ( 1 )   ( 3 )
     *          ( 5 )   ( 4 )
     *
     * Pointy-top axial coordinates, r increasing downward. Position 1 is the centre and does not
     * move under rotation. Mirrors RING_CW in src/ts/hex.ts — keep the two in step.
     */
    public const RING_CW = [
        [1, -1],  // NE
        [1, 0],   // E
        [0, 1],   // SE
        [-1, 1],  // SW
        [-1, 0],  // W
        [0, -1],  // NW
    ];

    /**
     * Where each of the 7 tile slots sits, as the axial coordinate of that tile's CENTRE space.
     * Slot 0 is the middle (The Big City tile); slots 1..6 run clockwise from the top.
     *
     * Tile centres are 3 apart, not 2. At distance 2 a space would be adjacent to two tile centres
     * and the tiles overlap, collapsing 49 spaces to 31. Distance 3 tiles exactly — 49 unique, 0
     * overlaps. Rotating a tile permutes its ring but maps its 7 spaces onto themselves, so rotation
     * cannot introduce an overlap either.
     */
    public const TILE_SLOTS = [
        0 => [0, 0],    // centre
        1 => [2, -3],   // N
        2 => [3, -1],   // NE
        3 => [1, 2],    // SE
        4 => [-2, 3],   // S
        5 => [-3, 1],   // SW
        6 => [-1, -2],  // NW
    ];

    /**
     * ⚠️ PROVISIONAL SPACE DATA — invented, not read off the real tiles.
     *
     * The STRUCTURE around this table is settled: 7 tiles x 2 faces x 7 positions = 98 space codes,
     * of which 49 are in play once the flips are decided. The TERRAIN VALUES below are placeholders
     * so the game is playable before the real tile data is entered.
     *
     * Space code = tile * 100 + face * 10 + position, e.g. '314' is tile 3, side A, position 4;
     * '721' is tile 7, side B, position 1. Listed centre-first, then the ring 2..7 clockwise.
     *
     * When the real data arrives, overwrite the values in place — nothing else needs to change.
     * Partial ground truth already exists for 1A, 2A and 3A in the publisher scans at
     * ../../_reference/minirails/img/wheel_*.png; read those properly rather than trusting these.
     *
     * The one non-placeholder entry is The Big City, which must appear exactly once on the board —
     * see BIG_CITY_TILE.
     */
    public const TERRAIN_BY_SPACE = [
        // Tile 1 — The Big City tile. Centre is big-city on both faces.
        '111' => 'big-city',  '112' => 'suburbs',   '113' => 'farmland',  '114' => 'plains',
        '115' => 'forest',    '116' => 'lake',      '117' => 'mountains',
        '121' => 'big-city',  '122' => 'farmland',  '123' => 'plains',    '124' => 'suburbs',
        '125' => 'mountains', '126' => 'forest',    '127' => 'lake',

        // Tile 2
        '211' => 'mountains', '212' => 'farmland',  '213' => 'suburbs',   '214' => 'plains',
        '215' => 'plains',    '216' => 'suburbs',   '217' => 'farmland',
        '221' => 'lake',      '222' => 'plains',    '223' => 'farmland',  '224' => 'forest',
        '225' => 'suburbs',   '226' => 'plains',    '227' => 'forest',

        // Tile 3
        '311' => 'suburbs',   '312' => 'farmland',  '313' => 'farmland',  '314' => 'forest',
        '315' => 'farmland',  '316' => 'lake',      '317' => 'forest',
        '321' => 'forest',    '322' => 'suburbs',   '323' => 'plains',    '324' => 'mountains',
        '325' => 'farmland',  '326' => 'plains',    '327' => 'lake',

        // Tile 4
        '411' => 'plains',    '412' => 'forest',    '413' => 'lake',      '414' => 'farmland',
        '415' => 'suburbs',   '416' => 'mountains', '417' => 'plains',
        '421' => 'farmland',  '422' => 'lake',      '423' => 'plains',    '424' => 'plains',
        '425' => 'forest',    '426' => 'suburbs',   '427' => 'mountains',

        // Tile 5
        '511' => 'forest',    '512' => 'plains',    '513' => 'mountains', '514' => 'suburbs',
        '515' => 'farmland',  '516' => 'forest',    '517' => 'plains',
        '521' => 'suburbs',   '522' => 'mountains', '523' => 'forest',    '524' => 'lake',
        '525' => 'plains',    '526' => 'farmland',  '527' => 'farmland',

        // Tile 6
        '611' => 'lake',      '612' => 'farmland',  '613' => 'plains',    '614' => 'suburbs',
        '615' => 'forest',    '616' => 'plains',    '617' => 'mountains',
        '621' => 'plains',    '622' => 'forest',    '623' => 'suburbs',   '624' => 'farmland',
        '625' => 'lake',      '626' => 'mountains', '627' => 'plains',

        // Tile 7
        '711' => 'farmland',  '712' => 'plains',    '713' => 'forest',    '714' => 'mountains',
        '715' => 'suburbs',   '716' => 'lake',      '717' => 'plains',
        '721' => 'mountains', '722' => 'plains',    '723' => 'farmland',  '724' => 'forest',
        '725' => 'plains',    '726' => 'suburbs',   '727' => 'lake',
    ];

    /** Space code for a tile/face/position, e.g. spaceCode(3, 1, 4) === '314'. */
    public static function spaceCode(int $tileId, int $face, int $position): string
    {
        return (string) ($tileId * 100 + $face * 10 + $position);
    }

    /** The terrain printed on a given space. */
    public static function spaceTerrain(int $tileId, int $face, int $position): string
    {
        return self::TERRAIN_BY_SPACE[self::spaceCode($tileId, $face, $position)];
    }

    /**
     * Where a local position lands, as an axial OFFSET from its tile's centre, once the tile has
     * been rotated.
     *
     * Rotation is in 60-degree steps clockwise, 0..5. It shifts the ring only: at rotation 1
     * whatever was printed at position 2 sits where position 3 was. The centre never moves.
     *
     * @return array [q, r] offset
     */
    public static function positionOffset(int $position, int $rotation): array
    {
        if ($position === self::POS_CENTRE) {
            return [0, 0];
        }
        $index = (($position - 2) + $rotation) % 6;
        return self::RING_CW[$index];
    }

    /**
     * The absolute axial coordinate of a space: its tile's slot centre plus its rotated offset.
     *
     * @return array [q, r]
     */
    public static function spaceAxial(int $slot, int $position, int $rotation): array
    {
        [$cq, $cr] = self::TILE_SLOTS[$slot];
        [$dq, $dr] = self::positionOffset($position, $rotation);
        return [$cq + $dq, $cr + $dr];
    }

    /**
     * Roll a random map: every tile gets a random face and rotation, The Big City tile takes the
     * centre slot, and the other six are shuffled around it (rulebook Game Setup step 2).
     *
     * Uses bga_rand() rather than PHP's rand()/random_int() — it is the framework's instrumented RNG
     * and the one BGA can reproduce when replaying a game from a bug report.
     *
     * @return array list of ['tile' => int, 'face' => int, 'rotation' => int, 'slot' => int]
     */
    public static function rollTiles(): array
    {
        $outer = array_values(array_diff(self::TILES, [self::BIG_CITY_TILE]));
        shuffle($outer);

        $placed = [self::BIG_CITY_TILE => 0];
        foreach ($outer as $i => $tileId) {
            $placed[$tileId] = $i + 1;
        }

        $out = [];
        foreach (self::TILES as $tileId) {
            $out[] = [
                'tile'     => $tileId,
                'face'     => self::FACES[bga_rand(0, 1)],
                'rotation' => bga_rand(0, 5),
                'slot'     => $placed[$tileId],
            ];
        }
        return $out;
    }

    /**
     * Expand placed tiles into the 49 board spaces.
     *
     * @param array $tiles as returned by rollTiles()
     * @return array list of ['q','r','terrain','tile','face','position','space']
     */
    public static function expandTiles(array $tiles): array
    {
        $out = [];
        foreach ($tiles as $t) {
            foreach (self::POSITIONS as $position) {
                [$q, $r] = self::spaceAxial($t['slot'], $position, $t['rotation']);
                $out[] = [
                    'q'        => $q,
                    'r'        => $r,
                    'terrain'  => self::spaceTerrain($t['tile'], $t['face'], $position),
                    'tile'     => $t['tile'],
                    'face'     => $t['face'],
                    'position' => $position,
                    'space'    => self::spaceCode($t['tile'], $t['face'], $position),
                ];
            }
        }
        return $out;
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
