import { YGOProCtosHsToDuelist } from "ygopro-msg-encode";

import { ygopro } from "../../idl/ocgcore";
import { YgoProPacket } from "../packet";
import { encodeCtos } from "./encode";

/*
 * CTOS HsReady
 *
 * @usage - 告诉ygopro服务端当前玩家进入决斗者行列
 * */
export default class CtosHsToDuelList extends YgoProPacket {
  constructor(_: ygopro.YgoCtosMsg) {
    super(...encodeCtos(new YGOProCtosHsToDuelist()));
  }
}
