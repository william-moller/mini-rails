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
use Bga\GameFramework\States\PossibleAction;
use Bga\Games\minirailsmospinach\Game;
use Bga\Games\minirailsmospinach\Material;

/**
 * Action Phase — one player's turn.
 *
 * Both actions open identically: take any disc still on the market track, leaving your leftmost
 * order-track marker in the slot it came from. What differs is where the disc then goes.
 *
 *   actBuyShare(discId)          -> the 0 space of your Profit Board
 *   actBuildTrack(discId, hexId) -> an empty hex adjacent to a disc of its own colour, then move
 *                                   EVERY stock of that colour on EVERY board by the hex's value
 *
 * Across a round each player must take EACH action exactly once, so the second turn's action is
 * forced by the first. The markers left behind on the market track become next round's order track
 * (see TaxationPhase).
 *
 * The id stays 10 — the same value BGA's skeleton used — so the file overwrites the skeleton's on
 * deploy rather than leaving an orphan behind with a colliding state id.
 */
class PlayerTurn extends GameState
{
    /** actBuildTrack's hexId when the company is blocked and the disc goes to its frame instead. */
    private const HEX_FRAME = 0;

    function __construct(
        protected Game $game,
    ) {
        parent::__construct($game,
            id: 10,
            type: StateType::ACTIVE_PLAYER,
            description: clienttranslate('${actplayer} must take a disc from the market track'),
            descriptionMyTurn: clienttranslate('${you} must take a disc from the market track'),
        );
    }

    public function getArgs(): array
    {
        $playerId = (int) $this->game->getActivePlayerId();
        $tiles    = $this->game->actionTilesLeft($playerId);
        $market   = $this->game->availableMarketDiscs();

        // A company with nowhere legal to build goes on its frame for -1 instead. Worked out per
        // company rather than per disc — several market discs can share a colour.
        $legalHexes = [];
        $blocked    = [];
        foreach (array_unique(array_column($market, 'company')) as $company) {
            $legal = $this->game->legalHexIdsFor($company);
            $legalHexes[$company] = $legal;
            $blocked[$company]    = empty($legal);
        }

        return [
            'round'       => $this->game->currentRound(),
            'trackLength' => $this->game->trackLength(),
            'canBuy'      => $tiles['buy'],
            'canBuild'    => $tiles['build'],
            'market'      => array_values($market),
            'legalHexes'  => $legalHexes,
            'blocked'     => $blocked,
        ];
    }

    #[PossibleAction]
    public function actBuyShare(int $discId)
    {
        $playerId = (int) $this->game->getActivePlayerId();

        if (!$this->game->actionTilesLeft($playerId)['buy']) {
            throw new \BgaUserException($this->game->_('You have already bought shares this round.'));
        }

        $disc = $this->game->takeMarketDisc($discId);

        // A share enters at 0 however high or low its company already sits. Buying early versus late
        // is the game, so the value belongs to the stock, never to the company.
        $this->game->discs->moveCard($discId, 'stock_' . $playerId, 0);
        $this->game->spendActionTile($playerId, 'buy');

        $this->game->bga->notify->all(
            'shareBought',
            clienttranslate('${player_name} buys a ${company} share'),
            [
                'player_id'   => $playerId,
                'player_name' => $this->game->getActivePlayerName(),
                'company'     => $disc['company'],
                'discId'      => $discId,
                'slot'        => $disc['slot'],
                'value'       => 0,
            ]
        );

        return NextPlayer::class;
    }

    #[PossibleAction]
    public function actBuildTrack(int $discId, int $hexId)
    {
        $playerId = (int) $this->game->getActivePlayerId();

        if (!$this->game->actionTilesLeft($playerId)['build']) {
            throw new \BgaUserException($this->game->_('You have already built track this round.'));
        }

        // Validate everything BEFORE the marker moves, so a rejected click cannot half-apply a turn.
        $market = $this->game->availableMarketDiscs();
        if (!isset($market[$discId])) {
            throw new \BgaUserException($this->game->_('That disc is no longer on the market track.'));
        }
        $company = $market[$discId]['company'];
        $legal   = $this->game->legalHexIdsFor($company);

        if ($hexId === self::HEX_FRAME) {
            // The frame is only available while the company has NOWHERE legal to build.
            if (!empty($legal)) {
                throw new \BgaUserException(
                    $this->game->_('That company can still be built on the map, so it cannot go on its frame.')
                );
            }
        } elseif (!in_array($hexId, $legal, true)) {
            throw new \BgaUserException(
                $this->game->_('You must build on an empty hex next to a disc of the same colour.')
            );
        }

        $disc = $this->game->takeMarketDisc($discId);

        if ($hexId === self::HEX_FRAME) {
            $this->game->discs->moveCard($discId, 'frame', 0);
            $delta   = -1;
            $terrain = null;
        } else {
            $hexes   = $this->game->getHexes();
            $terrain = $hexes[$hexId]['terrain'];
            $delta   = Material::TERRAIN_VALUE[$terrain];
            $this->game->discs->moveCard($discId, 'hex', $hexId);
        }

        $this->game->moveStocks($company, $delta);
        $this->game->spendActionTile($playerId, 'build');

        $message = $hexId === self::HEX_FRAME
            ? clienttranslate('${player_name} finds nowhere to build ${company} — it goes on the frame for ${delta}')
            : clienttranslate('${player_name} builds ${company} track on ${terrain} for ${delta}');

        $this->game->bga->notify->all('trackBuilt', $message, [
            'player_id'   => $playerId,
            'player_name' => $this->game->getActivePlayerName(),
            'company'     => $company,
            'terrain'     => $terrain ?? '',
            'discId'      => $discId,
            'slot'        => $disc['slot'],
            'hexId'       => $hexId === self::HEX_FRAME ? null : $hexId,
            'onFrame'     => $hexId === self::HEX_FRAME,
            'delta'       => $delta > 0 ? '+' . $delta : (string) $delta,
            'stocks'      => $this->game->stocksOf($company),
        ]);

        return NextPlayer::class;
    }

    /**
     * A disconnected player still has to take a legal turn or the round cannot finish. Buying is the
     * safest automatic choice — it touches only the zombie's own board, where building would move
     * every other player's stocks too. If Buy is already spent, build on the first legal hex.
     */
    function zombie(int $playerId)
    {
        $market = $this->game->availableMarketDiscs();
        if (empty($market)) {
            return NextPlayer::class;
        }
        $disc = array_values($market)[0];

        if ($this->game->actionTilesLeft($playerId)['buy']) {
            return $this->actBuyShare($disc['id']);
        }

        $legal = $this->game->legalHexIdsFor($disc['company']);
        return $this->actBuildTrack($disc['id'], empty($legal) ? self::HEX_FRAME : $legal[0]);
    }
}
