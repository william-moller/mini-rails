import { PlayerTurn } from "./States/PlayerTurn";
import { renderBoard } from "./board";

export class Game {
    public bga: Bga<minirailsmospinachPlayer, minirailsmospinachGamedatas>;
    private gamedatas: minirailsmospinachGamedatas;

    private playerTurn: PlayerTurn;

    constructor(bga: Bga<minirailsmospinachPlayer, minirailsmospinachGamedatas>) {
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

    setup(gamedatas: minirailsmospinachGamedatas) {
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
    private refresh(): void {
        renderBoard(this.bga.gameArea.getElement(), this.gamedatas);
    }

    private get discs(): MrDiscs {
        return this.gamedatas.discs;
    }

    /** Pull a disc off the market track by id, returning it. */
    private takeFromMarket(discId: number): MrDisc | undefined {
        const i = this.discs.market.findIndex((d) => Number(d.id) === discId);
        if (i < 0) return undefined;
        return this.discs.market.splice(i, 1)[0];
    }

    /**
     * Mirror the server's marker move: the acting player's LEFTMOST order-track marker goes to the
     * market track, into the slot of the disc they took. Markers are never destroyed — the same two
     * per player shuttle between the tracks all game.
     */
    private moveLeftmostOrderMarker(slot: number): void {
        const onOrder = this.gamedatas.markers
            .filter((m) => m.track === 'order')
            .sort((a, b) => Number(a.slot) - Number(b.slot));
        const marker = onOrder[0];
        if (!marker) return;
        marker.track = 'market';
        marker.slot = slot;
    }

    private setActionSpent(playerId: number, which: 'buy' | 'build'): void {
        const player = this.gamedatas.players[playerId as unknown as keyof typeof this.gamedatas.players];
        if (!player) return;
        if (which === 'buy') player.buySpent = 1;
        else player.buildSpent = 1;
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
    async notif_marketDrawn(args: {
        round: number;
        rounds: number;
        count: number;
        discs: MrDisc[];
        bagCount: number;
    }) {
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
    async notif_shareBought(args: {
        player_id: number;
        company: string;
        discId: number;
        slot: number;
        value: number;
    }) {
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
    async notif_trackBuilt(args: {
        player_id: number;
        company: string;
        discId: number;
        slot: number;
        hexId: number | null;
        onFrame: boolean;
        stocks: MrStock[];
    }) {
        const disc = this.takeFromMarket(Number(args.discId));
        if (disc) {
            if (args.onFrame) {
                this.discs.frame.push({ id: args.discId, company: args.company, arg: 0 });
            } else {
                this.discs.hex.push({ id: args.discId, company: args.company, arg: args.hexId! });
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
    async notif_discTaxed(args: { company: string; discId: number; slot: number }) {
        const disc = this.takeFromMarket(Number(args.discId));
        if (disc) {
            this.discs.taxed.push({ id: args.discId, company: args.company, arg: args.slot });
        }
        this.refresh();
    }

    /** Taxation: the market track, gap closed, becomes next round's order track. */
    async notif_tracksFlipped(args: { markers: MrMarker[]; round: number; rounds: number }) {
        this.gamedatas.markers = args.markers;
        this.refresh();
    }

    /** Game end: which companies were taxed. Kept for the log; the eliminations follow per player. */
    async notif_finalScored(_args: { taxed: string[]; taxedList: string }) {
    }

    /**
     * Game end, per player: the stocks eliminated by the taxed/untaxed inversion leave the Profit
     * Board, so what remains is exactly what was scored.
     *
     * The player-panel score is updated by the framework's own score counter, not from here.
     */
    async notif_scoreBreakdown(args: {
        player_id: number;
        score: number;
        kept: { id: Num; company: string; value: Num }[];
        removed: { id: Num; company: string; value: Num }[];
    }) {
        const gone = new Set(args.removed.map((r) => Number(r.id)));
        this.discs.stocks = this.discs.stocks.filter((s) => !gone.has(Number(s.id)));
        this.refresh();
    }
}
