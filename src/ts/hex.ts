/**
 * Hex coordinate maths — axial coordinates, pointy-top orientation.
 *
 * WHY AXIAL: the abandoned reference implementation stored hexes as `mr_hex_<row>_<col>` offset
 * coordinates and needed two separate neighbour tables, one for even rows and one for odd, because
 * the direction deltas change with row parity. Axial coordinates need a single table and convert to
 * cube coordinates for distance in two lines. There is no parity special case to get wrong.
 *
 * Axial (q, r) maps to cube (x, y, z) as x = q, z = r, y = -x - z.
 */

export interface Hex {
    q: number;
    r: number;
}

/** The six neighbour directions, in a fixed order. Edge index 0..5 is stable and safe to persist. */
export const DIRECTIONS: readonly Hex[] = [
    { q: +1, r: 0 },  // 0 E
    { q: +1, r: -1 }, // 1 NE
    { q: 0, r: -1 },  // 2 NW
    { q: -1, r: 0 },  // 3 W
    { q: -1, r: +1 }, // 4 SW
    { q: 0, r: +1 },  // 5 SE
];

export const hexKey = (h: Hex): string => `${h.q},${h.r}`;

export function parseHexKey(key: string): Hex {
    const [q, r] = key.split(',').map(Number);
    return { q, r };
}

export const hexEquals = (a: Hex, b: Hex): boolean => a.q === b.q && a.r === b.r;

export const hexAdd = (a: Hex, b: Hex): Hex => ({ q: a.q + b.q, r: a.r + b.r });

/** Neighbour across a given edge (0..5). */
export function neighbor(h: Hex, edge: number): Hex {
    const dir = DIRECTIONS[((edge % 6) + 6) % 6];
    return hexAdd(h, dir);
}

/** All six neighbours, in edge order. */
export const neighbors = (h: Hex): Hex[] => DIRECTIONS.map((d) => hexAdd(h, d));

/** Distance in hex steps. */
export function distance(a: Hex, b: Hex): number {
    const dq = a.q - b.q;
    const dr = a.r - b.r;
    return (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2;
}

/** Every hex within `radius` steps of `center`, centre included. */
export function hexesInRange(center: Hex, radius: number): Hex[] {
    const out: Hex[] = [];
    for (let dq = -radius; dq <= radius; dq++) {
        const lo = Math.max(-radius, -dq - radius);
        const hi = Math.min(radius, -dq + radius);
        for (let dr = lo; dr <= hi; dr++) out.push({ q: center.q + dq, r: center.r + dr });
    }
    return out;
}

/**
 * A "flower": a hex and its six neighbours — the shape of one map TILE.
 */
export const flower = (center: Hex): Hex[] => hexesInRange(center, 1);

// ── Map tiles ─────────────────────────────────────────────────────────────────────────────────
//
// A map tile is a hexagonal TILE carrying 7 hex SPACES: a centre plus a ring of six. Seven tiles
// laid out as a flower-of-flowers give the 49-space board. Confirmed from the publisher tile scans
// (../../_reference/minirails/img/wheel_*.png), which are labelled with the rulebook's own tile ids.
//
// EVERYTHING BELOW MIRRORS modules/php/Material.php. The server is the authority — this exists so
// the client can place a tile image without a round trip. Keep the two in step.

/** Side A / side B. A tile is flipped 50/50 at setup; the faces carry different space layouts. */
export type Face = 1 | 2;

/** A tile as laid out for this game. */
export interface PlacedTile {
    tile: number;      // 1..7, the printed tile number. 1 is The Big City tile.
    face: Face;        // 1 = A, 2 = B
    rotation: number;  // 0..5, 60-degree steps clockwise
    slot: number;      // 0 = centre, 1..6 clockwise from the top
}

/** The Big City tile always occupies the centre slot (rulebook Game Setup step 2). */
export const BIG_CITY_TILE = 1;

/** Local position 1 is a tile's centre space; 2..7 are its ring. */
export const POS_CENTRE = 1;
export const POSITIONS: readonly number[] = [1, 2, 3, 4, 5, 6, 7];

/**
 * The ring directions, CLOCKWISE FROM NE — the order local positions 2..7 run in at rotation 0.
 *
 *          ( 7 )   ( 2 )
 *       ( 6 )   ( 1 )   ( 3 )
 *          ( 5 )   ( 4 )
 *
 * NOT the same order as DIRECTIONS above, which is counter-clockwise from E and is used for
 * adjacency. This one is the printed position numbering; they are different jobs.
 */
export const RING_CW: readonly Hex[] = [
    { q: +1, r: -1 }, // NE
    { q: +1, r: 0 },  // E
    { q: 0, r: +1 },  // SE
    { q: -1, r: +1 }, // SW
    { q: -1, r: 0 },  // W
    { q: 0, r: -1 },  // NW
];

/**
 * Where each of the 7 tile slots sits, as the axial coordinate of that tile's CENTRE space.
 * Slot 0 is the middle; slots 1..6 run clockwise from the top.
 *
 * Tile centres are 3 apart, not 2. At distance 2 a space would be adjacent to two tile centres and
 * the tiles overlap, collapsing 49 spaces to 31. Distance 3 tiles exactly — verified exhaustively
 * across all 6^7 rotation combinations as 49 unique spaces, 0 collisions.
 */
export const TILE_SLOTS: readonly Hex[] = [
    { q: 0, r: 0 },   // 0 centre
    { q: +2, r: -3 }, // 1 N
    { q: +3, r: -1 }, // 2 NE
    { q: +1, r: +2 }, // 3 SE
    { q: -2, r: +3 }, // 4 S
    { q: -3, r: +1 }, // 5 SW
    { q: -1, r: -2 }, // 6 NW
];

/**
 * Where a local position lands, as an axial OFFSET from its tile's centre, once rotated.
 * Rotation shifts the ring only — the centre space never moves.
 */
export function positionOffset(position: number, rotation: number): Hex {
    if (position === POS_CENTRE) return { q: 0, r: 0 };
    return RING_CW[(position - 2 + rotation) % 6];
}

/** The absolute axial coordinate of a space. */
export function spaceAxial(slot: number, position: number, rotation: number): Hex {
    return hexAdd(TILE_SLOTS[slot], positionOffset(position, rotation));
}

/** The printed space id: tile*100 + face*10 + position. '314' = tile 3, side A, position 4. */
export const spaceCode = (tile: number, face: number, position: number): string =>
    String(tile * 100 + face * 10 + position);

export interface MapSpace {
    hex: Hex;
    tile: number;
    face: Face;
    position: number;
    space: string;
}

/** Expand placed tiles into the 49 board spaces. Mirrors Material::expandTiles(). */
export function expandTiles(tiles: PlacedTile[]): MapSpace[] {
    const out: MapSpace[] = [];
    for (const t of tiles) {
        for (const position of POSITIONS) {
            out.push({
                hex: spaceAxial(t.slot, position, t.rotation),
                tile: t.tile,
                face: t.face,
                position,
                space: spaceCode(t.tile, t.face, position),
            });
        }
    }
    return out;
}

/** Roll a random tile layout. Client-side only — for the preview; a table uses the server's. */
export function rollTiles(rand: () => number = Math.random): PlacedTile[] {
    const outer = [1, 2, 3, 4, 5, 6, 7].filter((t) => t !== BIG_CITY_TILE);
    for (let i = outer.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [outer[i], outer[j]] = [outer[j], outer[i]];
    }
    const slotOf = new Map<number, number>([[BIG_CITY_TILE, 0]]);
    outer.forEach((t, i) => slotOf.set(t, i + 1));

    return [1, 2, 3, 4, 5, 6, 7].map((tile) => ({
        tile,
        face: (rand() < 0.5 ? 1 : 2) as Face,
        rotation: Math.floor(rand() * 6),
        slot: slotOf.get(tile)!,
    }));
}

/** Axial -> CSS custom properties. Pixel arithmetic lives in _hex.scss, not here. */
export const hexStyleVars = (h: Hex): string => `--mr-q:${h.q};--mr-r:${h.r}`;
