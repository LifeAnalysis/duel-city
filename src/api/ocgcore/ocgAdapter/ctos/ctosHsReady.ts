import { YGOProCtosHsReady } from "ygopro-msg-encode";

import { ygopro } from "../../idl/ocgcore";
import { YgoProPacket } from "../packet";
import { encodeCtos } from "./encode";

/*
 * CTOS HsReady
 *
 * @usage - 告诉ygopro服务端当前玩家准备完毕
 * */
export default class CtosHsReady extends YgoProPacket {
  constructor(_: ygopro.YgoCtosMsg) {
    super(...encodeCtos(new YGOProCtosHsReady()));
  }
}
