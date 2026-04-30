import type { YGOProStocBase } from "ygopro-msg-encode";

import type { YgoProPacket } from "../packet";

type StocProtocol<T extends YGOProStocBase> = new () => T;

export function decodeStoc<T extends YGOProStocBase>(
  packet: YgoProPacket,
  Protocol: StocProtocol<T>,
): T {
  return new Protocol().fromPayload(packet.exData);
}
