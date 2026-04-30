import { YGOProStocChat } from "ygopro-msg-encode";

import { ygopro } from "../../idl/ocgcore";
import { StocAdapter, YgoProPacket } from "../packet";
import { decodeStoc } from "./decode";

/*
 * STOC Chat
 *
 * @param player: unsigned short - 玩家编号
 * @param message: [unsigned short] - 聊天消息文本
 *
 * @usage - 更新聊天消息
 * */
export default class ChatAdapter implements StocAdapter {
  packet: YgoProPacket;

  constructor(packet: YgoProPacket) {
    this.packet = packet;
  }

  upcast(): ygopro.YgoStocMsg {
    const protocol = decodeStoc(this.packet, YGOProStocChat);

    return new ygopro.YgoStocMsg({
      stoc_chat: new ygopro.StocChat({
        player: protocol.player_type,
        msg: protocol.msg,
      }),
    });
  }
}
