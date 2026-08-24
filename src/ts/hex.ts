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
 * A "flower": a hex and its six neighbours. The reference project's map artwork shows exactly this
 * shape — a centre hex ringed by six — with The Big City at the middle.
 */
export const flower = (center: Hex): Hex[] => hexesInRange(center, 1);

/**
 * ⚠️ PROVISIONAL MAP SHAPE — not confirmed against the rules or art.
 *
 * The rulebook lists 7 map tiles with The Big City at the centre and six around it, but does not say
 * whether a "map tile" is ONE hex or a flower of seven. Seven single hexes cannot absorb the 60-72
 * discs the game uses, so a flower-of-flowers (7 tiles x 7 hexes = 49) is the reading that fits the
 * component counts. It remains a guess until the art files settle it.
 *
 * Keep this as the ONLY place the map shape is defined so replacing it is a one-function change.
 */
export function provisionalMap(): Hex[] {
    const seen = new Set<string>();
    const out: Hex[] = [];
    // Flower centres must be 3 steps apart, not 2. At distance 2 a hex can be adjacent to BOTH
    // centres, so the flowers overlap: 7 x 7 collapsed to 31 unique hexes with 18 collisions when
    // this was first written. Distance 3 is the "aperture 7" / spiral-honeycomb arrangement and
    // tiles exactly — verified as 49 unique hexes, 0 overlaps.
    const tileCentres: Hex[] = [
        { q: 0, r: 0 },
        { q: +1, r: +2 }, { q: +3, r: -1 }, { q: +2, r: -3 },
        { q: -1, r: -2 }, { q: -3, r: +1 }, { q: -2, r: +3 },
    ];
    for (const c of tileCentres) {
        for (const h of flower(c)) {
            const k = hexKey(h);
            if (!seen.has(k)) { seen.add(k); out.push(h); }
        }
    }
    return out;
}

/** Axial -> CSS custom properties. Pixel arithmetic lives in _hex.scss, not here. */
export const hexStyleVars = (h: Hex): string => `--mr-q:${h.q};--mr-r:${h.r}`;
