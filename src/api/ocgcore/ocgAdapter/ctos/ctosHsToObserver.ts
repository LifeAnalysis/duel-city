import { YGOProCtosHsToObserver } from "ygopro-msg-encode";

import { ygopro } from "../../idl/ocgcore";
import { YgoProPacket } from "../packet";
import { encodeCtos } from "./encode";

/*
 * CTOS HsReady
 *
 * @usage - 告诉ygopro服务端当前玩家进入观战者行列
 * */
export default class CtosHsToObserver extends YgoProPacket {
  constructor(_: ygopro.YgoCtosMsg) {
    super(...encodeCtos(new YGOProCtosHsToObserver()));
  }
}
