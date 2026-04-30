import { YGOProStocTimeLimit } from "ygopro-msg-encode";

import { ygopro } from "../../idl/ocgcore";
import { StocAdapter, YgoProPacket } from "../packet";
import { decodeStoc } from "./decode";

/*
 * STOC TimeLimit
 *
 * @usage - 同时客户端/前端时间限制
 * */

export default class TimeLimit implements StocAdapter {
  packet: YgoProPacket;

  constructor(packet: YgoProPacket) {
    this.packet = packet;
  }

  upcast(): ygopro.YgoStocMsg {
    const protocol = decodeStoc(this.packet, YGOProStocTimeLimit);

    return new ygopro.YgoStocMsg({
      stoc_time_limit: new ygopro.StocTimeLimit({
        player: protocol.player,
        left_time: protocol.left_time,
      }),
    });
  }
}
