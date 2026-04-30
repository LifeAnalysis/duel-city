import { YGOProStocDeckCount } from "ygopro-msg-encode";

import { ygopro } from "../../idl/ocgcore";
import { StocAdapter, YgoProPacket } from "../packet";
import { decodeStoc } from "./decode";

/*
 * STOC DeckCount
 *
 * @param see ocgcore.proto
 *
 * @usage - 展示双方卡组信息
 * */

export default class DeckCountAdapter implements StocAdapter {
  packet: YgoProPacket;

  constructor(packet: YgoProPacket) {
    this.packet = packet;
  }

  upcast(): ygopro.YgoStocMsg {
    const protocol = decodeStoc(this.packet, YGOProStocDeckCount);
    const pb = new ygopro.StocDeckCount({});

    pb.meMain = protocol.player0DeckCount.main;
    pb.meExtra = protocol.player0DeckCount.extra;
    pb.meSide = protocol.player0DeckCount.side;
    pb.opMain = protocol.player1DeckCount.main;
    pb.opExtra = protocol.player1DeckCount.extra;
    pb.opSide = protocol.player1DeckCount.side;

    return new ygopro.YgoStocMsg({
      stoc_deck_count: pb,
    });
  }
}
