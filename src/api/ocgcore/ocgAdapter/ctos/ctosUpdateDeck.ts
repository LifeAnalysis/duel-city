import YGOProDeck from "ygopro-deck-encode";
import { YGOProCtosUpdateDeck } from "ygopro-msg-encode";

import { ygopro } from "../../idl/ocgcore";
import { YgoProPacket } from "../packet";
import { encodeCtos } from "./encode";

/*
 * CTOS UpdateDeck
 *
 * @param main: unsigned int - 主卡组数目
 * @param extra: unsigned int - 额外卡组数目
 * @param side: unsigned int - 副卡组数目
 * @param mainCards: [unsigned int; main] - 主卡组数据
 * @param extraCards: [unsigned int; extra] - 额外卡组数据
 * @param side: [unsigned int; side] - 副卡组数据
 *
 * @usage - 更新对局的卡组信息
 * */
export default class CtosUpdateDeck extends YgoProPacket {
  constructor(pb: ygopro.YgoCtosMsg) {
    const updateDeck = pb.ctos_update_deck;
    const protocol = new YGOProCtosUpdateDeck();
    protocol.deck = new YGOProDeck({
      main: updateDeck.main,
      extra: updateDeck.extra,
      side: updateDeck.side,
    });

    super(...encodeCtos(protocol));
  }
}
