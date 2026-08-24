/**
 * Entry point for scripts/preview/ — renders every placeholder component in a plain browser, with no
 * BGA table and no server. Built by the second rollup config into scripts/preview/preview.js.
 *
 * This exists so the placeholder layer can be looked at and iterated on while art is pending. It is
 * dev-only: scripts/ is excluded from the SFTP deploy allowlist, so none of it reaches BGA.
 *
 * The demo state below is invented for display. It is NOT a game position and must not become a
 * fixture for game logic.
 */

import {
    COMPANIES,
    Company,
    Terrain,
    TERRAIN_LABEL,
    TERRAIN_VALUE,
    TrackSlot,
    HexSpec,
    renderActionTile,
    renderDisc,
    renderFrame,
    renderHexBoard,
    renderMarketBoard,
    renderProfitBoard,
    trackLength,
} from './components';
import { hexKey, provisionalMap } from './hex';

const TERRAINS = Object.keys(TERRAIN_VALUE) as Terrain[];

/** Stable pseudo-random so the preview looks the same on every reload. */
function seeded(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 0x100000000;
    };
}

function section(title: string, note?: string): HTMLElement {
    const s = document.createElement('section');
    const h = document.createElement('h2');
    h.textContent = title;
    s.appendChild(h);
    if (note) {
        const p = document.createElement('p');
        p.className = 'note';
        p.textContent = note;
        s.appendChild(p);
    }
    return s;
}

function row(): HTMLElement {
    const d = document.createElement('div');
    d.className = 'row';
    return d;
}

function labelled(node: HTMLElement, text: string): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'swatch';
    wrap.appendChild(node);
    const cap = document.createElement('span');
    cap.textContent = text;
    wrap.appendChild(cap);
    return wrap;
}

function buildMap(): HexSpec[] {
    const rand = seeded(20260823);
    const hexes = provisionalMap();
    // Centre is The Big City; everything else gets stable filler terrain.
    return hexes.map((hex) => {
        if (hex.q === 0 && hex.r === 0) return { hex, terrain: 'big-city' as Terrain };
        const terrain = TERRAINS[1 + Math.floor(rand() * (TERRAINS.length - 1))];
        const disc = rand() < 0.18 ? COMPANIES[Math.floor(rand() * COMPANIES.length)] : undefined;
        return { hex, terrain, disc };
    });
}

function main(): void {
    const root = document.getElementById('preview');
    if (!root) return;
    root.classList.add('mr-root');

    const banner = document.createElement('div');
    banner.className = 'mr-placeholder-banner';
    banner.textContent = 'Placeholder art — CSS shapes only';
    root.appendChild(banner);

    // ── Map ───────────────────────────────────────────────────────────────────────────────────
    const mapSection = section(
        'Hex map',
        'PROVISIONAL SHAPE: 7 tiles × 7 hexes, from provisionalMap() in hex.ts. The rulebook does not ' +
            'say whether a "map tile" is one hex or a flower of seven; this is the reading that fits the ' +
            'disc counts. Terrain assignment here is random filler, not the real board.',
    );
    const specs = buildMap();
    mapSection.appendChild(renderHexBoard(specs));
    root.appendChild(mapSection);

    // ── Frames ────────────────────────────────────────────────────────────────────────────────
    const frames = section(
        'Company frames',
        'A blocked company’s disc goes on its frame and moves that company’s stocks −1.',
    );
    const frameRow = row();
    for (const c of COMPANIES) frameRow.appendChild(labelled(renderFrame(c), c));
    frames.appendChild(frameRow);
    root.appendChild(frames);

    // ── Market board ──────────────────────────────────────────────────────────────────────────
    const players = [
        { name: 'Ada', color: '#e53935' },
        { name: 'Brun', color: '#1e88e5' },
        { name: 'Cai', color: '#43a047' },
        { name: 'Dee', color: '#8e24aa' },
    ];
    const len = trackLength(players.length); // 9 for 4 players

    // Mid-round: some market discs already replaced by markers.
    const marketTrack: TrackSlot[] = Array.from({ length: len }, (_, i) => {
        if (i < 3) return { kind: 'marker', color: players[i % players.length].color, name: players[i % players.length].name };
        return { kind: 'disc', company: COMPANIES[i % COMPANIES.length] };
    });
    const orderTrack: TrackSlot[] = Array.from({ length: len }, (_, i) =>
        i < players.length * 2 - 3
            ? { kind: 'marker', color: players[i % players.length].color, name: players[i % players.length].name }
            : { kind: 'empty' },
    );

    const market = section(
        'Central Market Board',
        `Track length is 2 × players + 1 = ${len} for ${players.length} players. Players place 2 × ${players.length} = ` +
            `${players.length * 2} markers, so exactly one disc is always left to be taxed.`,
    );
    market.appendChild(
        renderMarketBoard({
            playerCount: players.length,
            orderTrack,
            marketTrack,
            taxed: ['blue', 'yellow', null, null, null, null],
            currentIndex: 3,
        }),
    );
    root.appendChild(market);

    // ── Profit boards ─────────────────────────────────────────────────────────────────────────
    const profit = section(
        'Player Profit Boards',
        'Bought stocks enter at 0 and slide as their company is built on. Faded discs are the ' +
            'end-of-game elimination preview: taxed companies lose their negatives, untaxed lose their positives.',
    );
    profit.appendChild(
        renderProfitBoard({
            playerName: 'Ada',
            playerColor: '#e53935',
            buySpent: true,
            stocks: [
                { company: 'blue', value: 6 },
                { company: 'red', value: -3, doomed: true },
                { company: 'tan', value: 2 },
                { company: 'yellow', value: 0 },
            ],
        }),
    );
    profit.appendChild(
        renderProfitBoard({
            playerName: 'Brun',
            playerColor: '#1e88e5',
            buySpent: true,
            buildSpent: true,
            stocks: [
                { company: 'gray', value: -10 },
                { company: 'white', value: 10, doomed: true },
                { company: 'blue', value: 6 },
            ],
        }),
    );
    root.appendChild(profit);

    // ── Swatches ──────────────────────────────────────────────────────────────────────────────
    const swatches = section('Components', 'Company colour names are the rulebook’s; the hex values are ours.');

    const discRow = row();
    for (const c of COMPANIES) discRow.appendChild(labelled(renderDisc(c), c));
    swatches.appendChild(discRow);

    const smallRow = row();
    for (const c of COMPANIES) smallRow.appendChild(labelled(renderDisc(c, 'sm'), `${c} sm`));
    swatches.appendChild(smallRow);

    const tileRow = row();
    tileRow.appendChild(labelled(renderActionTile('buy'), 'available'));
    tileRow.appendChild(labelled(renderActionTile('build'), 'available'));
    tileRow.appendChild(labelled(renderActionTile('buy', true), 'spent'));
    tileRow.appendChild(labelled(renderActionTile('build', true), 'spent'));
    swatches.appendChild(tileRow);

    const terrainRow = row();
    for (const t of TERRAINS) {
        const board = renderHexBoard([{ hex: { q: 0, r: 0 }, terrain: t }]);
        terrainRow.appendChild(labelled(board, `${TERRAIN_LABEL[t]} ${TERRAIN_VALUE[t] > 0 ? '+' : ''}${TERRAIN_VALUE[t]}`));
    }
    swatches.appendChild(terrainRow);
    root.appendChild(swatches);

    // Sanity readout so a broken map shape is obvious rather than merely ugly.
    const stat = document.createElement('p');
    stat.className = 'note';
    stat.textContent = `${specs.length} hexes rendered · ${new Set(specs.map((s) => hexKey(s.hex))).size} unique coordinates`;
    root.appendChild(stat);
}

main();
