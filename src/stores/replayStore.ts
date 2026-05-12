import { proxy, ref } from "valtio";

import { YgoProPacket } from "@/api/ocgcore/ocgAdapter/packet";

import { type NeosStore } from "./shared";

// 对局中每一次状态改变的记录
interface ReplaySpot {
  packet: ReplayPacket; // 将会保存在回放文件中的数据
}

// 保存回放信息的数据包
interface ReplayPacket {
  func: number; // 对应的`GAME_MSG`编号
  extraData: ArrayBuffer;
}

// 保存对局回放数据的`Store`
class ReplayStore implements NeosStore {
  isReplay: boolean = false; // 是否进入了回放模式
  paused: boolean = false;
  waiting: boolean = false;
  currentIndex: number = -1;
  inner: ReplaySpot[] = ref([]);
  advanceResolvers: (() => void)[] = ref([]);

  beginReplay() {
    this.releaseAll();
    this.isReplay = true;
    this.paused = false;
    this.waiting = false;
    this.currentIndex = -1;
    this.advanceResolvers.splice(0);
  }

  record(ygoPacket: YgoProPacket) {
    this.inner.push({
      packet: ygoPacket2replayPacket(ygoPacket),
    });
  }

  pause() {
    if (!this.isReplay) return;
    this.paused = true;
  }

  resume() {
    this.paused = false;
    this.waiting = false;
    this.releaseAll();
  }

  advance(steps = 1) {
    if (!this.isReplay || !this.paused) return;
    Array.from({ length: steps }).forEach(() => this.releaseOne());
  }

  async waitForAdvance() {
    if (!this.isReplay || !this.paused) return;

    this.waiting = true;
    await new Promise<void>((resolve) => {
      this.advanceResolvers.push(resolve);
    });
    this.waiting = this.advanceResolvers.length > 0;
  }

  markAdvanced() {
    if (this.isReplay) this.currentIndex += 1;
  }

  encode(): ArrayBuffer[] {
    return this.inner.map((spot) => spot.packet).map(replayPacket2arrayBuffer);
  }
  reset() {
    this.releaseAll();
    this.inner.splice(0);
    this.isReplay = false;
    this.paused = false;
    this.waiting = false;
    this.currentIndex = -1;
    this.advanceResolvers.splice(0);
  }

  private releaseOne() {
    const resolve = this.advanceResolvers.shift();
    if (resolve) {
      resolve();
      this.waiting = this.advanceResolvers.length > 0;
    }
  }

  private releaseAll() {
    while (this.advanceResolvers.length) {
      this.advanceResolvers.shift()?.();
    }
  }
}

const ygoPacket2replayPacket = (ygoPacket: YgoProPacket) => ({
  func: ygoPacket.exData[0],
  extraData: ygoPacket.exData.slice(1),
});

const replayPacket2arrayBuffer = (replayPacket: ReplayPacket) => {
  const { func, extraData } = replayPacket;
  const packetLen = 1 + 4 + extraData.byteLength;
  const array = new Uint8Array(packetLen);
  const dataview = new DataView(array.buffer);

  dataview.setUint8(0, func);
  dataview.setUint32(1, extraData.byteLength, true);
  array.set(new Uint8Array(extraData), 5);

  return array.buffer;
};

export const replayStore = proxy(new ReplayStore());
