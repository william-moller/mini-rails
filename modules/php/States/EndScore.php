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
use Bga\Games\minirailsmospinach\Game;

const ST_END_GAME = 99;

/**
 * Final scoring, once the taxed area is full.
 *
 * Every player holds six stocks — one Buy per round. Each is kept or discarded depending on whether
 * its company was taxed, and the survivors are summed:
 *
 *   company WAS taxed      -> discard its stocks in the LOSS zone   (it cannot cost you points)
 *   company was NOT taxed  -> discard its stocks in the PROFIT zone (it cannot earn you any)
 *
 * Whether a company was taxed is a matter of presence, not count — one disc in the taxed area is
 * worth exactly as much as three.
 *
 * The arithmetic lives in Game::scoreFinal(). Note that DbQuery is a static on Table, so a GameState
 * cannot call it via static:: — keeping the work on Game avoids that trap entirely.
 */
class EndScore extends \Bga\GameFramework\States\GameState
{
    function __construct(
        protected Game $game,
    ) {
        parent::__construct($game,
            id: 98,
            type: StateType::GAME,
        );
    }

    public function onEnteringState()
    {
        $taxed  = $this->game->taxedCompanies();
        $scores = $this->game->scoreFinal();

        $this->game->bga->notify->all(
            'finalScored',
            clienttranslate('Taxed companies: ${taxedList}'),
            [
                'taxedList' => implode(', ', $taxed) ?: 'none',
                'taxed'     => $taxed,
                'scores'    => $scores,
            ]
        );

        foreach ($scores as $playerId => $breakdown) {
            $this->game->bga->notify->all(
                'scoreBreakdown',
                clienttranslate('${player_name} scores ${score}'),
                [
                    'player_id'   => $playerId,
                    'player_name' => $this->game->getPlayerNameById($playerId),
                    'score'       => $breakdown['score'],
                    'kept'        => $breakdown['kept'],
                    'removed'     => $breakdown['removed'],
                ]
            );
        }

        return ST_END_GAME;
    }
}
