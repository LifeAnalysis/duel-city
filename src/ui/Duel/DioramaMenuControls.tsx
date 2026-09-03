import { EyeOutlined, SettingFilled } from "@ant-design/icons";
import { Button, Tooltip } from "antd";
import { useEffect } from "react";
import { useSnapshot } from "valtio";

import { presentationStore, setWatchMode } from "@/duel3d/ui/presentationStore";
import { replayStore } from "@/stores";
import { openSettingPanel } from "@/ui/Setting";

const enterWatch = () => {
  setWatchMode(true);
  document.body.classList.add("duel-watch-mode");
  void document.documentElement.requestFullscreen?.().catch(() => undefined);
};

export const DioramaMenuControls = () => {
  const { isReplay } = useSnapshot(replayStore);
  const { watch } = useSnapshot(presentationStore);

  useEffect(() => {
    const syncFullscreen = () => {
      if (!document.fullscreenElement && presentationStore.watch) {
        setWatchMode(false);
        document.body.classList.remove("duel-watch-mode");
      }
    };
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () =>
      document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  return (
    <>
      <Tooltip title="Diorama settings">
        <Button
          aria-label="Diorama settings"
          icon={<SettingFilled />}
          onClick={() => openSettingPanel({ defaultKey: "animation" })}
          type="text"
        />
      </Tooltip>
      {isReplay && !watch && (
        <Tooltip title="Watch in 3D">
          <Button
            aria-label="Watch in 3D"
            data-testid="duel-watch"
            icon={<EyeOutlined />}
            onClick={enterWatch}
            type="text"
          >
            Watch
          </Button>
        </Tooltip>
      )}
    </>
  );
};
