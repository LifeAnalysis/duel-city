import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { startDemoReplay } from "@/duel3d/replay/demoReplay";
import { setWatchMode } from "@/duel3d/ui/presentationStore";
import { WorldScene, type WorldStatus } from "@/world/WorldScene";

import styles from "./index.module.scss";

const INITIAL_STATUS: WorldStatus = {
  nearRing: false,
  message: "LOADING PLAZA",
};

export const Component = () => {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState(INITIAL_STATUS);
  const navigate = useNavigate();

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const world = new WorldScene(host, setStatus, () => {
      startDemoReplay();
      setWatchMode(true);
      document.body.classList.add("duel-watch-mode");
      void document.documentElement
        .requestFullscreen?.()
        .catch(() => undefined);
      navigate("/world/replay");
    });
    void world.start().catch(() => {
      setStatus({ nearRing: false, message: "PLAZA FAILED TO START" });
    });
    return () => world.dispose();
  }, [navigate]);

  return (
    <section className={styles.plaza}>
      <div ref={hostRef} className={styles.canvas} />
      <div className={styles.brand}>
        <span className={styles.kicker}>DOMINO DISTRICT / 01</span>
        <strong>DUEL CITY</strong>
      </div>
      <div className={styles.identity}>
        <span>CALLSIGN</span>
        <strong>DUELIST-07</strong>
      </div>
      <div className={styles.offline}>
        <span />
        LOCAL DEMO READY
      </div>
      <div
        className={`${styles.objective} ${
          status.nearRing ? styles.active : ""
        }`}
        role="status"
      >
        <span className={styles.key}>{status.nearRing ? "E" : "01"}</span>
        <span>
          <small>
            {status.nearRing ? "INTERACTION READY" : "CURRENT OBJECTIVE"}
          </small>
          <strong>{status.message}</strong>
        </span>
      </div>
      <div className={styles.controls}>
        <span>
          <kbd>WASD</kbd> MOVE
        </span>
        <span>
          <kbd>SHIFT</kbd> RUN
        </span>
        <span>
          <kbd>DRAG</kbd> CAMERA
        </span>
      </div>
      <div className={styles.frameTop} />
      <div className={styles.frameBottom} />
    </section>
  );
};
