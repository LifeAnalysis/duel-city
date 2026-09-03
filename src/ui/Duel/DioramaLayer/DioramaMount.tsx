import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { DioramaScene } from "@/duel3d/duel/DioramaScene";
import { setWatchMode } from "@/duel3d/ui/presentationStore";

import { DioramaHud } from "./Hud";
import styles from "./index.module.scss";

export const DioramaMount = () => {
  const hostRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || failed) return;
    const scene = new DioramaScene(host, () => setFailed(true));
    try {
      scene.start();
    } catch (_error) {
      scene.dispose();
      setFailed(true);
    }
    return () => {
      setWatchMode(false);
      document.body.classList.remove("duel-watch-mode");
      scene.dispose();
    };
  }, [failed]);

  if (failed) return null;
  return createPortal(
    <div ref={hostRef} className={styles.layer} data-testid="duel-diorama">
      <DioramaHud />
    </div>,
    document.body,
  );
};
