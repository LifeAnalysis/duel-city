import { YGOProStocTypeChange } from "ygopro-msg-encode";

import { ygopro } from "../../idl/ocgcore";
import { StocAdapter, YgoProPacket } from "../packet";
import { decodeStoc } from "./decode";

/*
 * STOC TypeChange
 *
 * @param todo
 *
 * @usage - 更新玩家状态
 * */
export default class TypeChangeAdapter implements StocAdapter {
  packet: YgoProPacket;

  constructor(packet: YgoProPacket) {
    this.packet = packet;
  }

  upcast(): ygopro.YgoStocMsg {
    const protocol = decodeStoc(this.packet, YGOProStocTypeChange);
    const playerPosition = protocol.playerPosition;

    let selfType = ygopro.StocTypeChange.SelfType.UNKNOWN;
    switch (playerPosition) {
      case 0: {
        selfType = ygopro.StocTypeChange.SelfType.PLAYER1;

        break;
      }
      case 1: {
        selfType = ygopro.StocTypeChange.SelfType.PLAYER2;

        break;
      }
      case 2: {
        selfType = ygopro.StocTypeChange.SelfType.PLAYER3;

        break;
      }
      case 3: {
        selfType = ygopro.StocTypeChange.SelfType.PLAYER4;

        break;
      }
      case 4: {
        selfType = ygopro.StocTypeChange.SelfType.PLAYER5;

        break;
      }
      case 5: {
        selfType = ygopro.StocTypeChange.SelfType.PLAYER6;

        break;
      }
      case 7: {
        selfType = ygopro.StocTypeChange.SelfType.OBSERVER;

        break;
      }
    }

    return new ygopro.YgoStocMsg({
      stoc_type_change: new ygopro.StocTypeChange({
        self_type: selfType,
        is_host: protocol.isHost,
      }),
    });
  }
}
