import { useSnapshot } from "valtio";

import { ygopro } from "@/api";
import { presentationStore, setWatchMode } from "@/duel3d/ui/presentationStore";
import { matStore } from "@/stores";

import styles from "./index.module.scss";

const exitWatch = () => {
  setWatchMode(false);
  document.body.classList.remove("duel-watch-mode");
  if (document.fullscreenElement) void document.exitFullscreen();
};

export const DioramaHud = () => {
  const { watch } = useSnapshot(presentationStore);
  const initInfo = useSnapshot(matStore.initInfo);
  const { turnCount, currentPlayer, phase } = useSnapshot(matStore);
  if (!watch) return null;
  return (
    <aside className={styles.hud} data-testid="duel-watch-hud">
      <div>
        <small>OPPONENT</small>
        <strong>{initInfo.op.life}</strong>
      </div>
      <div className={styles.round}>
        <span>TURN {turnCount}</span>
        <strong>
          {ygopro.StocGameMessage.MsgNewPhase.PhaseType[phase.currentPhase]}
        </strong>
        <span>PLAYER {currentPlayer + 1}</span>
      </div>
      <div>
        <small>DUELIST</small>
        <strong>{initInfo.me.life}</strong>
      </div>
      <button type="button" onClick={exitWatch}>
        EXIT WATCH
      </button>
    </aside>
  );
};
