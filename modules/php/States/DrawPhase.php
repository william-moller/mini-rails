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
use Bga\Games\minirailsmospinach\Material;

/**
 * Draw Phase — the first of each round's three phases.
 *
 * 1. Draw 2*players+1 discs from the bag onto the (empty) market track, left to right.
 * 2. All players take their two action tiles back.
 *
 * Then the Action Phase begins with the owner of the leftmost order-track marker.
 */
class DrawPhase extends GameState
{
    function __construct(
        protected Game $game,
    ) {
        parent::__construct($game,
            id: 5,
            type: StateType::GAME,
            updateGameProgression: true,
        );
    }

    function onEnteringState()
    {
        $round = $this->game->currentRound() + 1;

        // The game lasts exactly 6 rounds — the taxed area holds one disc per round and fills as the
        // bag empties, so both run out together.
        if ($round > Material::ROUNDS) {
            return EndScore::class;
        }

        $this->game->setRound($round);

        $placed = $this->game->drawMarket();
        $this->game->resetActionTiles();

        $this->bga->notify->all('marketDrawn', clienttranslate('Round ${round} of ${rounds}: ${count} discs drawn to the market track'), [
            'round'  => $round,
            'rounds' => Material::ROUNDS,
            'count'  => count($placed),
            'discs'  => $placed,
            'bagCount' => $this->game->bagCount(),
        ]);

        $this->game->activateFirstOrderPlayer();

        return PlayerTurn::class;
    }
}
