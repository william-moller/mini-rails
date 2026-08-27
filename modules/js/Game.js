/**
 *------
 * BGA framework: Gregory Isabelli & Emmanuel Colin & BoardGameArena
 * Mini Rails implementation : © Will Moller <will.moller@gmail.com>
 *
 * This code has been produced on the BGA studio platform for use on http://boardgamearena.com.
 * See http://en.boardgamearena.com/#!doc/Studio for more information.
 * -----
 *
 * GENERATED — do not edit. Built from src/ts by rollup (npm run build).
 */
/**
 * Client-side handler for the Action Phase.
 *
 * The turn is two clicks, sometimes three:
 *
 *   1. pick a disc still on the market track
 *   2. choose Buy Shares or Build Tracks — skipped when only one action tile is left, which is
 *      always the case on a player's second turn of the round
 *   3. for Build, pick a legal hex (or the company's frame, if it has nowhere to go)
 *
 * Legality is decided by the server and arrives in the state args; nothing here re-derives it. The
 * highlight classes (`is-selectable`) already exist in the SCSS.
 */
class PlayerTurn {
    constructor(game, bga) {
        this.game = game;
        this.bga = bga;
        this.args = null;
        this.selectedDiscId = null;
        /** Listeners attached this turn, torn down together on leaving the state. */
        this.cleanup = [];
    }
    onEnteringState(args, isCurrentPlayerActive) {
        this.args = args;
        this.selectedDiscId = null;
        if (!isCurrentPlayerActive) {
            this.bga.statusBar.setTitle(_('${actplayer} must take a disc from the market track'));
            return;
        }
        this.promptForDisc();
    }
    onLeavingState(_args, _isCurrentPlayerActive) {
        this.clearSelection();
        this.args = null;
    }
    // ── Step 1: choose a disc ─────────────────────────────────────────────────────────────────
    promptForDisc() {
        this.clearSelection();
        this.selectedDiscId = null;
        this.bga.statusBar.setTitle(_('${you} must take a disc from the market track'));
        for (const disc of this.args.market) {
            const cell = this.marketCell(Number(disc.slot));
            if (!cell)
                continue;
            cell.classList.add('is-selectable');
            this.on(cell, () => this.onDiscPicked(Number(disc.id)));
        }
    }
    onDiscPicked(discId) {
        this.selectedDiscId = discId;
        this.clearSelection();
        const { canBuy, canBuild } = this.args;
        if (canBuy && !canBuild)
            return this.chooseBuy();
        if (canBuild && !canBuy)
            return this.promptForHex();
        // First turn of the round: both tiles still in hand, so the player picks.
        this.bga.statusBar.setTitle(_('${you} must choose an action for this disc'));
        this.bga.statusBar.addActionButton(_('Buy Shares'), () => this.chooseBuy());
        this.bga.statusBar.addActionButton(_('Build Tracks'), () => this.promptForHex());
        this.bga.statusBar.addActionButton(_('Cancel'), () => this.promptForDisc(), { color: 'secondary' });
    }
    // ── Step 2a: Buy Shares ───────────────────────────────────────────────────────────────────
    chooseBuy() {
        this.clearSelection();
        this.bga.actions.performAction('actBuyShare', { discId: this.selectedDiscId });
    }
    // ── Step 2b: Build Tracks ─────────────────────────────────────────────────────────────────
    promptForHex() {
        this.clearSelection();
        const disc = this.args.market.find((d) => Number(d.id) === this.selectedDiscId);
        if (!disc)
            return this.promptForDisc();
        // A company with nowhere legal to build goes on its frame instead, for -1.
        if (this.args.blocked[disc.company]) {
            this.bga.statusBar.setTitle(_('${you} cannot build this company anywhere — place it on its frame for -1'));
            const frame = this.frameElement(disc.company);
            if (frame) {
                frame.classList.add('is-selectable');
                this.on(frame, () => this.build(0));
            }
            this.bga.statusBar.addActionButton(_('Place on frame'), () => this.build(0));
            this.bga.statusBar.addActionButton(_('Cancel'), () => this.promptForDisc(), { color: 'secondary' });
            return;
        }
        this.bga.statusBar.setTitle(_('${you} must choose a hex to build on'));
        for (const hexId of this.args.legalHexes[disc.company] ?? []) {
            const hex = this.hexElement(Number(hexId));
            if (!hex)
                continue;
            hex.classList.add('is-selectable');
            this.on(hex, () => this.build(Number(hexId)));
        }
        this.bga.statusBar.addActionButton(_('Cancel'), () => this.promptForDisc(), { color: 'secondary' });
    }
    build(hexId) {
        this.clearSelection();
        this.bga.actions.performAction('actBuildTrack', { discId: this.selectedDiscId, hexId });
    }
    // ── DOM plumbing ──────────────────────────────────────────────────────────────────────────
    root() {
        return this.bga.gameArea.getElement();
    }
    /** Market cells are addressed by slot; the track is rendered in slot order. */
    marketCell(slot) {
        const cells = this.root().querySelectorAll('.mr-track--market .mr-cell');
        return cells[slot] ?? null;
    }
    hexElement(hexId) {
        return this.root().querySelector(`.mr-hex[data-hex-id="${hexId}"]`);
    }
    frameElement(company) {
        return this.root().querySelector(`.mr-frame[data-company="${company}"]`);
    }
    on(el, handler) {
        const wrapped = (e) => {
            e.stopPropagation();
            handler();
        };
        el.addEventListener('click', wrapped);
        this.cleanup.push(() => el.removeEventListener('click', wrapped));
    }
    /** Drop every highlight and listener from the current step. */
    clearSelection() {
        for (const undo of this.cleanup)
            undo();
        this.cleanup = [];
        for (const el of this.root().querySelectorAll('.is-selectable')) {
            el.classList.remove('is-selectable');
        }
        this.bga.statusBar.removeActionButtons();
    }
}

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
/** The six neighbour directions, in a fixed order. Edge index 0..5 is stable and safe to persist. */
const DIRECTIONS = [
    { q: +1, r: 0 }, // 0 E
    { q: +1, r: -1 }, // 1 NE
    { q: 0, r: -1 }, // 2 NW
    { q: -1, r: 0 }, // 3 W
    { q: -1, r: +1 }, // 4 SW
    { q: 0, r: +1 }, // 5 SE
];
const hexKey = (h) => `${h.q},${h.r}`;
function parseHexKey(key) {
    const [q, r] = key.split(',').map(Number);
    return { q, r };
}
const hexEquals = (a, b) => a.q === b.q && a.r === b.r;
const hexAdd = (a, b) => ({ q: a.q + b.q, r: a.r + b.r });
/** Neighbour across a given edge (0..5). */
function neighbor(h, edge) {
    const dir = DIRECTIONS[((edge % 6) + 6) % 6];
    return hexAdd(h, dir);
}
/** All six neighbours, in edge order. */
const neighbors = (h) => DIRECTIONS.map((d) => hexAdd(h, d));
/** Distance in hex steps. */
function distance(a, b) {
    const dq = a.q - b.q;
    const dr = a.r - b.r;
    return (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2;
}
/** Every hex within `radius` steps of `center`, centre included. */
function hexesInRange(center, radius) {
    const out = [];
    for (let dq = -radius; dq <= radius; dq++) {
        const lo = Math.max(-radius, -dq - radius);
        const hi = Math.min(radius, -dq + radius);
        for (let dr = lo; dr <= hi; dr++)
            out.push({ q: center.q + dq, r: center.r + dr });
    }
    return out;
}
/**
 * A "flower": a hex and its six neighbours — the shape of one map TILE.
 */
const flower = (center) => hexesInRange(center, 1);
/** The Big City tile always occupies the centre slot (rulebook Game Setup step 2). */
const BIG_CITY_TILE = 1;
/** Local position 1 is a tile's centre space; 2..7 are its ring. */
const POS_CENTRE = 1;
const POSITIONS = [1, 2, 3, 4, 5, 6, 7];
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
const RING_CW = [
    { q: +1, r: -1 }, // NE
    { q: +1, r: 0 }, // E
    { q: 0, r: +1 }, // SE
    { q: -1, r: +1 }, // SW
    { q: -1, r: 0 }, // W
    { q: 0, r: -1 }, // NW
];
/**
 * Where each of the 7 tile slots sits, as the axial coordinate of that tile's CENTRE space.
 * Slot 0 is the middle; slots 1..6 run clockwise from the top.
 *
 * Tile centres are 3 apart, not 2. At distance 2 a space would be adjacent to two tile centres and
 * the tiles overlap, collapsing 49 spaces to 31. Distance 3 tiles exactly — verified exhaustively
 * across all 6^7 rotation combinations as 49 unique spaces, 0 collisions.
 */
const TILE_SLOTS = [
    { q: 0, r: 0 }, // 0 centre
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
function positionOffset(position, rotation) {
    if (position === POS_CENTRE)
        return { q: 0, r: 0 };
    return RING_CW[(position - 2 + rotation) % 6];
}
/** The absolute axial coordinate of a space. */
function spaceAxial(slot, position, rotation) {
    return hexAdd(TILE_SLOTS[slot], positionOffset(position, rotation));
}
/** The printed space id: tile*100 + face*10 + position. '314' = tile 3, side A, position 4. */
const spaceCode = (tile, face, position) => String(tile * 100 + face * 10 + position);
/** Expand placed tiles into the 49 board spaces. Mirrors Material::expandTiles(). */
function expandTiles(tiles) {
    const out = [];
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
function rollTiles(rand = Math.random) {
    const outer = [1, 2, 3, 4, 5, 6, 7].filter((t) => t !== BIG_CITY_TILE);
    for (let i = outer.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [outer[i], outer[j]] = [outer[j], outer[i]];
    }
    const slotOf = new Map([[BIG_CITY_TILE, 0]]);
    outer.forEach((t, i) => slotOf.set(t, i + 1));
    return [1, 2, 3, 4, 5, 6, 7].map((tile) => ({
        tile,
        face: (rand() < 0.5 ? 1 : 2),
        rotation: Math.floor(rand() * 6),
        slot: slotOf.get(tile),
    }));
}
/** Axial -> CSS custom properties. Pixel arithmetic lives in _hex.scss, not here. */
const hexStyleVars = (h) => `--mr-q:${h.q};--mr-r:${h.r}`;

/**
 * Placeholder component builders — pure DOM, no BGA dependencies.
 *
 * Deliberately importable outside a BGA table so scripts/preview/ can render the whole component set
 * in a plain browser. Nothing here may import from libs.ts, Game.ts or touch a global BGA object.
 *
 * ⚠️ Every component draws itself with CSS shapes because no art exists yet. See src/scss/Game.scss
 * for the intended swap when art arrives.
 */
const COMPANIES = ['red', 'white', 'tan', 'blue', 'yellow', 'gray'];
/**
 * Printed hex values, from the rulebook (see .claude/game-rules.md). The server is the authority once
 * it exists; this table is for rendering the number on a placeholder hex.
 */
const TERRAIN_VALUE = {
    'big-city': 5,
    suburbs: 3,
    farmland: 2,
    plains: 1,
    forest: -1,
    lake: -2,
    mountains: -3,
};
const TERRAIN_LABEL = {
    'big-city': 'Big City',
    suburbs: 'Suburbs',
    farmland: 'Farmland',
    plains: 'Plains',
    forest: 'Forest',
    lake: 'Lake',
    mountains: 'Mountains',
};
/** Profit Board extent. Rulebook FAQ Q2: stocks cannot move past these. */
const PROFIT_MIN = -10;
const PROFIT_MAX = 10;
function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className)
        node.className = className;
    if (text !== undefined)
        node.textContent = text;
    return node;
}
const signed = (n) => (n > 0 ? `+${n}` : `${n}`);
// ── Discs, markers, action tiles ──────────────────────────────────────────────────────────────
function renderDisc(company, variant) {
    const d = el('div', `mr-disc mr-disc--${company}${variant ? ` mr-disc--${variant}` : ''}`);
    d.dataset.company = company;
    d.setAttribute('aria-label', `${company} company disc`);
    return d;
}
/** Player colour comes from BGA at runtime, so it is passed in rather than shipped as a palette. */
function renderMarker(playerColor, playerName) {
    const m = el('div', 'mr-marker');
    m.style.setProperty('--mr-player', playerColor.startsWith('#') ? playerColor : `#${playerColor}`);
    if (playerName)
        m.setAttribute('aria-label', `${playerName} order marker`);
    return m;
}
function renderActionTile(kind, spent = false) {
    const t = el('div', `mr-action-tile${spent ? ' is-spent' : ''}`, kind === 'buy' ? 'Buy' : 'Build');
    t.dataset.action = kind;
    return t;
}
function renderHex(spec) {
    const { hex, terrain, disc } = spec;
    const node = el('div', `mr-hex mr-hex--${terrain}${disc ? ' is-occupied' : ''}`);
    node.setAttribute('style', hexStyleVars(hex));
    node.dataset.hex = hexKey(hex);
    node.dataset.terrain = terrain;
    // The space's printed identity, kept on the element so a tile can be inspected on a live table
    // without a server round trip.
    if (spec.tile !== undefined)
        node.dataset.tile = String(spec.tile);
    if (spec.position !== undefined)
        node.dataset.position = String(spec.position);
    if (spec.space !== undefined)
        node.dataset.space = spec.space;
    if (spec.hexId !== undefined)
        node.dataset.hexId = String(spec.hexId);
    if (disc) {
        node.appendChild(renderDisc(disc, 'on-hex'));
    }
    else {
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
    node.setAttribute('aria-label', `${TERRAIN_LABEL[terrain]} ${signed(TERRAIN_VALUE[terrain])}${disc ? `, ${disc} track` : ''}` +
        (spec.startFor ? `, ${spec.startFor} starting hex` : ''));
    return node;
}
/**
 * Renders the board and sizes its container from the axial extent, so the caller never computes
 * pixels. Keep the arithmetic here consistent with the left/top rules in _hex.scss.
 */
function renderHexBoard(specs, frames = []) {
    const board = el('div', 'mr-hex-board');
    if (!specs.length)
        return board;
    // The frame anchors sit OUTSIDE the map, so they have to be normalised and measured alongside
    // the hexes — otherwise the ring is clipped by a board box sized to the hexes alone.
    const anchors = [...specs.map((s) => s.hex), ...frames.map((f) => f.hex)];
    const cols = anchors.map((h) => h.q + h.r / 2);
    const rows = anchors.map((h) => h.r);
    const minCol = Math.min(...cols);
    const minRow = Math.min(...rows);
    const shift = (h) => ({
        q: h.q - Math.round(minCol) - Math.round(minRow) / 2,
        r: h.r - minRow,
    });
    for (const spec of specs) {
        // Normalise so the top-left hex sits at 0,0 without negative offsets.
        board.appendChild(renderHex({ ...spec, hex: shift(spec.hex) }));
    }
    for (const frame of frames) {
        board.appendChild(renderFrame({ ...frame, hex: shift(frame.hex) }));
    }
    const width = Math.max(...cols) - minCol + 1;
    const height = Math.max(...rows) - minRow + 1;
    board.style.width = `calc((var(--mr-hex-w) + var(--mr-hex-gap)) * ${width + 0.5})`;
    board.style.height = `calc((var(--mr-hex-h) + var(--mr-hex-gap)) * (0.75 * ${height} + 0.25))`;
    return board;
}
/**
 * One Map Frame in the ring: the company's home edge, and where its disc goes when the company is
 * blocked off the map entirely (for -1).
 *
 * Placeholder art. The real piece is a chevron whose inner edge cups the outer tile and whose three
 * inward arrows mark the starting hexes; those hexes carry their own marker, so this draws the
 * colour, the facing and the parked discs only.
 */
function renderFrame(spec) {
    const { company, slot, discs } = spec;
    const f = el('div', `mr-frame mr-frame--${company}`);
    f.setAttribute('style', `${hexStyleVars(spec.hex)} --mr-frame-facing: ${(slot - 1) * 60}deg;`);
    f.dataset.company = company;
    f.dataset.slot = String(slot);
    f.setAttribute('aria-label', `${company} company frame${discs ? `, ${discs} blocked discs` : ''}`);
    if (discs)
        f.appendChild(renderDisc(company, 'on-hex'));
    return f;
}
/** Market and order tracks are both this long; exactly one disc is always left over to be taxed. */
const trackLength = (playerCount) => playerCount * 2 + 1;
function renderTrack(variant, label, slots, currentIndex) {
    const track = el('div', `mr-track mr-track--${variant}`);
    track.appendChild(el('div', 'mr-track__label', label));
    const cells = el('div', 'mr-track__cells');
    slots.forEach((slot, i) => {
        const cell = el('div', `mr-cell${slot.kind === 'empty' ? ' is-empty' : ''}`);
        if (currentIndex === i)
            cell.classList.add('is-current');
        if (slot.kind === 'disc')
            cell.appendChild(renderDisc(slot.company));
        if (slot.kind === 'marker')
            cell.appendChild(renderMarker(slot.color, slot.name));
        cells.appendChild(cell);
    });
    track.appendChild(cells);
    return track;
}
function renderMarketBoard(spec) {
    const board = el('div', 'mr-market');
    board.appendChild(renderTrack('order', 'Order track', spec.orderTrack, spec.currentIndex));
    board.appendChild(renderTrack('market', 'Market track', spec.marketTrack));
    board.appendChild(renderTrack('taxed', 'Taxed area', spec.taxed.map((c) => (c ? { kind: 'disc', company: c } : { kind: 'empty' }))));
    board.appendChild(el('div', 'mr-market__note', 'At end of round the market track becomes next round’s order track.'));
    return board;
}
function renderProfitBoard(spec) {
    const board = el('div', 'mr-profit-board');
    board.style.setProperty('--mr-player', spec.playerColor.startsWith('#') ? spec.playerColor : `#${spec.playerColor}`);
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
            if (stock.doomed)
                disc.classList.add('is-doomed');
            cell.appendChild(disc);
        }
        track.appendChild(cell);
    }
    board.appendChild(track);
    return board;
}

/**
 * Renders the real board from gamedatas.
 *
 * This replaces scaffold.ts, which drew an invented position. Everything here comes from the server,
 * so what you see on a table is true — the placeholder banner is gone and only the ART is still a
 * placeholder.
 *
 * ⚠️ BGA hands back SQL columns as STRINGS. Coordinates and values are coerced with Number() at the
 * boundary; skipping that puts hexes at NaN and the board silently fails to draw.
 */
const n = (v) => Number(v);
/**
 * Draw the whole board from gamedatas, replacing anything already there.
 *
 * A full redraw rather than incremental DOM updates: every component is still a CSS placeholder with
 * no animation to preserve, and re-rendering from state cannot drift out of step with the server the
 * way a pile of hand-written mutations can. Revisit when the art and animations land.
 */
function renderBoard(container, gamedatas) {
    container.querySelector('.mr-root')?.remove();
    const root = document.createElement('div');
    root.className = 'mr-root';
    // ── Map ───────────────────────────────────────────────────────────────────────────────────
    // Discs built on hexes are keyed by hex_id, which is what disc.arg holds for the 'hex' zone.
    const discByHexId = new Map();
    for (const d of gamedatas.discs.hex)
        discByHexId.set(n(d.arg), d.company);
    const specs = gamedatas.hexes.map((h) => ({
        hex: { q: n(h.q), r: n(h.r) },
        terrain: h.terrain,
        disc: discByHexId.get(n(h.hex_id)),
        tile: n(h.tile),
        position: n(h.position),
        space: h.space,
        hexId: n(h.hex_id),
        startFor: (h.is_start_for ?? undefined),
    }));
    // ── Map frames ────────────────────────────────────────────────────────────────────────────
    // The ring around the board, one frame per company, each cupping the outer tile in its slot.
    //
    // A slot's centre sits 3 hexes from the middle and the board reaches 4, so scaling the slot
    // vector to 5 puts the frame just outside the map on the same radial line — no separate table
    // of frame positions to keep in step with TILE_SLOTS.
    const OUTSIDE = 5 / 3;
    const frameSpecs = gamedatas.frames.map((fr) => {
        const slot = n(fr.slot);
        const [cq, cr] = gamedatas.tileSlots[String(slot)];
        return {
            company: fr.company,
            slot,
            hex: { q: n(cq) * OUTSIDE, r: n(cr) * OUTSIDE },
            discs: gamedatas.discs.frame.filter((d) => d.company === fr.company).length,
        };
    });
    const board = renderHexBoard(specs, frameSpecs);
    root.appendChild(board);
    // ── Central Market Board ──────────────────────────────────────────────────────────────────
    const len = n(gamedatas.trackLength);
    const colorOf = (playerId) => {
        const p = gamedatas.players[playerId];
        return p ? `#${p.color}` : '#607d8b';
    };
    const nameOf = (playerId) => {
        const p = gamedatas.players[playerId];
        return p ? p.name : '';
    };
    const trackSlots = (track) => {
        const slots = Array.from({ length: len }, () => ({ kind: 'empty' }));
        for (const m of gamedatas.markers) {
            if (m.track !== track)
                continue;
            const i = n(m.slot);
            if (i >= 0 && i < len) {
                slots[i] = { kind: 'marker', color: colorOf(n(m.player_id)), name: nameOf(n(m.player_id)) };
            }
        }
        if (track === 'market') {
            for (const d of gamedatas.discs.market) {
                const i = n(d.arg);
                // A marker in a slot means that disc has already been taken this round.
                if (i >= 0 && i < len && slots[i].kind === 'empty') {
                    slots[i] = { kind: 'disc', company: d.company };
                }
            }
        }
        return slots;
    };
    // One taxed space per round — the area fills as the bag empties, so both run out together.
    const taxedSlots = n(gamedatas.roundsTotal);
    const taxed = Array.from({ length: taxedSlots }, () => null);
    for (const d of gamedatas.discs.taxed) {
        const i = n(d.arg);
        if (i >= 0 && i < taxedSlots)
            taxed[i] = d.company;
    }
    const market = renderMarketBoard({
        playerCount: Object.keys(gamedatas.players).length,
        orderTrack: trackSlots('order'),
        marketTrack: trackSlots('market'),
        taxed,
    });
    root.appendChild(market);
    // ── Profit Boards ─────────────────────────────────────────────────────────────────────────
    const profitBoards = document.createElement('div');
    profitBoards.className = 'mr-profit-boards';
    for (const [pId, player] of Object.entries(gamedatas.players)) {
        const playerId = n(pId);
        const stocks = gamedatas.discs.stocks
            .filter((s) => n(s.player) === playerId)
            .map((s) => ({ company: s.company, value: n(s.value) }));
        profitBoards.appendChild(renderProfitBoard({
            playerName: player.name,
            playerColor: `#${player.color}`,
            stocks,
            buySpent: n(player.buySpent) === 1,
            buildSpent: n(player.buildSpent) === 1,
        }));
    }
    root.appendChild(profitBoards);
    container.appendChild(root);
    return { root, board, market, profitBoards };
}

class Game {
    constructor(bga) {
        console.log('minirailsmospinach constructor');
        this.bga = bga;
        // Declare the State classes
        this.playerTurn = new PlayerTurn(this, bga);
        this.bga.states.register('PlayerTurn', this.playerTurn);
    }
    /*
        setup:

        This method must set up the game user interface according to current game situation specified
        in parameters.

        The method is called each time the game interface is displayed to a player, ie:
        _ when the game starts
        _ when a player refreshes the game page (F5)

        "gamedatas" argument contains all datas retrieved by your "getAllDatas" PHP method.
    */
    setup(gamedatas) {
        console.log("Starting game setup");
        this.gamedatas = gamedatas;
        // The board renders entirely from gamedatas. Only the ART is still a placeholder.
        this.refresh();
        this.setupNotifications();
        console.log("Ending game setup");
    }
    ///////////////////////////////////////////////////
    //// Utility methods
    /**
     * Redraw the board from the local copy of gamedatas.
     *
     * Notification handlers mutate `this.gamedatas` to match what the server just did and then call
     * this. Keeping one render path means the board can never show something the state does not say.
     */
    refresh() {
        renderBoard(this.bga.gameArea.getElement(), this.gamedatas);
    }
    get discs() {
        return this.gamedatas.discs;
    }
    /** Pull a disc off the market track by id, returning it. */
    takeFromMarket(discId) {
        const i = this.discs.market.findIndex((d) => Number(d.id) === discId);
        if (i < 0)
            return undefined;
        return this.discs.market.splice(i, 1)[0];
    }
    /**
     * Mirror the server's marker move: the acting player's LEFTMOST order-track marker goes to the
     * market track, into the slot of the disc they took. Markers are never destroyed — the same two
     * per player shuttle between the tracks all game.
     */
    moveLeftmostOrderMarker(slot) {
        const onOrder = this.gamedatas.markers
            .filter((m) => m.track === 'order')
            .sort((a, b) => Number(a.slot) - Number(b.slot));
        const marker = onOrder[0];
        if (!marker)
            return;
        marker.track = 'market';
        marker.slot = slot;
    }
    setActionSpent(playerId, which) {
        const player = this.gamedatas.players[playerId];
        if (!player)
            return;
        if (which === 'buy')
            player.buySpent = 1;
        else
            player.buildSpent = 1;
    }
    ///////////////////////////////////////////////////
    //// Reaction to cometD notifications
    setupNotifications() {
        console.log('notifications subscriptions setup');
        // Automatically listen to the notifications, based on the `notif_xxx` methods on this class.
        this.bga.notifications.setupPromiseNotifications({
        // logger: console.log
        });
    }
    /** Draw Phase: a fresh market track, and everyone gets both action tiles back. */
    async notif_marketDrawn(args) {
        this.discs.market = args.discs;
        this.gamedatas.round = args.round;
        this.gamedatas.bagCount = args.bagCount;
        for (const player of Object.values(this.gamedatas.players)) {
            player.buySpent = 0;
            player.buildSpent = 0;
        }
        this.refresh();
    }
    /** Buy Shares: the disc lands on the buyer's Profit Board at 0. */
    async notif_shareBought(args) {
        const disc = this.takeFromMarket(Number(args.discId));
        if (disc) {
            this.discs.stocks.push({
                id: args.discId,
                company: args.company,
                player: args.player_id,
                value: args.value,
            });
        }
        this.moveLeftmostOrderMarker(Number(args.slot));
        this.setActionSpent(Number(args.player_id), 'buy');
        this.refresh();
    }
    /**
     * Build Tracks: the disc goes on a hex (or the company's frame if it is blocked), and every
     * stock of that colour on every board moves by the hex's printed value.
     */
    async notif_trackBuilt(args) {
        const disc = this.takeFromMarket(Number(args.discId));
        if (disc) {
            if (args.onFrame) {
                this.discs.frame.push({ id: args.discId, company: args.company, arg: 0 });
            }
            else {
                this.discs.hex.push({ id: args.discId, company: args.company, arg: args.hexId });
            }
        }
        // The server sends every stock of this colour with its new value — a stock at a cap stays
        // put while the others still move, so the values cannot be recomputed client-side.
        this.discs.stocks = this.discs.stocks.filter((s) => s.company !== args.company);
        this.discs.stocks.push(...args.stocks);
        this.moveLeftmostOrderMarker(Number(args.slot));
        this.setActionSpent(Number(args.player_id), 'build');
        this.refresh();
    }
    /** Taxation: the one disc nobody took moves to the taxed area. */
    async notif_discTaxed(args) {
        const disc = this.takeFromMarket(Number(args.discId));
        if (disc) {
            this.discs.taxed.push({ id: args.discId, company: args.company, arg: args.slot });
        }
        this.refresh();
    }
    /** Taxation: the market track, gap closed, becomes next round's order track. */
    async notif_tracksFlipped(args) {
        this.gamedatas.markers = args.markers;
        this.refresh();
    }
    /** Game end: which companies were taxed. Kept for the log; the eliminations follow per player. */
    async notif_finalScored(_args) {
    }
    /**
     * Game end, per player: the stocks eliminated by the taxed/untaxed inversion leave the Profit
     * Board, so what remains is exactly what was scored.
     *
     * The player-panel score is updated by the framework's own score counter, not from here.
     */
    async notif_scoreBreakdown(args) {
        const gone = new Set(args.removed.map((r) => Number(r.id)));
        this.discs.stocks = this.discs.stocks.filter((s) => !gone.has(Number(s.id)));
        this.refresh();
    }
}

export { Game };
