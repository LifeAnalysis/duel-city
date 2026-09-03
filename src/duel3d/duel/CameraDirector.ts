import * as THREE from "three";

type Shot = "board" | "attack" | "hero" | "idle";

const SHOTS: Record<Shot, [THREE.Vector3, THREE.Vector3]> = {
  board: [new THREE.Vector3(0, 13.5, 13), new THREE.Vector3(0, 0.4, 0)],
  attack: [new THREE.Vector3(-6.8, 3.8, 9.5), new THREE.Vector3(0, 0.8, -1.2)],
  hero: [new THREE.Vector3(4.2, 4.7, 7), new THREE.Vector3(0, 1.3, 0)],
  idle: [new THREE.Vector3(0, 8.5, 14.5), new THREE.Vector3(0, 0.7, 0)],
};

export class CameraDirector {
  private readonly fromPosition = new THREE.Vector3();
  private readonly toPosition = new THREE.Vector3();
  private readonly fromTarget = new THREE.Vector3();
  private readonly toTarget = new THREE.Vector3();
  private readonly target = new THREE.Vector3();
  private transitionElapsed = 1;
  private watch = false;
  private held = false;
  private elapsed = 0;
  private shakeTime = 0;

  constructor(private readonly camera: THREE.PerspectiveCamera) {
    this.applyImmediate("board");
  }

  setWatch(enabled: boolean) {
    if (this.watch === enabled) return;
    this.watch = enabled;
    this.transitionTo(enabled ? "idle" : "board");
  }

  setHeld(held: boolean) {
    this.held = held;
  }

  cue(shot: Shot) {
    if (!this.watch || this.held) return;
    this.transitionTo(shot);
  }

  shake() {
    this.shakeTime = 0.24;
  }

  update(delta: number) {
    this.elapsed += delta;
    if (!this.held)
      this.transitionElapsed = Math.min(
        1,
        this.transitionElapsed + delta / 0.3,
      );
    const t = this.transitionElapsed;
    const eased = t * t * (3 - 2 * t);
    this.camera.position.lerpVectors(this.fromPosition, this.toPosition, eased);
    this.target.lerpVectors(this.fromTarget, this.toTarget, eased);
    if (this.watch && t >= 1) {
      this.camera.position.x += Math.sin(this.elapsed * 0.18) * 0.18;
      this.camera.position.y += Math.sin(this.elapsed * 0.13) * 0.08;
    }
    if (this.shakeTime > 0) {
      const strength = this.shakeTime / 0.24;
      this.camera.position.x += Math.sin(this.elapsed * 92) * 0.09 * strength;
      this.camera.position.y += Math.cos(this.elapsed * 77) * 0.06 * strength;
      this.shakeTime = Math.max(0, this.shakeTime - delta);
    }
    this.camera.lookAt(this.target);
  }

  private transitionTo(shot: Shot) {
    this.fromPosition.copy(this.camera.position);
    this.fromTarget.copy(this.target);
    this.toPosition.copy(SHOTS[shot][0]);
    this.toTarget.copy(SHOTS[shot][1]);
    this.transitionElapsed = 0;
  }

  private applyImmediate(shot: Shot) {
    this.camera.position.copy(SHOTS[shot][0]);
    this.target.copy(SHOTS[shot][1]);
    this.camera.lookAt(this.target);
    this.fromPosition.copy(this.camera.position);
    this.toPosition.copy(this.camera.position);
    this.fromTarget.copy(this.target);
    this.toTarget.copy(this.target);
  }
}
