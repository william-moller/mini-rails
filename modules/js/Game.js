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
 * ⚠️ The two actions are not implemented server-side yet (see modules/php/States/PlayerTurn.php), so
 * there is nothing to click. This announces whose turn it is and says plainly that the actions are
 * still to come, rather than offering buttons that would fail.
 *
 * When actBuyShare / actBuildTrack land, this is where market discs become clickable and, for Build,
 * legal hexes get `is-selectable`.
 */
class PlayerTurn {
    constructor(game, bga) {
        this.game = game;
        this.bga = bga;
    }
    onEnteringState(args, isCurrentPlayerActive) {
        this.bga.statusBar.setTitle(isCurrentPlayerActive
            ? _('${you} would act here — Buy Shares and Build Tracks are not implemented yet')
            : _('${actplayer} would act here — actions are not implemented yet'));
    }
    onLeavingState(args, isCurrentPlayerActive) {
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
 * A "flower": a hex and its six neighbours. The reference project's map artwork shows exactly this
 * shape — a centre hex ringed by six — with The Big City at the middle.
 */
const flower = (center) => hexesInRange(center, 1);
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
function provisionalMap() {
    const seen = new Set();
    const out = [];
    // Flower centres must be 3 steps apart, not 2. At distance 2 a hex can be adjacent to BOTH
    // centres, so the flowers overlap: 7 x 7 collapsed to 31 unique hexes with 18 collisions when
    // this was first written. Distance 3 is the "aperture 7" / spiral-honeycomb arrangement and
    // tiles exactly — verified as 49 unique hexes, 0 overlaps.
    const tileCentres = [
        { q: 0, r: 0 },
        { q: +1, r: +2 }, { q: +3, r: -1 }, { q: +2, r: -3 },
        { q: -1, r: -2 }, { q: -3, r: +1 }, { q: -2, r: +3 },
    ];
    for (const c of tileCentres) {
        for (const h of flower(c)) {
            const k = hexKey(h);
            if (!seen.has(k)) {
                seen.add(k);
                out.push(h);
            }
        }
    }
    return out;
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
    if (disc) {
        node.appendChild(renderDisc(disc, 'on-hex'));
    }
    else {
        node.appendChild(el('div', 'mr-hex__value', signed(TERRAIN_VALUE[terrain])));
        node.appendChild(el('div', 'mr-hex__name', TERRAIN_LABEL[terrain]));
    }
    node.setAttribute('aria-label', `${TERRAIN_LABEL[terrain]} ${signed(TERRAIN_VALUE[terrain])}${disc ? `, ${disc} track` : ''}`);
    return node;
}
/**
 * Renders the board and sizes its container from the axial extent, so the caller never computes
 * pixels. Keep the arithmetic here consistent with the left/top rules in _hex.scss.
 */
function renderHexBoard(specs) {
    const board = el('div', 'mr-hex-board');
    if (!specs.length)
        return board;
    const cols = specs.map((s) => s.hex.q + s.hex.r / 2);
    const rows = specs.map((s) => s.hex.r);
    const minCol = Math.min(...cols);
    const minRow = Math.min(...rows);
    for (const spec of specs) {
        // Normalise so the top-left hex sits at 0,0 without negative offsets.
        const shifted = {
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
function renderFrame(company, discs = []) {
    const f = el('div', `mr-frame mr-frame--${company}`);
    f.dataset.company = company;
    f.setAttribute('aria-label', `${company} company frame, ${discs.length} discs`);
    if (discs.length)
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
function renderBoard(container, gamedatas) {
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
    }));
    const board = renderHexBoard(specs);
    root.appendChild(board);
    // ── Company frames ────────────────────────────────────────────────────────────────────────
    const framesRow = document.createElement('div');
    framesRow.className = 'mr-frames';
    for (const company of gamedatas.companies) {
        const onFrame = gamedatas.discs.frame.filter((d) => d.company === company);
        framesRow.appendChild(renderFrame(company, onFrame.map((d) => d.company)));
    }
    root.appendChild(framesRow);
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
    const taxed = Array.from({ length: 6 }, () => null);
    for (const d of gamedatas.discs.taxed) {
        const i = n(d.arg);
        if (i >= 0 && i < 6)
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
        // Uncomment the next line to show debug informations about state changes in the console. Remove before going to production!
        // this.bga.states.logger = console.log;
        // Here, you can init the global variables of your user interface
        // Example:
        // this.myGlobalValue = 0;
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
        renderBoard(this.bga.gameArea.getElement(), gamedatas);
        // Setup game notifications to handle (see "setupNotifications" method below)
        this.setupNotifications();
        console.log("Ending game setup");
    }
    ///////////////////////////////////////////////////
    //// Utility methods
    /*
    
        Here, you can defines some utility methods that you can use everywhere in your javascript
        script. Typically, functions that are used in multiple state classes or outside a state class.
    
    */
    ///////////////////////////////////////////////////
    //// Reaction to cometD notifications
    /*
        setupNotifications:
        
        In this method, you associate each of your game notifications with your local method to handle it.
        
        Note: game notification names correspond to "bga->notify->all" calls in your Game.php file.
    
    */
    setupNotifications() {
        console.log('notifications subscriptions setup');
        // automatically listen to the notifications, based on the `notif_xxx` function on this class. 
        // Uncomment the logger param to see debug information in the console about notifications.
        this.bga.notifications.setupPromiseNotifications({
        // logger: console.log
        });
    }
}

export { Game };
