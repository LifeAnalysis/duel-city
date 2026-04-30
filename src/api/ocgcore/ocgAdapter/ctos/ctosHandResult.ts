import { HandResult, YGOProCtosHandResult } from "ygopro-msg-encode";

import { ygopro } from "../../idl/ocgcore";
import { YgoProPacket } from "../packet";
import { encodeCtos } from "./encode";

/*
 * CTOS HandResult
 *
 * @param res: unsigned char - 玩家的猜拳选择
 *
 * @usage - 告知服务端当前玩家的猜拳选择
 * */
export default class CtosHandResultPacket extends YgoProPacket {
  constructor(pb: ygopro.YgoCtosMsg) {
    const handResult = pb.ctos_hand_result;
    const protocol = new YGOProCtosHandResult();

    switch (handResult.hand) {
      case ygopro.HandType.SCISSORS: {
        protocol.res = HandResult.SCISSORS;

        break;
      }
      case ygopro.HandType.ROCK: {
        protocol.res = HandResult.ROCK;

        break;
      }
      case ygopro.HandType.PAPER: {
        protocol.res = HandResult.PAPER;

        break;
      }
      default: {
        console.log("Unknown HandResult type" + handResult.hand);
      }
    }

    super(...encodeCtos(protocol));
  }
}
