import { ErrorMessageType, YGOProStocErrorMsg } from "ygopro-msg-encode";

import { ygopro } from "../../idl/ocgcore";
import { StocAdapter, YgoProPacket } from "../packet";
import { decodeStoc } from "./decode";

function toProtoErrorType(
  errorType: ErrorMessageType,
): ygopro.StocErrorMsg.ErrorType {
  switch (errorType) {
    case ErrorMessageType.JOINERROR:
      return ygopro.StocErrorMsg.ErrorType.JOINERROR;
    case ErrorMessageType.DECKERROR:
      return ygopro.StocErrorMsg.ErrorType.DECKERROR;
    case ErrorMessageType.SIDEERROR:
      return ygopro.StocErrorMsg.ErrorType.SIDEERROR;
    case ErrorMessageType.VERERROR:
      return ygopro.StocErrorMsg.ErrorType.VERSIONERROR;
    default:
      return ygopro.StocErrorMsg.ErrorType.UNKNOWN;
  }
}

/*
 * STOC Error Msg
 *
 * @usage - 后端传来的错误信息
 * */

export default class ErrorMsg implements StocAdapter {
  packet: YgoProPacket;

  constructor(packet: YgoProPacket) {
    this.packet = packet;
  }

  upcast(): ygopro.YgoStocMsg {
    const protocol = decodeStoc(this.packet, YGOProStocErrorMsg);

    return new ygopro.YgoStocMsg({
      stoc_error_msg: new ygopro.StocErrorMsg({
        error_type: toProtoErrorType(protocol.msg),
        error_code: protocol.code,
      }),
    });
  }
}
