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
 * Three steps, and the middle one shows EVERY option at once:
 *
 *   1. pick a disc still on the market track
 *   2. the disc's whole set of options lights up together — Buy Shares as a button, and every legal
 *      build hex (or the company's frame, when it is blocked) highlighted and clickable. The market
 *      track stays live too, so the player can swap disc without backing out first
 *   3. picking one holds it and asks for Confirm. The other build spaces stay live, so a pending
 *      build moves to a different space in one click; Cancel drops all the way back to step 1
 *
 * Showing buy and build side by side rather than behind an action menu is the point: which disc is
 * worth taking depends on where it could be built, so the player should not have to commit to an
 * action to find out.
 *
 * Legality is decided by the server and arrives in the state args; nothing here re-derives it. The
 * highlight classes (`is-selectable`, `is-selected`) already exist in the SCSS.
 */
class PlayerTurn {
    constructor(game, bga) {
        this.game = game;
        this.bga = bga;
        this.args = null;
        this.discId = null;
        this.choice = null;
        /** Listeners attached this turn, torn down together on leaving the state. */
        this.cleanup = [];
    }
    onEnteringState(args, isCurrentPlayerActive) {
        this.args = args;
        if (!isCurrentPlayerActive) {
            this.bga.statusBar.setTitle(_('${actplayer} must take a disc from the market track'));
            return;
        }
        this.promptForDisc();
    }
    onLeavingState(_args, _isCurrentPlayerActive) {
        this.reset();
        this.args = null;
    }
    // ── Step 1: pick a disc ───────────────────────────────────────────────────────────────────
    promptForDisc() {
        this.reset();
        this.bga.statusBar.setTitle(_('${you} must take a disc from the market track'));
        this.offerDiscs();
    }
    /** Every disc still on the track, clickable. Live in step 2 as well, so a swap costs one click. */
    offerDiscs() {
        for (const disc of this.args.market) {
            const cell = this.marketCell(Number(disc.slot));
            if (!cell)
                continue;
            if (Number(disc.id) === this.discId) {
                cell.classList.add('is-selected');
                continue;
            }
            cell.classList.add('is-selectable');
            this.on(cell, () => this.selectDisc(Number(disc.id)));
        }
    }
    // ── Step 2: show every option for that disc ───────────────────────────────────────────────
    selectDisc(discId) {
        this.discId = discId;
        this.choice = null;
        this.showOptions();
    }
    showOptions() {
        this.clear();
        const disc = this.heldDisc();
        if (!disc)
            return this.promptForDisc();
        const { canBuy, canBuild } = this.args;
        const blocked = !!this.args.blocked[disc.company];
        this.bga.statusBar.setTitle(this.optionsTitle(canBuy, canBuild, blocked));
        this.offerDiscs();
        if (canBuy) {
            this.bga.statusBar.addActionButton(_('Buy Shares'), () => this.choose({ kind: 'buy' }), {
                color: 'primary',
            });
        }
        if (canBuild) {
            this.offerBuildTargets(disc, null);
            // A button as well as the piece, when the frame is the only build: it can be off the top
            // of a scrolled board.
            if (blocked) {
                this.bga.statusBar.addActionButton(_('Place on frame'), () => this.choose({ kind: 'build', hexId: 0 }));
            }
        }
        this.bga.statusBar.addActionButton(_('Cancel'), () => this.promptForDisc(), { color: 'secondary' });
    }
    /**
     * Light up every space the held disc may be built on — or the company's frame, when it has
     * nowhere legal on the map and can only be placed there for -1.
     *
     * `chosen` is the space already picked this turn, if any: it is marked rather than made
     * clickable, and the REST STAY LIVE. So moving a pending build to a different space is one
     * click, with no trip back out through Cancel.
     */
    offerBuildTargets(disc, chosen) {
        const targets = this.args.blocked[disc.company]
            ? [0]
            : (this.args.legalHexes[disc.company] ?? []).map(Number);
        for (const hexId of targets) {
            const target = hexId === 0 ? this.frameElement(disc.company) : this.hexElement(hexId);
            if (!target)
                continue;
            if (hexId === chosen) {
                target.classList.add('is-selected');
                continue;
            }
            target.classList.add('is-selectable');
            this.on(target, () => this.choose({ kind: 'build', hexId }));
        }
    }
    optionsTitle(canBuy, canBuild, blocked) {
        if (canBuy && canBuild) {
            return blocked
                ? _('${you} must buy shares, or place this company on its frame for -1')
                : _('${you} must buy shares, or click a highlighted hex to build track');
        }
        if (canBuy)
            return _('${you} must buy shares with this disc');
        return blocked
            ? _('${you} cannot build this company anywhere — place it on its frame for -1')
            : _('${you} must click a highlighted hex to build track');
    }
    // ── Step 3: confirm ───────────────────────────────────────────────────────────────────────
    choose(choice) {
        this.choice = choice;
        this.clear();
        const disc = this.heldDisc();
        if (!disc)
            return this.promptForDisc();
        // The disc and its destination both stay marked, so what is about to happen is on the board
        // rather than only in the status bar. The build spaces NOT chosen stay clickable, so a
        // pending build can be moved to another one directly.
        this.marketCell(Number(disc.slot))?.classList.add('is-selected');
        if (choice.kind === 'build')
            this.offerBuildTargets(disc, choice.hexId);
        this.bga.statusBar.setTitle(this.confirmTitle(choice));
        this.bga.statusBar.addActionButton(_('Confirm'), () => this.commit(), { color: 'primary' });
        this.bga.statusBar.addActionButton(_('Cancel'), () => this.promptForDisc(), { color: 'secondary' });
    }
    confirmTitle(choice) {
        if (choice.kind === 'buy')
            return _('${you} must confirm buying a share');
        return choice.hexId === 0
            ? _('${you} must confirm placing this disc on the frame for -1')
            : _('${you} must confirm building on this hex');
    }
    commit() {
        const choice = this.choice;
        const discId = this.discId;
        if (!choice || discId === null)
            return;
        this.reset();
        if (choice.kind === 'buy') {
            this.bga.actions.performAction('actBuyShare', { discId });
        }
        else {
            this.bga.actions.performAction('actBuildTrack', { discId, hexId: choice.hexId });
        }
    }
    // ── DOM plumbing ──────────────────────────────────────────────────────────────────────────
    heldDisc() {
        return this.args.market.find((d) => Number(d.id) === this.discId);
    }
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
    /** Drop every highlight, listener and button from the current step. */
    clear() {
        for (const undo of this.cleanup)
            undo();
        this.cleanup = [];
        for (const el of this.root().querySelectorAll('.is-selectable, .is-selected')) {
            el.classList.remove('is-selectable', 'is-selected');
        }
        this.bga.statusBar.removeActionButtons();
    }
    /** clear(), and forget what the player had picked. */
    reset() {
        this.clear();
        this.discId = null;
        this.choice = null;
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
/** The outer tile slots, the ones that carry a frame. Slot 0 — The Big City — does not. */
const FRAME_SLOTS = [1, 2, 3, 4, 5, 6];
const SQRT3_2 = Math.sqrt(3) / 2;
/** Centre of a hex, in board units. */
const hexPoint = (h) => ({ x: h.q + h.r / 2, y: SQRT3_2 * h.r });
/** Board units back to the (column, row) pair the stylesheet positions by. See _hex.scss. */
const pointCell = (p) => ({ col: p.x, row: p.y / SQRT3_2 });
const norm = (p) => Math.hypot(p.x, p.y);
const scaleTo = (p, r) => ({ x: (p.x * r) / norm(p), y: (p.y * r) / norm(p) });
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const bearing = (p) => Math.atan2(p.y, p.x);
/**
 * Distance from the map centre to a corner of the board hexagon, in hex widths.
 *
 * The map itself reaches 4.163, and below 4.484 the hexagon would slice a corner off an outer tile,
 * so that is the floor. The published board sits near 5.1 — measured off the rulebook's setup
 * diagram — which is a border between half and one hex wide. Raise it to widen the frames; the map
 * does not move.
 */
const BOARD_RADIUS = 5.1;
/** The six corners of a hex as offsets from its centre, clockwise from the top. */
const HEX_CORNERS = [0, 1, 2, 3, 4, 5].map((i) => {
    const a = (Math.PI / 180) * (-90 + 60 * i);
    return { x: Math.cos(a) / Math.sqrt(3), y: Math.sin(a) / Math.sqrt(3) };
});
/** The two corners either side of the edge a hex shares with its neighbour across DIRECTIONS[d]. */
const edgeCorners = (d) => [(7 - d) % 6, (8 - d) % 6];
let outline = null;
/**
 * The outline of the 49 map spaces as a closed ring of points, running clockwise on screen.
 *
 * Derived from TILE_SLOTS rather than listed out, so it cannot drift out of step with the map. Tile
 * faces and rotations do not affect it: they permute which space lands on a hex, never which hexes
 * exist.
 */
function mapOutline() {
    if (outline)
        return outline;
    const cells = new Set(TILE_SLOTS.flatMap((slot) => flower(slot)).map(hexKey));
    const key = (p) => `${p.x.toFixed(4)},${p.y.toFixed(4)}`;
    const points = new Map();
    const links = new Map();
    for (const cell of cells) {
        const h = parseHexKey(cell);
        const c = hexPoint(h);
        for (let d = 0; d < 6; d++) {
            if (cells.has(hexKey(neighbor(h, d))))
                continue;
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
    const start = links.keys().next().value;
    const ring = [start];
    let prev = '';
    let cur = start;
    for (;;) {
        const step = links.get(cur).find((k) => k !== prev);
        if (step === start)
            break;
        ring.push(step);
        prev = cur;
        cur = step;
    }
    const walk = ring.map((k) => points.get(k));
    // Shoelace. y grows downward, so a positive signed area means the walk is already clockwise.
    const area = walk.reduce((sum, p, i) => {
        const q = walk[(i + 1) % walk.length];
        return sum + (p.x * q.y - q.x * p.y);
    }, 0);
    outline = area > 0 ? walk : walk.reverse();
    return outline;
}
/** Indices into mapOutline() of the points furthest from ('max') or nearest to ('min') the centre. */
function extremes(pick) {
    const radii = mapOutline().map(norm);
    const target = pick === 'max' ? Math.max(...radii) : Math.min(...radii);
    return radii.flatMap((r, i) => (Math.abs(r - target) < 1e-9 ? [i] : []));
}
/** Which outline tip belongs to a slot: the one lying in that tile's direction from the centre. */
function tipForSlot(slot) {
    const ring = mapOutline();
    const aim = bearing(hexPoint(TILE_SLOTS[slot]));
    const off = (i) => {
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
function frameOutline(slot) {
    const ring = mapOutline();
    const tips = extremes('max');
    const notches = extremes('min');
    const tip = tipForSlot(slot);
    const at = tips.indexOf(tip);
    const corner = (i) => scaleTo(ring[tips[(i + tips.length) % tips.length]], BOARD_RADIUS);
    const ahead = (i) => (i - tip + ring.length) % ring.length;
    const behind = (i) => (tip - i + ring.length) % ring.length;
    const next = notches.reduce((b, i) => (ahead(i) < ahead(b) ? i : b));
    const back = notches.reduce((b, i) => (behind(i) < behind(b) ? i : b));
    const poly = [mid(corner(at - 1), corner(at)), corner(at), mid(corner(at), corner(at + 1))];
    for (let i = next;; i = (i - 1 + ring.length) % ring.length) {
        poly.push(ring[i]);
        if (i === back)
            break;
    }
    return poly;
}
/** Where a blocked company's disc parks: out on the frame's own corner, well clear of the map. */
const frameHome = (slot) => {
    const tip = mapOutline()[tipForSlot(slot)];
    return scaleTo(tip, (norm(tip) + BOARD_RADIUS) / 2);
};
/** The box the whole ring occupies — fixed geometry, the same whichever frames a game deals out. */
function frameRingBounds() {
    const all = FRAME_SLOTS.flatMap((slot) => frameOutline(slot));
    const xs = all.map((p) => p.x);
    const ys = all.map((p) => p.y);
    return {
        min: { x: Math.min(...xs), y: Math.min(...ys) },
        max: { x: Math.max(...xs), y: Math.max(...ys) },
    };
}

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
 * Renders the board and sizes its container from the map extent, so the caller never computes
 * pixels. Keep the arithmetic here consistent with the left/top rules in _hex.scss.
 *
 * The frame ring is not an overlay on the map — map plus frames is one hexagonal board — so when
 * there are frames it is the RING that fixes the box, and the hexes are laid out inside it.
 */
function renderHexBoard(specs, frames = []) {
    const board = el('div', 'mr-hex-board');
    if (!specs.length)
        return board;
    // Everything is measured as (column, row): column is q + r/2, row is r. A hex's left/top and the
    // ring's are both plain multiples of those, so one normalisation serves both.
    const ring = frames.length ? frameRingBounds() : null;
    const cells = specs.map((s) => pointCell(hexPoint(s.hex)));
    if (ring)
        cells.push(pointCell(ring.min), pointCell(ring.max));
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
    const shift = (h) => {
        const r = h.r - minRow;
        return { q: h.q + h.r / 2 - minCol - r / 2, r };
    };
    // Ring first: the frames are UNDER the map, so the seam along the map's outline reads as tiles
    // sitting in the frame rather than the frame lapping over them.
    if (ring)
        board.appendChild(renderFrameRing(frames, ring, minCol, minRow));
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
function renderFrameRing(frames, bounds, minCol, minRow) {
    const lo = pointCell(bounds.min);
    const hi = pointCell(bounds.max);
    const pct = (p) => {
        const c = pointCell(p);
        const x = (100 * (c.col - lo.col)) / (hi.col - lo.col);
        const y = (100 * (c.row - lo.row)) / (hi.row - lo.row);
        return `${x.toFixed(3)}% ${y.toFixed(3)}%`;
    };
    const ring = el('div', 'mr-frame-ring');
    ring.setAttribute('style', `--mr-ring-col:${lo.col - minCol};--mr-ring-row:${lo.row - minRow};` +
        `--mr-ring-cols:${hi.col - lo.col};--mr-ring-rows:${hi.row - lo.row};`);
    for (const frame of frames)
        ring.appendChild(renderFrame(frame, pct));
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
function renderFrame(spec, pct) {
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
    if (discs)
        home.appendChild(renderDisc(company, 'on-hex'));
    f.appendChild(home);
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
    // The slot is the whole of it: the piece's shape and place both fall out of the map geometry
    // (frameOutline() in hex.ts), so there is no table of frame positions to keep in step.
    const frameSpecs = gamedatas.frames.map((fr) => ({
        company: fr.company,
        slot: n(fr.slot),
        discs: gamedatas.discs.frame.filter((d) => d.company === fr.company).length,
    }));
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
