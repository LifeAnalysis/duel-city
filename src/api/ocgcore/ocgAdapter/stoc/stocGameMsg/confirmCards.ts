import { ygopro } from "../../../idl/ocgcore";
import { BufferReaderExt } from "../../bufferIO";
import { numberToCardZone } from "../../util";
import MsgConfirmCards = ygopro.StocGameMessage.MsgConfirmCards;

/*
 * Msg Confirm Cards
 *
 * @usage - 确认卡片（展示手牌、确认盖卡等）
 * */
export default (data: Uint8Array, isDeckTop = false) => {
  const reader = new BufferReaderExt(data);

  const player = reader.inner.readUint8();
  if (isDeckTop) {
    const count = reader.inner.readUint8();
    const cards: ygopro.CardInfo[] = [];

    for (let i = 0; i < count; i++) {
      const code = reader.inner.readUint32();
      const controller = reader.inner.readUint8();
      const location = reader.inner.readUint8();
      const sequence = reader.inner.readUint8();

      cards.push(
        new ygopro.CardInfo({
          code,
          controller,
          location: numberToCardZone(location) ?? ygopro.CardZone.DECK,
          sequence,
        }),
      );
    }

    const msg = new MsgConfirmCards({
      player,
      cards,
    });
    (msg as MsgConfirmCards & { is_decktop?: boolean }).is_decktop = true;
    return msg;
  }

  // 新协议在 player 和 count 之间增加了一个字节，用途暂不明确。
  // 参考 C# 实现：
  //   if (condition != Condition.Replay || CurrentReplayUseYRP2)
  //       reader.ReadByte();
  // C# 中在非回放模式或使用 YRP2 格式回放时会跳过这个字节。
  // 如果后续需要支持旧版回放文件，可能需要加条件判断。
  reader.inner.readUint8();
  const count = reader.inner.readUint8();

  const cards: ygopro.CardInfo[] = [];
  for (let i = 0; i < count; i++) {
    cards.push(reader.readCardInfo());
  }

  return new MsgConfirmCards({
    player,
    cards,
  });
};
