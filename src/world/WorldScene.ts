import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { playerController } from "three-player-controller";

import { AmbientTraffic } from "@/duel3d/city/AmbientTraffic";
import { DayNightController } from "@/duel3d/city/DayNightController";
import { generateCity } from "@/duel3d/city/generateCity";
import { FigureRig } from "@/duel3d/figure/FigureRig";
import { VoxelBatch } from "@/duel3d/model/VoxelBatch";
import { CohesivePost } from "@/duel3d/render/CohesivePost";
import {
  TableControls,
  type TableControlStatus,
} from "@/duel3d/world/TableControls";

export interface WorldStatus {
  nearRing: boolean;
  message: string;
}

type DiagnosticsWindow = Window & {
  __DUEL_CITY_DIAGNOSTICS__?: Record<string, unknown>;
};

const BASE_MESSAGE = "FIND THE TABLE-EDGE CONTROLS";

export class WorldScene {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(48, 1, 0.08, 120);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly post: CohesivePost;
  private readonly clock = new THREE.Clock();
  private readonly batch = new VoxelBatch(4096);
  private readonly host: HTMLElement;
  private readonly onStatus: (status: WorldStatus) => void;
  private readonly stats = document.createElement("output");
  private controls: OrbitControls | null = null;
  private player: playerController | null = null;
  private figure: FigureRig | null = null;
  private traffic: AmbientTraffic | null = null;
  private dayNight: DayNightController | null = null;
  private tableControls: TableControls | null = null;
  private activeControl: TableControlStatus = {
    key: null,
    label: BASE_MESSAGE,
  };
  private frame = 0;
  private elapsed = 0;
  private frameTimeMs = 0;
  private statsVisible = false;
  private disposed = false;

  constructor(
    host: HTMLElement,
    onStatus: (status: WorldStatus) => void,
    private readonly onReplay: () => void,
  ) {
    this.host = host;
    this.onStatus = onStatus;
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: "high-performance",
    });
    this.configureRenderer();
    this.post = new CohesivePost(this.renderer, this.scene, this.camera);
    this.configureStats();
    this.host.append(this.renderer.domElement, this.stats);
  }

  async start() {
    const light = this.configureScene();
    const city = generateCity(this.batch);
    this.scene.add(this.batch.root);
    this.traffic = new AmbientTraffic(this.batch);
    this.dayNight = new DayNightController(this.scene, light, this.batch);
    this.tableControls = new TableControls(
      this.batch,
      (speed) => this.dayNight?.setSpeed(speed),
      (enabled) => this.dayNight?.setLights(enabled),
      this.onReplay,
    );
    const figure = new FigureRig(this.batch);
    this.figure = figure;
    const orbit = new OrbitControls(this.camera, this.renderer.domElement);
    orbit.enableDamping = true;
    orbit.enablePan = false;
    orbit.minPolarAngle = 0.72;
    orbit.maxPolarAngle = 1.32;
    this.controls = orbit;
    const player = await this.createPlayer(orbit, city.collisions, figure);
    if (this.disposed) {
      player.destroy();
      return;
    }
    this.player = player;
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("resize", this.resize);
    this.resize();
    this.onStatus({ nearRing: false, message: BASE_MESSAGE });
    this.frame = requestAnimationFrame(this.update);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("resize", this.resize);
    this.player?.destroy();
    this.figure?.dispose();
    this.controls?.dispose();
    this.batch.dispose();
    this.post.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.stats.remove();
  }

  private async createPlayer(
    controls: OrbitControls,
    collisions: THREE.Group,
    figure: FigureRig,
  ) {
    const player = new playerController();
    await player.init({
      scene: this.scene,
      camera: this.camera,
      controls,
      playerModelConfig: {
        model: figure.model,
        animations: figure.animations,
        scale: 0.012,
        idleAnim: "idle",
        walkAnim: "walk",
        runAnim: "run",
        jumpAnim: "jump",
        speed: 310,
        runSpeed: 490,
        gravity: -820,
        acceleration: 16,
        deceleration: 20,
        rotateY: Math.PI,
      },
      initPos: new THREE.Vector3(0, 0.15, 10.2),
      minCamDistance: 360,
      maxCamDistance: 620,
      camLookAtHeightRatio: 0.72,
      thirdMouseMode: 3,
      enableZoom: true,
      enableSpringCamera: true,
      springCameraTime: 0.075,
      isShowMobileControls: false,
      keyMap: {
        jump: null,
        toggleView: null,
        toggleFly: null,
        toggleVehicle: null,
      },
      colliders: [
        {
          motion: "static",
          shape: { kind: "mesh", source: collisions },
          useWorker: false,
        },
      ],
    });
    return player;
  }

  private configureRenderer() {
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.info.autoReset = false;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.4));
    this.renderer.domElement.setAttribute(
      "aria-label",
      "Duel City voxel world",
    );
  }

  private configureScene() {
    this.scene.background = new THREE.Color(0x10192c);
    this.scene.fog = new THREE.Fog(0x10192c, 27, 72);
    this.camera.position.set(5.6, 4.5, 16);
    const light = new THREE.DirectionalLight(0xffddb0, 3.4);
    light.position.set(-16, 28, 13);
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.camera.left = -24;
    light.shadow.camera.right = 24;
    light.shadow.camera.top = 20;
    light.shadow.camera.bottom = -20;
    light.shadow.camera.near = 1;
    light.shadow.camera.far = 70;
    light.shadow.bias = -0.0005;
    this.scene.add(light);
    return light;
  }

  private configureStats() {
    Object.assign(this.stats.style, {
      position: "absolute",
      left: "20px",
      bottom: "20px",
      zIndex: "8",
      padding: "8px 10px",
      background: "rgba(7, 12, 24, .82)",
      color: "#4ee8e8",
      font: "600 11px monospace",
      letterSpacing: ".08em",
      pointerEvents: "none",
      display: "none",
    });
  }

  private readonly handleKeyDown = (event: KeyboardEvent) => {
    if (event.code === "F3") {
      event.preventDefault();
      this.statsVisible = !this.statsVisible;
      this.stats.style.display = this.statsVisible ? "block" : "none";
      return;
    }
    if (event.code !== "KeyE" || event.repeat) return;
    this.tableControls?.interact(this.activeControl.key);
  };

  private readonly resize = () => {
    const width = Math.max(this.host.clientWidth, 1);
    const height = Math.max(this.host.clientHeight, 1);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.post.resize(width, height, Math.min(window.devicePixelRatio, 1.4));
  };

  private readonly update = () => {
    if (this.disposed) return;
    try {
      const delta = Math.min(this.clock.getDelta(), 0.05);
      this.elapsed += delta;
      this.frameTimeMs = delta * 1000;
      void this.player?.update(delta).catch(this.fail);
      this.figure?.sync();
      this.traffic?.update(delta);
      this.dayNight?.update(delta);
      this.updateInteraction();
      this.renderer.info.reset();
      this.post.render(this.elapsed);
      this.writeDiagnostics();
      this.frame = requestAnimationFrame(this.update);
    } catch (error) {
      this.fail(error);
    }
  };

  private updateInteraction() {
    const position = this.player?.getPosition();
    if (!position || !this.tableControls) return;
    const next = this.tableControls.nearest(position);
    if (
      next.key === this.activeControl.key &&
      next.label === this.activeControl.label
    ) {
      return;
    }
    this.activeControl = next;
    this.onStatus({ nearRing: next.key !== null, message: next.label });
  }

  private writeDiagnostics() {
    const info = this.renderer.info.render;
    const fps = this.frameTimeMs > 0 ? Math.round(1000 / this.frameTimeMs) : 0;
    this.stats.textContent = `${fps} FPS · ${info.calls} CALLS · ${info.triangles} TRI`;
    (window as DiagnosticsWindow).__DUEL_CITY_DIAGNOSTICS__ = {
      route: "world",
      fps,
      frameTimeMs: Number(this.frameTimeMs.toFixed(2)),
      drawCalls: info.calls,
      triangles: info.triangles,
      playerPosition: this.player?.getPosition().toArray() ?? null,
      externalRequestsExpected: 0,
    };
  }

  private readonly fail = (_error: unknown) => {
    if (this.disposed) return;
    cancelAnimationFrame(this.frame);
    this.onStatus({ nearRing: false, message: "WORLD RENDERER PAUSED" });
  };
}
