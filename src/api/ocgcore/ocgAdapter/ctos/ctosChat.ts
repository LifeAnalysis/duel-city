import { YGOProCtosChat } from "ygopro-msg-encode";

import { ygopro } from "../../idl/ocgcore";
import { YgoProPacket } from "../packet";
import { encodeCtos } from "./encode";

/*
 * CTOS Chat
 *
 * @param message - 玩家发送的消息
 *
 * @usage - TODO*/
export default class CtosChat extends YgoProPacket {
  constructor(pb: ygopro.YgoCtosMsg) {
    const protocol = new YGOProCtosChat();
    protocol.msg = pb.ctos_chat.message;

    super(...encodeCtos(protocol));
  }
}
