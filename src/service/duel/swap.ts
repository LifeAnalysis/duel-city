import { fetchCard, ygopro } from "@/api";
import { Container } from "@/container";
import { callCardMove } from "@/ui/Duel/PlayMat/Card";

import { fetchEsHintMeta } from "./util";

export default async (
  container: Container,
  swap: ygopro.StocGameMessage.MsgSwap,
) => {
  fetchEsHintMeta({ context: container.context, originMsg: 1602 });

  const { code1, code2, location1, location2 } = swap;
  if (!swap.has_location1 || !swap.has_location2) return;

  const context = container.context;
  const card1 = context.cardStore.find(location1);
  const card2 = context.cardStore.find(location2);

  if (!card1 || !card2) {
    console.warn("<Swap>card is null");
    return;
  }

  const card1Overlays = context.cardStore.findOverlay(
    location1.zone,
    location1.controller,
    location1.sequence,
  );
  const card2Overlays = context.cardStore.findOverlay(
    location2.zone,
    location2.controller,
    location2.sequence,
  );

  if (code1 && code1 > 0) {
    card1.code = code1;
    card1.meta = fetchCard(code1);
  }
  if (code2 && code2 > 0) {
    card2.code = code2;
    card2.meta = fetchCard(code2);
  }

  card1.location = location2;
  card2.location = location1;

  for (const overlay of card1Overlays) {
    overlay.location.controller = location2.controller;
    overlay.location.zone = location2.zone;
    overlay.location.sequence = location2.sequence;
    overlay.location.position = location2.position;
  }
  for (const overlay of card2Overlays) {
    overlay.location.controller = location1.controller;
    overlay.location.zone = location1.zone;
    overlay.location.sequence = location1.sequence;
    overlay.location.position = location1.position;
  }

  await Promise.all(
    [card1, card2, ...card1Overlays, ...card2Overlays].map((card) =>
      callCardMove(card.uuid),
    ),
  );
};
