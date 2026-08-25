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
 * Taxation Phase — the last of each round's three phases.
 *
 * Every player has now acted twice, so 2n of the market track's 2n+1 slots hold markers and exactly
 * one still holds a disc. That leftover disc is taxed, and the markers left behind — in the order
 * their owners chose them — become next round's order track.
 *
 * This is where the whole game turns: a company with a disc in the taxed area keeps its gains and
 * has its losses wiped at scoring, and a company without one loses its gains and keeps its losses.
 * Which disc is left over is therefore decided by what everybody DIDN'T take.
 */
class TaxationPhase extends GameState
{
    function __construct(
        protected Game $game,
    ) {
        parent::__construct($game,
            id: 20,
            type: StateType::GAME,
            updateGameProgression: true,
        );
    }

    function onEnteringState()
    {
        $leftover = $this->game->leftoverMarketDisc();

        if ($leftover !== null) {
            $slot = $this->game->taxDisc($leftover['id']);

            $this->game->bga->notify->all(
                'discTaxed',
                clienttranslate('${company} is taxed this round'),
                [
                    'company' => $leftover['company'],
                    'discId'  => $leftover['id'],
                    'slot'    => $slot,
                ]
            );
        }

        // The market track, gap closed, becomes the order track for the next round. The discs the
        // players chose this round are therefore what sets next round's turn order.
        $this->game->flipTracks();

        $this->game->bga->notify->all(
            'tracksFlipped',
            clienttranslate('The market track becomes the new turn order'),
            [
                'markers' => $this->game->getMarkers(),
                'round'   => $this->game->currentRound(),
                'rounds'  => Material::ROUNDS,
            ]
        );

        // The taxed area is the clock: one disc lands in it per round. While it still has an empty
        // space another round starts, and it fills exactly as the bag empties.
        return $this->game->taxedAreaFull() ? EndScore::class : DrawPhase::class;
    }
}
