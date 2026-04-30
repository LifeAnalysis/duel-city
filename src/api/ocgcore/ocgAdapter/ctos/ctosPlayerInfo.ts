import { YGOProCtosPlayerInfo } from "ygopro-msg-encode";

import { ygopro } from "../../idl/ocgcore";
import { YgoProPacket } from "../packet";
import { encodeCtos } from "./encode";

/*
 * CTOS PlayerInfo
 *
 * @param player: [unsigned short; 20] - 玩家昵称
 *
 * @usage - 告诉ygopro服务端当前玩家的昵称
 * */
export default class CtosPlayerInfoPacket extends YgoProPacket {
  constructor(pb: ygopro.YgoCtosMsg) {
    const protocol = new YGOProCtosPlayerInfo();
    protocol.name = pb.ctos_player_info.name;

    super(...encodeCtos(protocol));
  }
}
