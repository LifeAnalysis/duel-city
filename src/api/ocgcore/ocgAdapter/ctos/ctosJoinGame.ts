import { YGOProCtosJoinGame } from "ygopro-msg-encode";

import { ygopro } from "../../idl/ocgcore";
import { YgoProPacket } from "../packet";
import { encodeCtos } from "./encode";

/*
 * CTOS JoinGame
 *
 * @param version: unsigned short - 版本号
 * @param align: unsigned short - 对齐填充
 * @param gameid: unsigned int - 永远是0
 * @param passWd: [unsigned short; 20] - 房间密码
 *
 * @usage - 加入房间
 * */
export default class CtosJoinGamePacket extends YgoProPacket {
  constructor(pb: ygopro.YgoCtosMsg) {
    const joinGame = pb.ctos_join_game;
    const protocol = new YGOProCtosJoinGame();
    protocol.version = joinGame.version;
    protocol.gameid = joinGame.gameid;
    protocol.pass = joinGame.passwd;

    super(...encodeCtos(protocol));
  }
}
