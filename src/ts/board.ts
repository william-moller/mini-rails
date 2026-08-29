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

import {
    Company,
    Terrain,
    FrameSpec,
    HexSpec,
    TrackSlot,
    renderHexBoard,
    renderMarketBoard,
    renderProfitBoard,
    Stock,
} from './components';

const n = (v: number | string): number => Number(v);

export interface BoardRefs {
    root: HTMLElement;
    board: HTMLElement;
    market: HTMLElement;
    profitBoards: HTMLElement;
}

/**
 * A child that outlives a redraw, created on the first render and found by id after that.
 *
 * Only the frame of the board works this way — see renderBoard() for why the map host in particular
 * has to survive. Their CONTENTS are still replaced wholesale every time.
 */
function persistent(parent: HTMLElement, id: string, className: string): HTMLElement {
    const existing = parent.querySelector<HTMLElement>(`#${id}`);
    if (existing) return existing;

    const el = document.createElement('div');
    el.id = id;
    el.className = className;
    parent.appendChild(el);
    return el;
}

/**
 * Draw the whole board from gamedatas, replacing anything already there.
 *
 * A full redraw rather than incremental DOM updates: every component is still a CSS placeholder with
 * no animation to preserve, and re-rendering from state cannot drift out of step with the server the
 * way a pile of hand-written mutations can. Revisit when the art and animations land.
 */
export function renderBoard(
    container: HTMLElement,
    gamedatas: minirailsmospinachGamedatas,
): BoardRefs {
    // These three elements PERSIST across redraws. bga-zoom wraps the map host once at setup and
    // scales that wrapper, so rebuilding the host here would leave the zoom controls driving a
    // detached node. Everything INSIDE each section is still thrown away and rebuilt from gamedatas,
    // which is what keeps the board from drifting out of step with the server.
    const root = persistent(container, 'mr-root', 'mr-root');
    const mapHost = persistent(root, 'mr-map', 'mr-map');
    const side = persistent(root, 'mr-side', 'mr-side');

    // ── Map ───────────────────────────────────────────────────────────────────────────────────
    // Discs built on hexes are keyed by hex_id, which is what disc.arg holds for the 'hex' zone.
    const discByHexId = new Map<number, Company>();
    for (const d of gamedatas.discs.hex) discByHexId.set(n(d.arg), d.company as Company);

    const specs: HexSpec[] = gamedatas.hexes.map((h) => ({
        hex: { q: n(h.q), r: n(h.r) },
        terrain: h.terrain as Terrain,
        disc: discByHexId.get(n(h.hex_id)),
        tile: n(h.tile),
        position: n(h.position),
        space: h.space,
        hexId: n(h.hex_id),
        startFor: (h.is_start_for ?? undefined) as Company | undefined,
    }));

    // ── Map frames ────────────────────────────────────────────────────────────────────────────
    // The ring around the board, one frame per company, each cupping the outer tile in its slot.
    // The slot is the whole of it: the piece's shape and place both fall out of the map geometry
    // (frameOutline() in hex.ts), so there is no table of frame positions to keep in step.
    const frameSpecs: FrameSpec[] = gamedatas.frames.map((fr) => ({
        company: fr.company as Company,
        slot: n(fr.slot),
        discs: gamedatas.discs.frame.filter((d) => d.company === fr.company).length,
    }));

    const board = renderHexBoard(specs, frameSpecs);
    mapHost.replaceChildren(board);

    // ── Central Market Board ──────────────────────────────────────────────────────────────────
    const len = n(gamedatas.trackLength);
    const colorOf = (playerId: number): string => {
        const p = gamedatas.players[playerId as unknown as keyof typeof gamedatas.players];
        return p ? `#${p.color}` : '#607d8b';
    };
    const nameOf = (playerId: number): string => {
        const p = gamedatas.players[playerId as unknown as keyof typeof gamedatas.players];
        return p ? p.name : '';
    };

    const trackSlots = (track: 'order' | 'market'): TrackSlot[] => {
        const slots: TrackSlot[] = Array.from({ length: len }, () => ({ kind: 'empty' }));
        for (const m of gamedatas.markers) {
            if (m.track !== track) continue;
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
                    slots[i] = { kind: 'disc', company: d.company as Company };
                }
            }
        }
        return slots;
    };

    // One taxed space per round — the area fills as the bag empties, so both run out together.
    const taxedSlots = n(gamedatas.roundsTotal);
    const taxed: (Company | null)[] = Array.from({ length: taxedSlots }, () => null);
    for (const d of gamedatas.discs.taxed) {
        const i = n(d.arg);
        if (i >= 0 && i < taxedSlots) taxed[i] = d.company as Company;
    }

    const market = renderMarketBoard({
        playerCount: Object.keys(gamedatas.players).length,
        orderTrack: trackSlots('order'),
        marketTrack: trackSlots('market'),
        taxed,
    });
    // Held for the swap below: market and Profit Boards go together, outside the zoomed map.

    // ── Profit Boards ─────────────────────────────────────────────────────────────────────────
    const profitBoards = document.createElement('div');
    profitBoards.className = 'mr-profit-boards';
    for (const [pId, player] of Object.entries(gamedatas.players)) {
        const playerId = n(pId);
        const stocks: Stock[] = gamedatas.discs.stocks
            .filter((s) => n(s.player) === playerId)
            .map((s) => ({ company: s.company as Company, value: n(s.value) }));
        profitBoards.appendChild(
            renderProfitBoard({
                playerName: player.name,
                playerColor: `#${player.color}`,
                stocks,
                buySpent: n(player.buySpent) === 1,
                buildSpent: n(player.buildSpent) === 1,
            }),
        );
    }
    side.replaceChildren(market, profitBoards);
    return { root, board, market, profitBoards };
}
