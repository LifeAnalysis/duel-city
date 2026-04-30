import { YGOProCtosHsStart } from "ygopro-msg-encode";

import { ygopro } from "../../idl/ocgcore";
import { YgoProPacket } from "../packet";
import { encodeCtos } from "./encode";

/*
 * CTOS HsStart
 *
 * @usage - 开始游戏对局
 * */
export default class CtosHsStartPacket extends YgoProPacket {
  constructor(_: ygopro.YgoCtosMsg) {
    super(...encodeCtos(new YGOProCtosHsStart()));
  }
}
