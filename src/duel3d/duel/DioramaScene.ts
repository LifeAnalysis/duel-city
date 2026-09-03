import * as THREE from "three";
import { subscribe } from "valtio";

import { AmbientTraffic } from "../city/AmbientTraffic";
import { DayNightController } from "../city/DayNightController";
import { generateCity } from "../city/generateCity";
import { FigureRig } from "../figure/FigureRig";
import { VoxelBatch } from "../model/VoxelBatch";
import { CohesivePost } from "../render/CohesivePost";
import { presentationStore } from "../ui/presentationStore";
import { CameraDirector } from "./CameraDirector";
import { DuelEffects } from "./DuelEffects";
import { DuelStage } from "./DuelStage";
import { DuelStoreAdapter } from "./DuelStoreAdapter";
import type { DuelVisualEvent, DuelVisualState } from "./types";

type DiagnosticsWindow = Window & {
  __DUEL_CITY_DUEL_3D__?: Record<string, unknown>;
};

export class DioramaScene {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(46, 1, 0.08, 100);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly batch = new VoxelBatch(6144);
  private readonly clock = new THREE.Clock();
  private readonly director = new CameraDirector(this.camera);
  private readonly post: CohesivePost;
  private readonly stage = new DuelStage(this.batch, this.camera);
  private readonly effects = new DuelEffects(this.batch);
  private readonly adapter: DuelStoreAdapter;
  private readonly host: HTMLElement;
  private readonly onFailure: () => void;
  private readonly figures: FigureRig[] = [];
  private readonly unsubscribers: Array<() => void> = [];
  private traffic: AmbientTraffic | null = null;
  private dayNight: DayNightController | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private frame = 0;
  private elapsed = 0;
  private disposed = false;
  private state: DuelVisualState | null = null;

  constructor(host: HTMLElement, onFailure: () => void) {
    this.host = host;
    this.onFailure = onFailure;
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: false,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.82;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.info.autoReset = false;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    this.renderer.domElement.tabIndex = -1;
    this.renderer.domElement.setAttribute("aria-hidden", "true");
    this.post = new CohesivePost(this.renderer, this.scene, this.camera);
    this.adapter = new DuelStoreAdapter((event) => this.handleEvent(event));
    this.post.setSubtle(false);
    this.host.appendChild(this.renderer.domElement);
  }

  start() {
    const light = this.configureScene();
    generateCity(this.batch, 0xd0e1);
    this.scene.add(this.batch.root);
    this.traffic = new AmbientTraffic(this.batch);
    this.dayNight = new DayNightController(this.scene, light, this.batch);
    this.dayNight.setSpeed(0.28);
    this.addFigures();
    this.adapter.start();
    this.unsubscribers.push(
      subscribe(presentationStore, this.syncPresentation, true),
    );
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(this.host);
    this.resize();
    this.syncPresentation();
    document.body.classList.add("duel-diorama-enabled");
    this.frame = requestAnimationFrame(this.update);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.adapter.dispose();
    this.unsubscribers.splice(0).forEach((unsubscribe) => unsubscribe());
    this.resizeObserver?.disconnect();
    this.figures.forEach((figure) => figure.dispose());
    this.batch.dispose();
    this.post.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    document.body.classList.remove("duel-diorama-enabled");
  }

  private configureScene() {
    this.scene.background = new THREE.Color(0x090d18);
    this.scene.fog = new THREE.Fog(0x090d18, 24, 68);
    const light = new THREE.DirectionalLight(0xffd7a3, 2.8);
    light.position.set(-14, 24, 12);
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.camera.left = -23;
    light.shadow.camera.right = 23;
    light.shadow.camera.top = 20;
    light.shadow.camera.bottom = -20;
    light.shadow.camera.far = 65;
    this.scene.add(light);
    return light;
  }

  private addFigures() {
    const positions: Array<[number, number, number, number]> = [
      [-6.2, 0.18, 6.4, Math.PI],
      [6.2, 0.18, -6.4, 0],
    ];
    positions.forEach(([x, y, z, rotation]) => {
      const figure = new FigureRig(this.batch);
      figure.model.position.set(x, y, z);
      figure.model.rotation.y = rotation;
      figure.model.scale.setScalar(0.72);
      this.scene.add(figure.model);
      figure.sync();
      this.figures.push(figure);
    });
  }

  private readonly syncPresentation = () => {
    const held = presentationStore.promptCount > 0;
    this.director.setHeld(held);
    this.director.setWatch(presentationStore.watch);
    this.post.setSubtle(presentationStore.watch);
    this.renderer.toneMappingExposure = held ? 0.64 : 0.82;
  };

  private readonly resize = () => {
    if (this.disposed) return;
    const width = Math.max(this.host.clientWidth, 1);
    const height = Math.max(this.host.clientHeight, 1);
    const pixelRatio = Math.min(window.devicePixelRatio, 1.25);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.post.resize(width, height, pixelRatio);
    requestAnimationFrame(() => this.stage.refreshProjection());
  };

  private readonly update = () => {
    if (this.disposed) return;
    try {
      const delta = Math.min(this.clock.getDelta(), 0.05);
      this.elapsed += delta;
      this.director.update(delta);
      this.stage.update(delta);
      this.effects.update(delta);
      this.traffic?.update(delta);
      this.dayNight?.update(delta);
      this.figures.forEach((figure) => figure.sync());
      this.renderer.info.reset();
      this.post.render(this.elapsed);
      this.writeDiagnostics();
      this.frame = requestAnimationFrame(this.update);
    } catch (_error) {
      this.fail();
    }
  };

  private handleEvent(event: DuelVisualEvent) {
    if (event.kind === "state") {
      this.state = event.state;
      this.stage.reconcile(event.state);
      return;
    }
    if (event.kind === "attack") this.handleAttack(event.uuid);
    if (event.kind === "summon") this.handleSummon(event.code);
    if (event.kind === "grave") this.handleGrave(event.uuid);
    if (event.kind === "lp") this.effects.life(event.side, event.amount);
    if (event.kind === "move") this.director.cue("board");
    if (event.kind === "focus" || event.kind === "chain")
      this.director.cue("hero");
  }

  private handleAttack(uuid: string) {
    this.stage.attack(uuid);
    const position = this.stage.positionForUuid(uuid);
    if (position) this.effects.attack(position);
    this.director.cue("attack");
    this.director.shake();
  }

  private handleSummon(code: number) {
    const position = this.stage.positionForCode(code);
    if (position) this.effects.summon(position);
    const card = this.state?.cards.find((candidate) => candidate.code === code);
    this.director.cue((card?.level ?? 0) >= 7 ? "hero" : "board");
  }

  private handleGrave(uuid: string) {
    const position = this.stage.positionForUuid(uuid);
    if (position) this.effects.grave(position);
  }

  private writeDiagnostics() {
    const info = this.renderer.info.render;
    (window as DiagnosticsWindow).__DUEL_CITY_DUEL_3D__ = {
      ready: true,
      drawCalls: info.calls,
      triangles: info.triangles,
      watch: presentationStore.watch,
      promptHeld: presentationStore.promptCount > 0,
      cards: this.state?.cards.length ?? 0,
    };
  }

  private fail() {
    if (this.disposed) return;
    this.dispose();
    this.onFailure();
  }
}
