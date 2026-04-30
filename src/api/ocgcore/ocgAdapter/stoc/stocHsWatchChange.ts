import { YGOProStocHsWatchChange } from "ygopro-msg-encode";

import { ygopro } from "../../idl/ocgcore";
import { StocAdapter, YgoProPacket } from "../packet";
import { decodeStoc } from "./decode";

/*
 * STOC HsWatchChange
 *
 * @param count: unsigned short - 观观者数量
 *
 * @usage - 更新观战者数量
 * */
export default class HsWatchChangeAdapter implements StocAdapter {
  packet: YgoProPacket;

  constructor(packet: YgoProPacket) {
    this.packet = packet;
  }

  upcast(): ygopro.YgoStocMsg {
    const protocol = decodeStoc(this.packet, YGOProStocHsWatchChange);

    return new ygopro.YgoStocMsg({
      stoc_hs_watch_change: new ygopro.StocHsWatchChange({
        count: protocol.watch_count,
      }),
    });
  }
}
