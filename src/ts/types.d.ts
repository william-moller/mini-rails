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

interface MrHex {
    hex_id: Num;
    id: Num;
    q: Num;
    r: Num;
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

interface PlayerTurnArgs {
    round: Num;
    trackLength: Num;
}
