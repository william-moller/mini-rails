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
 * Advance the Action Phase to the next player, or end the round.
 *
 * The acting player's marker has already left the order track — it moved onto the market track, into
 * the slot of the disc they took, as part of their action. So "whose turn is it" is simply the owner
 * of the leftmost marker still on the order track, and the round ends when none are left.
 *
 * The id stays 90 — BGA's skeleton value — so this file overwrites the skeleton's on deploy instead
 * of leaving an orphan with a colliding state id.
 */
class NextPlayer extends GameState
{
    function __construct(
        protected Game $game,
    ) {
        parent::__construct($game,
            id: 90,
            type: StateType::GAME,
            updateGameProgression: true,
        );
    }

    function onEnteringState(int $activePlayerId)
    {
        $this->game->giveExtraTime($activePlayerId);

        if ($this->game->activateFirstOrderPlayer()) {
            return PlayerTurn::class;
        }

        // Order track empty: every player has acted twice and one disc is left to be taxed.
        return TaxationPhase::class;
    }
}
