/**
 * Placeholder component builders — pure DOM, no BGA dependencies.
 *
 * Deliberately importable outside a BGA table so scripts/preview/ can render the whole component set
 * in a plain browser. Nothing here may import from libs.ts, Game.ts or touch a global BGA object.
 *
 * ⚠️ Every component draws itself with CSS shapes because no art exists yet. See src/scss/Game.scss
 * for the intended swap when art arrives.
 */

import {
    Hex,
    Point,
    frameHome,
    frameOutline,
    frameRingBounds,
    hexKey,
    hexPoint,
    hexStyleVars,
    pointCell,
} from './hex';

export type Company = 'red' | 'white' | 'tan' | 'blue' | 'yellow' | 'gray';
export type Terrain = 'big-city' | 'suburbs' | 'farmland' | 'plains' | 'forest' | 'lake' | 'mountains';

export const COMPANIES: readonly Company[] = ['red', 'white', 'tan', 'blue', 'yellow', 'gray'];

/**
 * Printed hex values, from the rulebook (see .claude/game-rules.md). The server is the authority once
 * it exists; this table is for rendering the number on a placeholder hex.
 */
export const TERRAIN_VALUE: Readonly<Record<Terrain, number>> = {
    'big-city': 5,
    suburbs: 3,
    farmland: 2,
    plains: 1,
    forest: -1,
    lake: -2,
    mountains: -3,
};

export const TERRAIN_LABEL: Readonly<Record<Terrain, string>> = {
    'big-city': 'Big City',
    suburbs: 'Suburbs',
    farmland: 'Farmland',
    plains: 'Plains',
    forest: 'Forest',
    lake: 'Lake',
    mountains: 'Mountains',
};

/** Profit Board extent. Rulebook FAQ Q2: stocks cannot move past these. */
export const PROFIT_MIN = -10;
export const PROFIT_MAX = 10;

function el(tag: string, className?: string, text?: string): HTMLElement {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

const signed = (n: number): string => (n > 0 ? `+${n}` : `${n}`);

// ── Discs, markers, action tiles ──────────────────────────────────────────────────────────────

export function renderDisc(company: Company, variant?: 'sm' | 'on-hex'): HTMLElement {
    const d = el('div', `mr-disc mr-disc--${company}${variant ? ` mr-disc--${variant}` : ''}`);
    d.dataset.company = company;
    d.setAttribute('aria-label', `${company} company disc`);
    return d;
}

/** Player colour comes from BGA at runtime, so it is passed in rather than shipped as a palette. */
export function renderMarker(playerColor: string, playerName?: string): HTMLElement {
    const m = el('div', 'mr-marker');
    m.style.setProperty('--mr-player', playerColor.startsWith('#') ? playerColor : `#${playerColor}`);
    if (playerName) m.setAttribute('aria-label', `${playerName} order marker`);
    return m;
}

export function renderActionTile(kind: 'buy' | 'build', spent = false): HTMLElement {
    const t = el('div', `mr-action-tile${spent ? ' is-spent' : ''}`, kind === 'buy' ? 'Buy' : 'Build');
    t.dataset.action = kind;
    return t;
}

// ── Hex map ───────────────────────────────────────────────────────────────────────────────────

export interface HexSpec {
    hex: Hex;
    terrain: Terrain;
    /** Company disc built here, if any. */
    disc?: Company;
    /** Which tile this space belongs to, and where on it — see src/ts/hex.ts. */
    tile?: number;
    position?: number;
    /** Printed space id, e.g. '314'. */
    space?: string;
    /** Server hex_id. The key actions address a hex by, so it must reach the DOM. */
    hexId?: number;
    /** Company whose frame arrow marks this hex as a starting hex, if any. */
    startFor?: Company;
}

/**
 * One of the 6 Map Frames, drawn in the ring around the board.
 *
 * A frame is not on a hex: it is a piece of the board itself, the wedge between the map's outline
 * and the outer hexagon. All of that geometry follows from the slot, so the slot is all this carries
 * — see frameOutline() in src/ts/hex.ts.
 */
export interface FrameSpec {
    company: Company;
    /** 1..6, the outer tile slot this frame cups. Fixes both the piece's shape and where it sits. */
    slot: number;
    /** How many of this company's discs are parked here, blocked off the map. */
    discs: number;
}

export function renderHex(spec: HexSpec): HTMLElement {
    const { hex, terrain, disc } = spec;
    const node = el('div', `mr-hex mr-hex--${terrain}${disc ? ' is-occupied' : ''}`);
    node.setAttribute('style', hexStyleVars(hex));
    node.dataset.hex = hexKey(hex);
    node.dataset.terrain = terrain;
    // The space's printed identity, kept on the element so a tile can be inspected on a live table
    // without a server round trip.
    if (spec.tile !== undefined) node.dataset.tile = String(spec.tile);
    if (spec.position !== undefined) node.dataset.position = String(spec.position);
    if (spec.space !== undefined) node.dataset.space = spec.space;
    if (spec.hexId !== undefined) node.dataset.hexId = String(spec.hexId);

    if (disc) {
        node.appendChild(renderDisc(disc, 'on-hex'));
    } else {
        node.appendChild(el('div', 'mr-hex__value', signed(TERRAIN_VALUE[terrain])));
        node.appendChild(el('div', 'mr-hex__name', TERRAIN_LABEL[terrain]));
    }
    // A hex one of the frame arrows points at. Drawn even once a disc covers it, so the opening
    // layout stays readable.
    if (spec.startFor) {
        node.classList.add('is-start');
        node.dataset.startFor = spec.startFor;
        node.appendChild(el('div', `mr-hex__start mr-hex__start--${spec.startFor}`));
    }
    node.setAttribute(
        'aria-label',
        `${TERRAIN_LABEL[terrain]} ${signed(TERRAIN_VALUE[terrain])}${disc ? `, ${disc} track` : ''}` +
            (spec.startFor ? `, ${spec.startFor} starting hex` : ''),
    );
    return node;
}

/**
 * Renders the board and sizes its container from the map extent, so the caller never computes
 * pixels. Keep the arithmetic here consistent with the left/top rules in _hex.scss.
 *
 * The frame ring is not an overlay on the map — map plus frames is one hexagonal board — so when
 * there are frames it is the RING that fixes the box, and the hexes are laid out inside it.
 */
export function renderHexBoard(specs: HexSpec[], frames: FrameSpec[] = []): HTMLElement {
    const board = el('div', 'mr-hex-board');
    if (!specs.length) return board;

    // Everything is measured as (column, row): column is q + r/2, row is r. A hex's left/top and the
    // ring's are both plain multiples of those, so one normalisation serves both.
    const ring = frames.length ? frameRingBounds() : null;
    const cells = specs.map((s) => pointCell(hexPoint(s.hex)));
    if (ring) cells.push(pointCell(ring.min), pointCell(ring.max));
    const minCol = Math.min(...cells.map((c) => c.col));
    const minRow = Math.min(...cells.map((c) => c.row));
    const cols = Math.max(...cells.map((c) => c.col)) - minCol;
    const rows = Math.max(...cells.map((c) => c.row)) - minRow;

    // Normalise so the top-left of the content sits at 0,0.
    //
    // NOT `q - round(minCol) - round(minRow)/2`. That rounding was harmless while every anchor was
    // an integer hex, but the ring bounds are fractional, and rounding then leaves the whole board
    // hundreds of pixels outside its own box. The CSS computes x from (q + r/2), so cancelling the
    // shifted r/2 back out is exact for any input.
    const shift = (h: Hex): Hex => {
        const r = h.r - minRow;
        return { q: h.q + h.r / 2 - minCol - r / 2, r };
    };

    // Ring first: the frames are UNDER the map, so the seam along the map's outline reads as tiles
    // sitting in the frame rather than the frame lapping over them.
    if (ring) board.appendChild(renderFrameRing(frames, ring, minCol, minRow));
    for (const spec of specs) {
        board.appendChild(renderHex({ ...spec, hex: shift(spec.hex) }));
    }

    // left/top place a hex's BOX; the extents above are hex CENTRES, half a hex further in. Hence
    // the extra whole hex of size — half a hex of margin at each end.
    board.style.width = `calc((var(--mr-hex-w) + var(--mr-hex-gap)) * ${cols} + var(--mr-hex-w))`;
    board.style.height = `calc((var(--mr-hex-h) + var(--mr-hex-gap)) * ${0.75 * rows} + var(--mr-hex-h))`;
    return board;
}

/**
 * The ring of six Map Frames: the company home edges, and where a company's disc goes when it is
 * blocked off the map entirely (for -1).
 *
 * One positioned box holds all six, and each frame clips a copy of that box down to its own
 * polygon. The box is placed and sized in hex units, so it tracks --mr-hex-w and the gap like
 * everything else; the polygons are then pure percentages of it, which is what keeps the ring locked
 * to the map at any board scale.
 */
function renderFrameRing(
    frames: FrameSpec[],
    bounds: { min: Point; max: Point },
    minCol: number,
    minRow: number,
): HTMLElement {
    const lo = pointCell(bounds.min);
    const hi = pointCell(bounds.max);
    const pct = (p: Point): string => {
        const c = pointCell(p);
        const x = (100 * (c.col - lo.col)) / (hi.col - lo.col);
        const y = (100 * (c.row - lo.row)) / (hi.row - lo.row);
        return `${x.toFixed(3)}% ${y.toFixed(3)}%`;
    };

    const ring = el('div', 'mr-frame-ring');
    ring.setAttribute(
        'style',
        `--mr-ring-col:${lo.col - minCol};--mr-ring-row:${lo.row - minRow};` +
            `--mr-ring-cols:${hi.col - lo.col};--mr-ring-rows:${hi.row - lo.row};`,
    );
    for (const frame of frames) ring.appendChild(renderFrame(frame, pct));
    return ring;
}

/**
 * One Map Frame — placeholder.
 *
 * The SHAPE is real: frameOutline() cuts the piece from the board hexagon along the map's own
 * outline, so it cups its tile exactly and butts against its neighbours. What is still a placeholder
 * is the surface — flat scenery tinted towards the company, with a ringed home spot on the frame's
 * corner in place of the printed arrows. The starting hexes those arrows point at carry their own
 * marker, so nothing is lost by leaving them off the piece.
 */
export function renderFrame(spec: FrameSpec, pct: (p: Point) => string): HTMLElement {
    const { company, slot, discs } = spec;
    const f = el('div', `mr-frame mr-frame--${company}`);
    f.dataset.company = company;
    f.dataset.slot = String(slot);
    f.setAttribute('aria-label', `${company} company frame${discs ? `, ${discs} blocked discs` : ''}`);

    const piece = el('div', 'mr-frame__piece');
    piece.style.clipPath = `polygon(${frameOutline(slot).map(pct).join(',')})`;
    f.appendChild(piece);

    const home = el('div', 'mr-frame__home');
    const [left, top] = pct(frameHome(slot)).split(' ');
    home.style.left = left;
    home.style.top = top;
    if (discs) home.appendChild(renderDisc(company, 'on-hex'));
    f.appendChild(home);
    return f;
}

// ── Central Market Board ──────────────────────────────────────────────────────────────────────

export type TrackSlot =
    | { kind: 'empty' }
    | { kind: 'disc'; company: Company }
    | { kind: 'marker'; color: string; name?: string };

export interface MarketBoardSpec {
    playerCount: number;
    /** Left-to-right turn order for this round. */
    orderTrack: TrackSlot[];
    /** Discs drawn this round, replaced by markers as players act. */
    marketTrack: TrackSlot[];
    /** One disc per completed round, up to 6. */
    taxed: (Company | null)[];
    /** Index into orderTrack whose turn it is. */
    currentIndex?: number;
}

/** Market and order tracks are both this long; exactly one disc is always left over to be taxed. */
export const trackLength = (playerCount: number): number => playerCount * 2 + 1;

function renderTrack(
    variant: 'order' | 'market' | 'taxed',
    label: string,
    slots: TrackSlot[],
    currentIndex?: number,
): HTMLElement {
    const track = el('div', `mr-track mr-track--${variant}`);
    track.appendChild(el('div', 'mr-track__label', label));
    const cells = el('div', 'mr-track__cells');

    slots.forEach((slot, i) => {
        const cell = el('div', `mr-cell${slot.kind === 'empty' ? ' is-empty' : ''}`);
        if (currentIndex === i) cell.classList.add('is-current');
        if (slot.kind === 'disc') cell.appendChild(renderDisc(slot.company));
        if (slot.kind === 'marker') cell.appendChild(renderMarker(slot.color, slot.name));
        cells.appendChild(cell);
    });

    track.appendChild(cells);
    return track;
}

export function renderMarketBoard(spec: MarketBoardSpec): HTMLElement {
    const board = el('div', 'mr-market');
    board.appendChild(renderTrack('order', 'Order track', spec.orderTrack, spec.currentIndex));
    board.appendChild(renderTrack('market', 'Market track', spec.marketTrack));
    board.appendChild(
        renderTrack(
            'taxed',
            'Taxed area',
            spec.taxed.map<TrackSlot>((c) => (c ? { kind: 'disc', company: c } : { kind: 'empty' })),
        ),
    );
    board.appendChild(
        el(
            'div',
            'mr-market__note',
            'At end of round the market track becomes next round’s order track.',
        ),
    );
    return board;
}

// ── Profit Board ──────────────────────────────────────────────────────────────────────────────

export interface Stock {
    company: Company;
    value: number;
    /** True if this stock would be discarded under current taxation status. Informational only. */
    doomed?: boolean;
}

export interface ProfitBoardSpec {
    playerName: string;
    playerColor: string;
    stocks: Stock[];
    buySpent?: boolean;
    buildSpent?: boolean;
}

export function renderProfitBoard(spec: ProfitBoardSpec): HTMLElement {
    const board = el('div', 'mr-profit-board');
    board.style.setProperty(
        '--mr-player',
        spec.playerColor.startsWith('#') ? spec.playerColor : `#${spec.playerColor}`,
    );

    const header = el('div', 'mr-profit-board__header');
    header.appendChild(el('div', 'mr-profit-board__name', spec.playerName));
    const actions = el('div', 'mr-profit-board__actions');
    actions.appendChild(renderActionTile('buy', spec.buySpent));
    actions.appendChild(renderActionTile('build', spec.buildSpent));
    header.appendChild(actions);
    board.appendChild(header);

    const track = el('div', 'mr-profit-track');
    for (let v = PROFIT_MIN; v <= PROFIT_MAX; v++) {
        const zone = v < 0 ? 'neg' : v > 0 ? 'pos' : 'zero';
        const isCap = v === PROFIT_MIN || v === PROFIT_MAX;
        const cell = el('div', `mr-profit-cell mr-profit-cell--${zone}${isCap ? ' mr-profit-cell--cap' : ''}`);
        cell.dataset.value = String(v);
        cell.appendChild(el('div', 'mr-profit-cell__value', signed(v)));
        for (const stock of spec.stocks.filter((s) => s.value === v)) {
            const disc = renderDisc(stock.company, 'sm');
            if (stock.doomed) disc.classList.add('is-doomed');
            cell.appendChild(disc);
        }
        track.appendChild(cell);
    }
    board.appendChild(track);
    return board;
}
