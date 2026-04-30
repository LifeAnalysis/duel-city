import { YGOProCtosTimeConfirm } from "ygopro-msg-encode";

import { ygopro } from "../../idl/ocgcore";
import { YgoProPacket } from "../packet";
import { encodeCtos } from "./encode";

/*
 * CTOS CTOS_TIME_CONFIRM
 *
 * @param - null
 *
 * @usage - 确认计时？
 *
 * */
export default class CtosTimeConfirm extends YgoProPacket {
  constructor(_: ygopro.YgoCtosMsg) {
    super(...encodeCtos(new YGOProCtosTimeConfirm()));
  }
}
