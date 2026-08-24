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
 * We create one State class per declared state on the PHP side, to handle all state specific code here.
 * onEnteringState, onLeavingState and onPlayerActivationChange are predefined names that will be called by the framework.
 * When executing code in this state, you can access the args using this.args
 */
class PlayerTurn {
    constructor(game, bga) {
        this.game = game;
        this.bga = bga;
    }
    /**
     * This method is called each time we are entering the game state. You can use this method to perform some user interface changes at this moment.
     */
    onEnteringState(args, isCurrentPlayerActive) {
        this.bga.statusBar.setTitle(isCurrentPlayerActive ?
            _('${you} must play a card or pass') :
            _('${actplayer} must play a card or pass'));
        if (isCurrentPlayerActive) {
            const playableCardsIds = args.playableCardsIds; // returned by the PlayerTurn::getArgs
            // Add test action buttons in the action status bar, simulating a card click:
            playableCardsIds.forEach(cardId => this.bga.statusBar.addActionButton(_('Play card with id ${card_id}').replace('${card_id}', `${cardId}`), () => this.onCardClick(cardId)));
            this.bga.statusBar.addActionButton(_('Pass'), () => this.bga.actions.performAction("actPass"), { color: 'secondary' });
        }
    }
    /**
     * This method is called each time we are leaving the game state. You can use this method to perform some user interface changes at this moment.
     */
    onLeavingState(args, isCurrentPlayerActive) {
    }
    /**
     * This method is called each time the current player becomes active or inactive in a MULTIPLE_ACTIVE_PLAYER state. You can use this method to perform some user interface changes at this moment.
     * on MULTIPLE_ACTIVE_PLAYER states, you may want to call this function in onEnteringState using `this.onPlayerActivationChange(args, isCurrentPlayerActive)` at the end of onEnteringState.
     * If your state is not a MULTIPLE_ACTIVE_PLAYER one, you can delete this function.
     */
    onPlayerActivationChange(args, isCurrentPlayerActive) {
    }
    onCardClick(card_id) {
        console.log('onCardClick', card_id);
        this.bga.actions.performAction("actPlayCard", {
            card_id,
        }).then(() => {
            // What to do after the server call if it succeeded
            // (most of the time, nothing, as the game will react to notifs / change of state instead, so you can delete the `then`)
        });
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
 * Visual scaffold — renders the placeholder components into a real BGA table.
 *
 * ⚠️ THIS DRAWS A FAKE POSITION. There is no server-side game logic yet, so the board below is
 * invented for display: terrain is assigned by cycling a list, discs and stocks are hard-coded. It is
 * here so a test table shows something legible to iterate on while the state machine is written.
 *
 * DELETE THIS FILE once setup() renders from real gamedatas. It must never become the path by which
 * fake state reaches a table that also has real state — that is how a display bug gets mistaken for a
 * rules bug. The banner it renders is the safeguard: if you can see it, nothing on screen is real.
 */
const TERRAINS = Object.keys(TERRAIN_VALUE);
/** Deterministic — cycling, not random, so the same table always looks the same. */
function demoMap() {
    return provisionalMap().map((hex, i) => {
        if (hex.q === 0 && hex.r === 0)
            return { hex, terrain: 'big-city' };
        const terrain = TERRAINS[1 + (i % (TERRAINS.length - 1))];
        const disc = i % 7 === 3 ? COMPANIES[i % COMPANIES.length] : undefined;
        return { hex, terrain, disc };
    });
}
function renderPlaceholderScaffold(container, players) {
    const root = document.createElement('div');
    root.className = 'mr-root';
    const banner = document.createElement('div');
    banner.className = 'mr-placeholder-banner';
    banner.textContent = 'Placeholder art & fake position — no game logic yet';
    root.appendChild(banner);
    root.appendChild(renderHexBoard(demoMap()));
    const frames = document.createElement('div');
    frames.style.display = 'flex';
    frames.style.gap = '8px';
    frames.style.margin = '12px 0';
    for (const c of COMPANIES)
        frames.appendChild(renderFrame(c));
    root.appendChild(frames);
    const count = Math.max(players.length, 1);
    const len = trackLength(count);
    const marketTrack = Array.from({ length: len }, (_, i) => ({
        kind: 'disc',
        company: COMPANIES[i % COMPANIES.length],
    }));
    const orderTrack = Array.from({ length: len }, (_, i) => i < count * 2
        ? { kind: 'marker', color: players[i % count].color, name: players[i % count].name }
        : { kind: 'empty' });
    root.appendChild(renderMarketBoard({
        playerCount: count,
        orderTrack,
        marketTrack,
        taxed: [null, null, null, null, null, null],
        currentIndex: 0,
    }));
    const boards = document.createElement('div');
    boards.style.display = 'flex';
    boards.style.flexWrap = 'wrap';
    boards.style.gap = '12px';
    boards.style.marginTop = '12px';
    players.forEach((p, i) => {
        boards.appendChild(renderProfitBoard({
            playerName: p.name,
            playerColor: p.color,
            stocks: [{ company: COMPANIES[i % COMPANIES.length], value: 0 }],
        }));
    });
    root.appendChild(boards);
    container.appendChild(root);
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
        // Example to add a div on the game area
        this.bga.gameArea.getElement().insertAdjacentHTML('beforeend', `
            <div id="player-tables"></div>
        `);
        // Setting up player boards
        Object.entries(gamedatas.players).forEach(([pId, player]) => {
            const playerId = Number(pId);
            // example of setting up players boards
            this.bga.playerPanels.getElement(playerId).insertAdjacentHTML('beforeend', `
                <span id="energy-player-counter-${playerId}"></span> Energy
            `);
            const counter = new ebg.counter();
            counter.create(`energy-player-counter-${playerId}`, {
                value: player.energy,
                playerCounter: 'energy',
                playerId: playerId,
            });
            // example of adding a div for each player
            document.getElementById('player-tables').insertAdjacentHTML('beforeend', `
                <div id="player-table-${player.id}">
                    <strong>${player.name}</strong>
                    <div>Player zone content goes here</div>
                </div>
            `);
        });
        // ⚠️ SCAFFOLD — renders the CSS placeholder components against a FAKE position, so a test
        // table shows something to iterate on while there is no game logic. Delete scaffold.ts and
        // this call once the board renders from real gamedatas. See src/ts/scaffold.ts.
        renderPlaceholderScaffold(this.bga.gameArea.getElement(), Object.entries(gamedatas.players).map(([pId, player]) => ({
            id: Number(pId),
            name: player.name,
            color: `#${player.color}`,
        })));
        // TODO: Set up your game interface here, according to "gamedatas"
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
