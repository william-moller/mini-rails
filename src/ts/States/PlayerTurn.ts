import { Game } from "../Game";

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
export class PlayerTurn {
    private args: PlayerTurnArgs | null = null;
    private selectedDiscId: number | null = null;
    /** Listeners attached this turn, torn down together on leaving the state. */
    private cleanup: (() => void)[] = [];

    constructor(private game: Game, private bga: Bga<minirailsmospinachPlayer, minirailsmospinachGamedatas>) {
    }

    onEnteringState(args: PlayerTurnArgs, isCurrentPlayerActive: boolean) {
        this.args = args;
        this.selectedDiscId = null;

        if (!isCurrentPlayerActive) {
            this.bga.statusBar.setTitle(_('${actplayer} must take a disc from the market track'));
            return;
        }
        this.promptForDisc();
    }

    onLeavingState(_args: PlayerTurnArgs, _isCurrentPlayerActive: boolean) {
        this.clearSelection();
        this.args = null;
    }

    // ── Step 1: choose a disc ─────────────────────────────────────────────────────────────────

    private promptForDisc(): void {
        this.clearSelection();
        this.selectedDiscId = null;
        this.bga.statusBar.setTitle(_('${you} must take a disc from the market track'));

        for (const disc of this.args!.market) {
            const cell = this.marketCell(Number(disc.slot));
            if (!cell) continue;
            cell.classList.add('is-selectable');
            this.on(cell, () => this.onDiscPicked(Number(disc.id)));
        }
    }

    private onDiscPicked(discId: number): void {
        this.selectedDiscId = discId;
        this.clearSelection();

        const { canBuy, canBuild } = this.args!;
        if (canBuy && !canBuild) return this.chooseBuy();
        if (canBuild && !canBuy) return this.promptForHex();

        // First turn of the round: both tiles still in hand, so the player picks.
        this.bga.statusBar.setTitle(_('${you} must choose an action for this disc'));
        this.bga.statusBar.addActionButton(_('Buy Shares'), () => this.chooseBuy());
        this.bga.statusBar.addActionButton(_('Build Tracks'), () => this.promptForHex());
        this.bga.statusBar.addActionButton(_('Cancel'), () => this.promptForDisc(), { color: 'secondary' });
    }

    // ── Step 2a: Buy Shares ───────────────────────────────────────────────────────────────────

    private chooseBuy(): void {
        this.clearSelection();
        this.bga.actions.performAction('actBuyShare', { discId: this.selectedDiscId });
    }

    // ── Step 2b: Build Tracks ─────────────────────────────────────────────────────────────────

    private promptForHex(): void {
        this.clearSelection();

        const disc = this.args!.market.find((d) => Number(d.id) === this.selectedDiscId);
        if (!disc) return this.promptForDisc();

        // A company with nowhere legal to build goes on its frame instead, for -1.
        if (this.args!.blocked[disc.company]) {
            this.bga.statusBar.setTitle(
                _('${you} cannot build this company anywhere — place it on its frame for -1'),
            );
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
        for (const hexId of this.args!.legalHexes[disc.company] ?? []) {
            const hex = this.hexElement(Number(hexId));
            if (!hex) continue;
            hex.classList.add('is-selectable');
            this.on(hex, () => this.build(Number(hexId)));
        }
        this.bga.statusBar.addActionButton(_('Cancel'), () => this.promptForDisc(), { color: 'secondary' });
    }

    private build(hexId: number): void {
        this.clearSelection();
        this.bga.actions.performAction('actBuildTrack', { discId: this.selectedDiscId, hexId });
    }

    // ── DOM plumbing ──────────────────────────────────────────────────────────────────────────

    private root(): HTMLElement {
        return this.bga.gameArea.getElement();
    }

    /** Market cells are addressed by slot; the track is rendered in slot order. */
    private marketCell(slot: number): HTMLElement | null {
        const cells = this.root().querySelectorAll<HTMLElement>('.mr-track--market .mr-cell');
        return cells[slot] ?? null;
    }

    private hexElement(hexId: number): HTMLElement | null {
        return this.root().querySelector<HTMLElement>(`.mr-hex[data-hex-id="${hexId}"]`);
    }

    private frameElement(company: string): HTMLElement | null {
        return this.root().querySelector<HTMLElement>(`.mr-frame[data-company="${company}"]`);
    }

    private on(el: HTMLElement, handler: () => void): void {
        const wrapped = (e: Event) => {
            e.stopPropagation();
            handler();
        };
        el.addEventListener('click', wrapped);
        this.cleanup.push(() => el.removeEventListener('click', wrapped));
    }

    /** Drop every highlight and listener from the current step. */
    private clearSelection(): void {
        for (const undo of this.cleanup) undo();
        this.cleanup = [];
        for (const el of this.root().querySelectorAll('.is-selectable')) {
            el.classList.remove('is-selectable');
        }
        this.bga.statusBar.removeActionButtons();
    }
}
