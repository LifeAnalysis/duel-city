import { YGOProStocHandResult } from "ygopro-msg-encode";

import { ygopro } from "../../idl/ocgcore";
import { StocAdapter, YgoProPacket } from "../packet";
import { decodeStoc } from "./decode";

/*
 * STOC HandResult
 *
 * @usage - 后端告诉前端玩家们的猜拳选择
 * */
export default class SelectHand implements StocAdapter {
  packet: YgoProPacket;

  constructor(packet: YgoProPacket) {
    this.packet = packet;
  }

  upcast(): ygopro.YgoStocMsg {
    const protocol = decodeStoc(this.packet, YGOProStocHandResult);

    return new ygopro.YgoStocMsg({
      stoc_hand_result: new ygopro.StocHandResult({
        meResult: protocol.res1,
        opResult: protocol.res2,
      }),
    });
  }
}
