import {
  MSG_DAMAGE,
  MSG_NEW_PHASE,
  MSG_NEW_TURN,
  MSG_RECOVER,
  MSG_START,
} from "@/api/ocgcore/ocgAdapter/protoDecl";
import { getUIContainer, initUIContainer } from "@/container/compat";
import { initReplaySocket } from "@/middleware/socket";
import { pollSocketLooper } from "@/service/executor";
import { replayStore } from "@/stores";

const int32 = (value: number) => {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setInt32(0, value, true);
  return [...bytes];
};

const record = (func: number, data: number[]) => {
  const bytes = new Uint8Array(5 + data.length);
  bytes[0] = func;
  new DataView(bytes.buffer).setUint32(1, data.length, true);
  bytes.set(data, 5);
  return bytes;
};

const concat = (parts: Uint8Array[]) => {
  const bytes = new Uint8Array(
    parts.reduce((total, part) => total + part.length, 0),
  );
  let offset = 0;
  parts.forEach((part) => {
    bytes.set(part, offset);
    offset += part.length;
  });
  return bytes.buffer;
};

const START = [0, ...int32(8000), ...int32(8000), 0, 0, 0, 0, 0, 0, 0, 0];

export const DEMO_REPLAY = concat([
  record(MSG_START, START),
  record(MSG_NEW_TURN, [0]),
  record(MSG_NEW_PHASE, [1, 0]),
  record(MSG_NEW_PHASE, [4, 0]),
  record(MSG_DAMAGE, [1, ...int32(1200)]),
  record(MSG_NEW_PHASE, [8, 0]),
  record(MSG_RECOVER, [0, ...int32(400)]),
  record(MSG_NEW_TURN, [1]),
  record(MSG_NEW_PHASE, [4, 0]),
  record(MSG_DAMAGE, [0, ...int32(800)]),
  record(MSG_NEW_PHASE, [0, 2]),
]);

export const startDemoReplay = () => {
  replayStore.beginReplay();
  const connection = initReplaySocket({ data: DEMO_REPLAY });
  initUIContainer(connection);
  const pauseTimer = window.setTimeout(() => replayStore.pause(), 160);
  const advanceTimer = window.setInterval(() => replayStore.advance(), 900);
  void pollSocketLooper(getUIContainer()).finally(() => {
    window.clearTimeout(pauseTimer);
    window.clearInterval(advanceTimer);
  });
};
