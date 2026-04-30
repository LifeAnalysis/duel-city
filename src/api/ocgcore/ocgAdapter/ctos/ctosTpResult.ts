import { TurnPlayerResult, YGOProCtosTpResult } from "ygopro-msg-encode";

import { ygopro } from "../../idl/ocgcore";
import { YgoProPacket } from "../packet";
import { encodeCtos } from "./encode";

/*
 * CTOS CTOS_TP_RESULT
 *
 * @param res: unsigned char - 玩家的先后攻选择
 *
 * @usage - 告知服务端当前玩家的先后攻选择
 *
 * */
export default class CtosTpResultPacket extends YgoProPacket {
  constructor(pb: ygopro.YgoCtosMsg) {
    const tpResult = pb.ctos_tp_result;
    const protocol = new YGOProCtosTpResult();

    switch (tpResult.tp) {
      case ygopro.CtosTpResult.TpType.FIRST: {
        protocol.res = TurnPlayerResult.FIRST;

        break;
      }
      case ygopro.CtosTpResult.TpType.SECOND: {
        protocol.res = TurnPlayerResult.SECOND;

        break;
      }
      default: {
        console.log("Unknown TpResult type" + tpResult.tp);
      }
    }

    super(...encodeCtos(protocol));
  }
}
