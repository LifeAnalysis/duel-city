import { YGOProCtosSurrender } from "ygopro-msg-encode";

import { ygopro } from "../../idl/ocgcore";
import { YgoProPacket } from "../packet";
import { encodeCtos } from "./encode";

/*
 * CTOS SURRENDER
 *
 * @param - null
 *
 * @usage - 告知服务端当前玩家投降
 *
 * */
export default class CtosSurrender extends YgoProPacket {
  constructor(_: ygopro.YgoCtosMsg) {
    super(...encodeCtos(new YGOProCtosSurrender()));
  }
}
