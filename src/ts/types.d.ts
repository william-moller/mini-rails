/**
 * Types for the data getAllDatas() sends to the client.
 *
 * ⚠️ BGA returns SQL columns as strings. Every numeric field below is typed `number | string` and must
 * go through Number() before use — a silent string coordinate would place hexes at NaN and the board
 * would simply not draw.
 */

type Num = number | string;

interface minirailsmospinachPlayer extends Player {
    name: string;
    color: string;
    /** Action tiles: 1 once spent this round, 0 while still available. */
    buySpent: Num;
    buildSpent: Num;
}

/** A map tile as laid out for this game — the physical component behind 7 of the 49 hexes. */
interface MrTile {
    /** 1..7, the printed tile number. 1 is The Big City tile. */
    tile: Num;
    /** 1 = side A, 2 = side B. Flipped 50/50 at setup; the faces carry different space layouts. */
    face: Num;
    /** 0..5, in 60-degree steps clockwise. Shifts the tile's ring; its centre never moves. */
    rotation: Num;
    /** 0 = centre of the board, 1..6 clockwise from the top. */
    slot: Num;
}

interface MrHex {
    hex_id: Num;
    id: Num;
    q: Num;
    r: Num;
    /** Which tile this space belongs to. */
    tile: Num;
    /** 1..7, the space's local position on its tile. 1 is the centre, 2..7 the ring. */
    position: Num;
    /** Printed space id, tile*100 + face*10 + position. '314' = tile 3, side A, position 4. */
    space: string;
    terrain: string;
    /** Company whose starting discs seeded this hex, else null. */
    is_start_for: string | null;
}

interface MrMarker {
    id: Num;
    player_id: Num;
    track: 'order' | 'market';
    slot: Num;
}

interface MrDisc {
    id: Num;
    company: string;
    /** market -> slot, hex -> hex_id, taxed -> slot, frame -> 0 */
    arg: Num;
}

interface MrStock {
    id: Num;
    company: string;
    player: Num;
    /** The stock's own current value, -10..+10. Each stock carries its own. */
    value: Num;
}

interface MrDiscs {
    market: MrDisc[];
    hex: MrDisc[];
    frame: MrDisc[];
    taxed: MrDisc[];
    stocks: MrStock[];
}

interface minirailsmospinachGamedatas extends Gamedatas<minirailsmospinachPlayer> {
    /** The 7 map tiles as placed this game. `hexes` is their expansion. */
    tiles: MrTile[];
    /** slot index -> [q, r] of that slot's centre space. */
    tileSlots: Record<string, [Num, Num]>;
    hexes: MrHex[];
    markers: MrMarker[];
    discs: MrDiscs;
    /** Discs still in the bag — counted only; their colours are hidden information. */
    bagCount: Num;
    round: Num;
    roundsTotal: Num;
    /** 2 * players + 1. Both the market and order tracks are this long. */
    trackLength: Num;
    companies: string[];
    terrainValue: Record<string, Num>;
    profitMin: Num;
    profitMax: Num;
}

/** A disc still available on the market track this turn. */
interface MrMarketDisc {
    id: Num;
    company: string;
    slot: Num;
}

interface PlayerTurnArgs {
    round: Num;
    trackLength: Num;
    /** Action tiles the active player still holds. Each must be spent exactly once per round. */
    canBuy: boolean;
    canBuild: boolean;
    /** Discs whose slot has not yet been taken by a marker. */
    market: MrMarketDisc[];
    /** company -> hex_ids that company may legally build on. */
    legalHexes: Record<string, Num[]>;
    /** company -> true when it has nowhere legal to build, so its disc goes on the frame for -1. */
    blocked: Record<string, boolean>;
}
