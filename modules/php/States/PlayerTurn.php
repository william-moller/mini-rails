<?php
/**
 *------
 * BGA framework: Gregory Isabelli & Emmanuel Colin & BoardGameArena
 * Mini Rails implementation : © Will Moller <will.moller@gmail.com>
 *
 * This code has been produced on the BGA studio platform for use on http://boardgamearena.com.
 * See http://en.boardgamearena.com/#!doc/Studio for more information.
 * -----
 */
declare(strict_types=1);

namespace Bga\Games\minirailsmospinach\States;

use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\Games\minirailsmospinach\Game;

/**
 * Action Phase — one player's turn.
 *
 * ⚠️ NOT IMPLEMENTED YET. This slice covers setup and the Draw Phase only, so the table stops here
 * with the board drawn and nothing to click. The two actions come next:
 *
 *   actBuyShare(discId)          take a market disc onto your Profit Board at value 0
 *   actBuildTrack(discId, hexId) place a market disc on an empty hex adjacent to its own colour,
 *                                then move EVERY stock of that colour by the hex's printed value
 *
 * Both first replace the chosen market disc with the player's leftmost order-track marker, and each
 * player must take each action exactly once per round.
 *
 * The id stays 10 — the same value BGA's skeleton used — so the file overwrites the skeleton's on
 * deploy rather than leaving an orphan behind with a colliding state id.
 */
class PlayerTurn extends GameState
{
    function __construct(
        protected Game $game,
    ) {
        parent::__construct($game,
            id: 10,
            type: StateType::ACTIVE_PLAYER,
        );
    }

    public function getArgs(): array
    {
        return [
            'round'       => $this->game->currentRound(),
            'trackLength' => $this->game->trackLength(),
        ];
    }

    /**
     * With no actions declared yet, a disconnected player would otherwise stall the table. Ending the
     * turn is the only honest thing available until the real actions exist.
     */
    function zombie(int $playerId)
    {
        return NextPlayer::class;
    }
}
