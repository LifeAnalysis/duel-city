import type { YGOProCtosBase } from "ygopro-msg-encode";

import { YgoProPacket } from "../packet";

export function encodeCtos(
  protocol: YGOProCtosBase,
): [number, number, Uint8Array, Uint8Array] {
  const packet = YgoProPacket.fromFullPayload(protocol.toFullPayload());

  return [packet.packetLen, packet.proto, packet.exData, packet.serialize()];
}
