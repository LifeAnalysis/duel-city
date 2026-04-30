import { YGOProCtosHsNotReady } from "ygopro-msg-encode";

import { ygopro } from "../../idl/ocgcore";
import { YgoProPacket } from "../packet";
import { encodeCtos } from "./encode";

/*
 * CTOS HsReady
 *
 * @usage - 告诉ygopro服务端当前玩家取消准备
 * */
export default class CtosHsNotReady extends YgoProPacket {
  constructor(_: ygopro.YgoCtosMsg) {
    super(...encodeCtos(new YGOProCtosHsNotReady()));
  }
}
