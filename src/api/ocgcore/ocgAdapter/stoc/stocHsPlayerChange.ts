import { YGOProStocHsPlayerChange } from "ygopro-msg-encode";

import { ygopro } from "../../idl/ocgcore";
import { StocAdapter, YgoProPacket } from "../packet";
import { decodeStoc } from "./decode";

/*
 * STOC HsPlayerChange
 *
 * @param todo
 *
 * @usage - 更新玩家状态
 * */
export default class HsPlayerChangeAdapter implements StocAdapter {
  packet: YgoProPacket;

  constructor(packet: YgoProPacket) {
    this.packet = packet;
  }

  upcast(): ygopro.YgoStocMsg {
    const pb = new ygopro.StocHsPlayerChange({});
    pb.state = ygopro.StocHsPlayerChange.State.UNKNOWN;

    const protocol = decodeStoc(this.packet, YGOProStocHsPlayerChange);
    const pos = protocol.playerPosition;
    const state = protocol.playerState;

    pb.pos = pos;

    if (pos < 4) {
      if (state < 8) {
        pb.state = ygopro.StocHsPlayerChange.State.MOVE;
        pb.moved_pos = state;
      } else if (state === 0x9) {
        pb.state = ygopro.StocHsPlayerChange.State.READY;
      } else if (state === 0xa) {
        pb.state = ygopro.StocHsPlayerChange.State.NO_READY;
      } else if (state === 0xb) {
        pb.state = ygopro.StocHsPlayerChange.State.LEAVE;
      } else if (state === 0x8) {
        pb.state = ygopro.StocHsPlayerChange.State.TO_OBSERVER;
      }
    }

    return new ygopro.YgoStocMsg({
      stoc_hs_player_change: pb,
    });
  }
}
