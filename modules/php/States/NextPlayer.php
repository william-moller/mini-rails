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
 * ⚠️ PARTIAL. Properly, a turn moves the player's leftmost order-track marker ONTO the market track,
 * into the slot of the disc they chose — which is what turns this round's market track into next
 * round's order track. That choice belongs to the actions, which are not written yet, so for now the
 * marker is simply consumed. That keeps the round advancing and, more importantly, keeps this state
 * from looping forever: PlayerTurn's zombie routes here, and if nothing were consumed the same player
 * would be reactivated indefinitely.
 *
 * When the actions land, replace the delete with a move to ('market', chosenSlot) and route the empty
 * order track to the Taxation Phase rather than straight back to the Draw Phase.
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
        $this->game->consumeFirstOrderMarker();

        if ($this->game->activateFirstOrderPlayer()) {
            return PlayerTurn::class;
        }

        // Order track empty: the round is over. The Taxation Phase belongs here once it exists.
        return DrawPhase::class;
    }
}
