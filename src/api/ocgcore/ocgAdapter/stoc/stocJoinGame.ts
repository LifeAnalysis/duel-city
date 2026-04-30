import { YGOProStocJoinGame } from "ygopro-msg-encode";

import { ygopro } from "../../idl/ocgcore";
import { StocAdapter, YgoProPacket } from "../packet";
import { decodeStoc } from "./decode";

/*
 * STOC JoinGame
 *
 * @usage - 告知客户端/前端已成功加入房间
 * */
export default class JoinGameAdapter implements StocAdapter {
  packet: YgoProPacket;

  constructor(packet: YgoProPacket) {
    this.packet = packet;
  }

  upcast(): ygopro.YgoStocMsg {
    const protocol = decodeStoc(this.packet, YGOProStocJoinGame);
    const info = protocol.info;

    return new ygopro.YgoStocMsg({
      stoc_join_game: new ygopro.StocJoinGame({
        lflist: info.lflist,
        rule: info.rule,
        mode: info.mode,
        duel_rule: info.duel_rule,
        no_check_deck: info.no_check_deck !== 0,
        no_shuffle_deck: info.no_shuffle_deck !== 0,
        start_lp: info.start_lp,
        start_hand: info.start_hand,
        draw_count: info.draw_count,
        time_limit: info.time_limit,
      }),
    });
  }
}
