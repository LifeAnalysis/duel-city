import { YGOProStocHsPlayerEnter } from "ygopro-msg-encode";

import { ygopro } from "../../idl/ocgcore";
import { StocAdapter, YgoProPacket } from "../packet";
import { decodeStoc } from "./decode";

/*
 * STOC HsPlayerEnter
 *
 * @param name: [unsigned short; 20] - 玩家昵称
 * @param pos: unsigned chat - 玩家进入房间的位置
 *
 * @usage - 有新玩家进入房间，更新状态
 * */
export default class HsPlayerEnterAdapter implements StocAdapter {
  packet: YgoProPacket;

  constructor(packet: YgoProPacket) {
    this.packet = packet;
  }

  upcast(): ygopro.YgoStocMsg {
    const protocol = decodeStoc(this.packet, YGOProStocHsPlayerEnter);

    return new ygopro.YgoStocMsg({
      stoc_hs_player_enter: new ygopro.StocHsPlayerEnter({
        name: protocol.name,
        pos: protocol.pos & 0x3,
      }),
    });
  }
}
