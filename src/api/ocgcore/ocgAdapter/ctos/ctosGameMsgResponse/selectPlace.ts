import { BufferWriter } from "@/infra";

import { ygopro } from "../../../idl/ocgcore";
import { cardZoneToNumber } from "../../util";

export default (response: ygopro.CtosGameMsgResponse.SelectPlaceResponse) => {
  const writer = new BufferWriter();
  const places =
    response.places.length > 0
      ? response.places
      : [
          new ygopro.CtosGameMsgResponse.SelectPlaceResponse.Place({
            player: response.player,
            zone: response.zone,
            sequence: response.sequence,
          }),
        ];

  for (const place of places) {
    writer.writeUint8(place.player);
    writer.writeUint8(cardZoneToNumber(place.zone));
    writer.writeUint8(place.sequence);
  }

  return writer.toArray();
};
