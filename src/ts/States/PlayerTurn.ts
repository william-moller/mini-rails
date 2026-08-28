import { Game } from "../Game";

/** What the player has chosen to do with the held disc, waiting on Confirm. hexId 0 is the frame. */
type Choice = { kind: 'buy' } | { kind: 'build'; hexId: number };

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
export class PlayerTurn {
    private args: PlayerTurnArgs | null = null;
    private discId: number | null = null;
    private choice: Choice | null = null;
    /** Listeners attached this turn, torn down together on leaving the state. */
    private cleanup: (() => void)[] = [];

    constructor(private game: Game, private bga: Bga<minirailsmospinachPlayer, minirailsmospinachGamedatas>) {
    }

    onEnteringState(args: PlayerTurnArgs, isCurrentPlayerActive: boolean) {
        this.args = args;

        if (!isCurrentPlayerActive) {
            this.bga.statusBar.setTitle(_('${actplayer} must take a disc from the market track'));
            return;
        }
        this.promptForDisc();
    }

    onLeavingState(_args: PlayerTurnArgs, _isCurrentPlayerActive: boolean) {
        this.reset();
        this.args = null;
    }

    // ── Step 1: pick a disc ───────────────────────────────────────────────────────────────────

    private promptForDisc(): void {
        this.reset();
        this.bga.statusBar.setTitle(_('${you} must take a disc from the market track'));
        this.offerDiscs();
    }

    /** Every disc still on the track, clickable. Live in step 2 as well, so a swap costs one click. */
    private offerDiscs(): void {
        for (const disc of this.args!.market) {
            const cell = this.marketCell(Number(disc.slot));
            if (!cell) continue;
            if (Number(disc.id) === this.discId) {
                cell.classList.add('is-selected');
                continue;
            }
            cell.classList.add('is-selectable');
            this.on(cell, () => this.selectDisc(Number(disc.id)));
        }
    }

    // ── Step 2: show every option for that disc ───────────────────────────────────────────────

    private selectDisc(discId: number): void {
        this.discId = discId;
        this.choice = null;
        this.showOptions();
    }

    private showOptions(): void {
        this.clear();

        const disc = this.heldDisc();
        if (!disc) return this.promptForDisc();

        const { canBuy, canBuild } = this.args!;
        const blocked = !!this.args!.blocked[disc.company];

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
    private offerBuildTargets(disc: MrMarketDisc, chosen: number | null): void {
        const targets = this.args!.blocked[disc.company]
            ? [0]
            : (this.args!.legalHexes[disc.company] ?? []).map(Number);

        for (const hexId of targets) {
            const target = hexId === 0 ? this.frameElement(disc.company) : this.hexElement(hexId);
            if (!target) continue;
            if (hexId === chosen) {
                target.classList.add('is-selected');
                continue;
            }
            target.classList.add('is-selectable');
            this.on(target, () => this.choose({ kind: 'build', hexId }));
        }
    }

    private optionsTitle(canBuy: boolean, canBuild: boolean, blocked: boolean): string {
        if (canBuy && canBuild) {
            return blocked
                ? _('${you} must buy shares, or place this company on its frame for -1')
                : _('${you} must buy shares, or click a highlighted hex to build track');
        }
        if (canBuy) return _('${you} must buy shares with this disc');
        return blocked
            ? _('${you} cannot build this company anywhere — place it on its frame for -1')
            : _('${you} must click a highlighted hex to build track');
    }

    // ── Step 3: confirm ───────────────────────────────────────────────────────────────────────

    private choose(choice: Choice): void {
        this.choice = choice;
        this.clear();

        const disc = this.heldDisc();
        if (!disc) return this.promptForDisc();

        // The disc and its destination both stay marked, so what is about to happen is on the board
        // rather than only in the status bar. The build spaces NOT chosen stay clickable, so a
        // pending build can be moved to another one directly.
        this.marketCell(Number(disc.slot))?.classList.add('is-selected');
        if (choice.kind === 'build') this.offerBuildTargets(disc, choice.hexId);

        this.bga.statusBar.setTitle(this.confirmTitle(choice));
        this.bga.statusBar.addActionButton(_('Confirm'), () => this.commit(), { color: 'primary' });
        this.bga.statusBar.addActionButton(_('Cancel'), () => this.promptForDisc(), { color: 'secondary' });
    }

    private confirmTitle(choice: Choice): string {
        if (choice.kind === 'buy') return _('${you} must confirm buying a share');
        return choice.hexId === 0
            ? _('${you} must confirm placing this disc on the frame for -1')
            : _('${you} must confirm building on this hex');
    }

    private commit(): void {
        const choice = this.choice;
        const discId = this.discId;
        if (!choice || discId === null) return;

        this.reset();
        if (choice.kind === 'buy') {
            this.bga.actions.performAction('actBuyShare', { discId });
        } else {
            this.bga.actions.performAction('actBuildTrack', { discId, hexId: choice.hexId });
        }
    }

    // ── DOM plumbing ──────────────────────────────────────────────────────────────────────────

    private heldDisc(): MrMarketDisc | undefined {
        return this.args!.market.find((d) => Number(d.id) === this.discId);
    }

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

    /** Drop every highlight, listener and button from the current step. */
    private clear(): void {
        for (const undo of this.cleanup) undo();
        this.cleanup = [];
        for (const el of this.root().querySelectorAll('.is-selectable, .is-selected')) {
            el.classList.remove('is-selectable', 'is-selected');
        }
        this.bga.statusBar.removeActionButtons();
    }

    /** clear(), and forget what the player had picked. */
    private reset(): void {
        this.clear();
        this.discId = null;
        this.choice = null;
    }
}
