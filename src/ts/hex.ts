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

// ── Map frames ────────────────────────────────────────────────────────────────────────────────
//
// The frames are not trim laid around the outside of the map: they are the rest of the board. Map
// tiles plus frames make ONE large hexagon — see either setup diagram on the rulebook's Quick
// Reference page. That pins the geometry down completely, so none of the shape below is invented:
//
//   inner edge  the exact outline of the 49 hex spaces, so a frame hugs the tiles with no gap;
//   corners     the six points where the map reaches furthest from the centre are the outward
//               corner of each outer tile, and a board-hexagon corner sits on each of them;
//   joints      the six notches between adjacent outer tiles, where the outline dips closest to
//               the centre. Cutting the ring there leaves each frame cupping exactly one outer
//               tile, which is what the rules need (Material::FRAME_PERIMETER_CW).
//
// Points are in units of one hex WIDTH from the centre of the map, on the same axes the stylesheet
// lays hexes out on: x runs with (q + r/2), y with (sqrt(3)/2) * r.

export interface Point {
    x: number;
    y: number;
}

/** The outer tile slots, the ones that carry a frame. Slot 0 — The Big City — does not. */
export const FRAME_SLOTS: readonly number[] = [1, 2, 3, 4, 5, 6];

const SQRT3_2 = Math.sqrt(3) / 2;

/** Centre of a hex, in board units. */
export const hexPoint = (h: Hex): Point => ({ x: h.q + h.r / 2, y: SQRT3_2 * h.r });

/** Board units back to the (column, row) pair the stylesheet positions by. See _hex.scss. */
export const pointCell = (p: Point): { col: number; row: number } => ({ col: p.x, row: p.y / SQRT3_2 });

const norm = (p: Point): number => Math.hypot(p.x, p.y);
const scaleTo = (p: Point, r: number): Point => ({ x: (p.x * r) / norm(p), y: (p.y * r) / norm(p) });
const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const bearing = (p: Point): number => Math.atan2(p.y, p.x);

/**
 * Distance from the map centre to a corner of the board hexagon, in hex widths.
 *
 * The map itself reaches 4.163, and below 4.484 the hexagon would slice a corner off an outer tile,
 * so that is the floor. The published board sits near 5.1 — measured off the rulebook's setup
 * diagram — which is a border between half and one hex wide. Raise it to widen the frames; the map
 * does not move.
 */
export const BOARD_RADIUS = 5.1;

/** The six corners of a hex as offsets from its centre, clockwise from the top. */
const HEX_CORNERS: readonly Point[] = [0, 1, 2, 3, 4, 5].map((i) => {
    const a = (Math.PI / 180) * (-90 + 60 * i);
    return { x: Math.cos(a) / Math.sqrt(3), y: Math.sin(a) / Math.sqrt(3) };
});

/** The two corners either side of the edge a hex shares with its neighbour across DIRECTIONS[d]. */
const edgeCorners = (d: number): [number, number] => [(7 - d) % 6, (8 - d) % 6];

let outline: Point[] | null = null;

/**
 * The outline of the 49 map spaces as a closed ring of points, running clockwise on screen.
 *
 * Derived from TILE_SLOTS rather than listed out, so it cannot drift out of step with the map. Tile
 * faces and rotations do not affect it: they permute which space lands on a hex, never which hexes
 * exist.
 */
export function mapOutline(): Point[] {
    if (outline) return outline;

    const cells = new Set(TILE_SLOTS.flatMap((slot) => flower(slot)).map(hexKey));
    const key = (p: Point): string => `${p.x.toFixed(4)},${p.y.toFixed(4)}`;
    const points = new Map<string, Point>();
    const links = new Map<string, string[]>();

    for (const cell of cells) {
        const h = parseHexKey(cell);
        const c = hexPoint(h);
        for (let d = 0; d < 6; d++) {
            if (cells.has(hexKey(neighbor(h, d)))) continue;
            const ends = edgeCorners(d).map((i) => ({
                x: c.x + HEX_CORNERS[i].x,
                y: c.y + HEX_CORNERS[i].y,
            }));
            const keys = ends.map(key);
            ends.forEach((p, i) => points.set(keys[i], p));
            links.set(keys[0], [...(links.get(keys[0]) ?? []), keys[1]]);
            links.set(keys[1], [...(links.get(keys[1]) ?? []), keys[0]]);
        }
    }

    // Every boundary vertex joins exactly two boundary edges, so the walk is never ambiguous.
    const start = links.keys().next().value as string;
    const ring = [start];
    let prev = '';
    let cur = start;
    for (;;) {
        const step = links.get(cur)!.find((k) => k !== prev)!;
        if (step === start) break;
        ring.push(step);
        prev = cur;
        cur = step;
    }

    const walk = ring.map((k) => points.get(k)!);
    // Shoelace. y grows downward, so a positive signed area means the walk is already clockwise.
    const area = walk.reduce((sum, p, i) => {
        const q = walk[(i + 1) % walk.length];
        return sum + (p.x * q.y - q.x * p.y);
    }, 0);
    outline = area > 0 ? walk : walk.reverse();
    return outline;
}

/** Indices into mapOutline() of the points furthest from ('max') or nearest to ('min') the centre. */
function extremes(pick: 'max' | 'min'): number[] {
    const radii = mapOutline().map(norm);
    const target = pick === 'max' ? Math.max(...radii) : Math.min(...radii);
    return radii.flatMap((r, i) => (Math.abs(r - target) < 1e-9 ? [i] : []));
}

/** Which outline tip belongs to a slot: the one lying in that tile's direction from the centre. */
function tipForSlot(slot: number): number {
    const ring = mapOutline();
    const aim = bearing(hexPoint(TILE_SLOTS[slot]));
    const off = (i: number): number => {
        const d = Math.abs(bearing(ring[i]) - aim) % (2 * Math.PI);
        return Math.min(d, 2 * Math.PI - d);
    };
    return extremes('max').reduce((best, i) => (off(i) < off(best) ? i : best));
}

/**
 * One frame piece as a closed polygon, clockwise, in board units.
 *
 * A chevron: its point is a corner of the board hexagon, sitting over the outward corner of the tile
 * it cups; its two outer edges run from there to the middle of the hexagon side either way; and its
 * inner edge is the map outline itself, from one flanking notch to the other. Neighbouring pieces
 * meet along the notch-to-side-middle cut, so the six tile the ring with no overlap and no seam.
 */
export function frameOutline(slot: number): Point[] {
    const ring = mapOutline();
    const tips = extremes('max');
    const notches = extremes('min');
    const tip = tipForSlot(slot);
    const at = tips.indexOf(tip);

    const corner = (i: number): Point => scaleTo(ring[tips[(i + tips.length) % tips.length]], BOARD_RADIUS);
    const ahead = (i: number): number => (i - tip + ring.length) % ring.length;
    const behind = (i: number): number => (tip - i + ring.length) % ring.length;
    const next = notches.reduce((b, i) => (ahead(i) < ahead(b) ? i : b));
    const back = notches.reduce((b, i) => (behind(i) < behind(b) ? i : b));

    const poly = [mid(corner(at - 1), corner(at)), corner(at), mid(corner(at), corner(at + 1))];
    for (let i = next; ; i = (i - 1 + ring.length) % ring.length) {
        poly.push(ring[i]);
        if (i === back) break;
    }
    return poly;
}

/** Where a blocked company's disc parks: out on the frame's own corner, well clear of the map. */
export const frameHome = (slot: number): Point => {
    const tip = mapOutline()[tipForSlot(slot)];
    return scaleTo(tip, (norm(tip) + BOARD_RADIUS) / 2);
};

/** The box the whole ring occupies — fixed geometry, the same whichever frames a game deals out. */
export function frameRingBounds(): { min: Point; max: Point } {
    const all = FRAME_SLOTS.flatMap((slot) => frameOutline(slot));
    const xs = all.map((p) => p.x);
    const ys = all.map((p) => p.y);
    return {
        min: { x: Math.min(...xs), y: Math.min(...ys) },
        max: { x: Math.max(...xs), y: Math.max(...ys) },
    };
}
