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

import {
    COMPANIES,
    Company,
    Terrain,
    TERRAIN_VALUE,
    HexSpec,
    TrackSlot,
    renderFrame,
    renderHexBoard,
    renderMarketBoard,
    renderProfitBoard,
    trackLength,
} from './components';
import { provisionalMap } from './hex';

const TERRAINS = Object.keys(TERRAIN_VALUE) as Terrain[];

interface ScaffoldPlayer {
    id: number;
    name: string;
    color: string;
}

/** Deterministic — cycling, not random, so the same table always looks the same. */
function demoMap(): HexSpec[] {
    return provisionalMap().map((hex, i) => {
        if (hex.q === 0 && hex.r === 0) return { hex, terrain: 'big-city' as Terrain };
        const terrain = TERRAINS[1 + (i % (TERRAINS.length - 1))];
        const disc = i % 7 === 3 ? COMPANIES[i % COMPANIES.length] : undefined;
        return { hex, terrain, disc };
    });
}

export function renderPlaceholderScaffold(container: HTMLElement, players: ScaffoldPlayer[]): void {
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
    for (const c of COMPANIES) frames.appendChild(renderFrame(c));
    root.appendChild(frames);

    const count = Math.max(players.length, 1);
    const len = trackLength(count);
    const marketTrack: TrackSlot[] = Array.from({ length: len }, (_, i) => ({
        kind: 'disc',
        company: COMPANIES[i % COMPANIES.length],
    }));
    const orderTrack: TrackSlot[] = Array.from({ length: len }, (_, i) =>
        i < count * 2
            ? { kind: 'marker', color: players[i % count].color, name: players[i % count].name }
            : { kind: 'empty' },
    );
    root.appendChild(
        renderMarketBoard({
            playerCount: count,
            orderTrack,
            marketTrack,
            taxed: [null, null, null, null, null, null],
            currentIndex: 0,
        }),
    );

    const boards = document.createElement('div');
    boards.style.display = 'flex';
    boards.style.flexWrap = 'wrap';
    boards.style.gap = '12px';
    boards.style.marginTop = '12px';
    players.forEach((p, i) => {
        boards.appendChild(
            renderProfitBoard({
                playerName: p.name,
                playerColor: p.color,
                stocks: [{ company: COMPANIES[i % COMPANIES.length], value: 0 }],
            }),
        );
    });
    root.appendChild(boards);

    container.appendChild(root);
}
