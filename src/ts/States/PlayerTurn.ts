import { Game } from "../Game";

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
export class PlayerTurn {
    constructor(private game: Game, private bga: Bga<minirailsmospinachPlayer, minirailsmospinachGamedatas>) {
    }

    onEnteringState(args: PlayerTurnArgs, isCurrentPlayerActive: boolean) {
        this.bga.statusBar.setTitle(
            isCurrentPlayerActive
                ? _('${you} would act here — Buy Shares and Build Tracks are not implemented yet')
                : _('${actplayer} would act here — actions are not implemented yet'),
        );
    }

    onLeavingState(args: PlayerTurnArgs, isCurrentPlayerActive: boolean) {
    }
}
