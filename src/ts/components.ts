/**
 * Placeholder component builders — pure DOM, no BGA dependencies.
 *
 * Deliberately importable outside a BGA table so scripts/preview/ can render the whole component set
 * in a plain browser. Nothing here may import from libs.ts, Game.ts or touch a global BGA object.
 *
 * ⚠️ Every component draws itself with CSS shapes because no art exists yet. See src/scss/Game.scss
 * for the intended swap when art arrives.
 */

import { Hex, hexKey, hexStyleVars } from './hex';

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
    node.setAttribute(
        'aria-label',
        `${TERRAIN_LABEL[terrain]} ${signed(TERRAIN_VALUE[terrain])}${disc ? `, ${disc} track` : ''}`,
    );
    return node;
}

/**
 * Renders the board and sizes its container from the axial extent, so the caller never computes
 * pixels. Keep the arithmetic here consistent with the left/top rules in _hex.scss.
 */
export function renderHexBoard(specs: HexSpec[]): HTMLElement {
    const board = el('div', 'mr-hex-board');
    if (!specs.length) return board;

    const cols = specs.map((s) => s.hex.q + s.hex.r / 2);
    const rows = specs.map((s) => s.hex.r);
    const minCol = Math.min(...cols);
    const minRow = Math.min(...rows);

    for (const spec of specs) {
        // Normalise so the top-left hex sits at 0,0 without negative offsets.
        const shifted: HexSpec = {
            ...spec,
            hex: { q: spec.hex.q - Math.round(minCol) - Math.round(minRow) / 2, r: spec.hex.r - minRow },
        };
        board.appendChild(renderHex(shifted));
    }

    const width = Math.max(...cols) - minCol + 1;
    const height = Math.max(...rows) - minRow + 1;
    board.style.width = `calc((var(--mr-hex-w) + var(--mr-hex-gap)) * ${width + 0.5})`;
    board.style.height = `calc((var(--mr-hex-h) + var(--mr-hex-gap)) * (0.75 * ${height} + 0.25))`;
    return board;
}

/** A company frame — where a blocked company's disc goes, for -1. */
export function renderFrame(company: Company, discs: Company[] = []): HTMLElement {
    const f = el('div', `mr-frame mr-frame--${company}`);
    f.dataset.company = company;
    f.setAttribute('aria-label', `${company} company frame, ${discs.length} discs`);
    if (discs.length) f.appendChild(renderDisc(company, 'on-hex'));
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
