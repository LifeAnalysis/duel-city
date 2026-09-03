import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

const fragmentShader = `
  uniform sampler2D tDiffuse;
  uniform vec2 resolution;
  uniform float time;
  uniform float grain;
  uniform float vignette;
  varying vec2 vUv;
  float lum(vec3 color) { return dot(color, vec3(.299, .587, .114)); }
  float noise(vec2 point) { return fract(sin(dot(point, vec2(12.9898, 78.233)) + time) * 43758.5453); }
  void main() {
    vec2 px = 1.0 / resolution;
    vec3 color = texture2D(tDiffuse, vUv).rgb;
    float edge = abs(lum(color) - lum(texture2D(tDiffuse, vUv + vec2(px.x, 0.0)).rgb));
    edge += abs(lum(color) - lum(texture2D(tDiffuse, vUv + vec2(0.0, px.y)).rgb));
    color *= 1.0 - smoothstep(.08, .34, edge) * .22;
    float radius = length(vUv - .5) * 1.414;
    color *= 1.0 - smoothstep(.44, 1.0, radius) * vignette;
    color += (noise(gl_FragCoord.xy) - .5) * grain;
    gl_FragColor = vec4(color, 1.0);
  }
`;

const shader = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new THREE.Vector2(1, 1) },
    time: { value: 0 },
    grain: { value: 0.018 },
    vignette: { value: 0.3 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader,
};

export class CohesivePost {
  private readonly composer: EffectComposer;
  private readonly pass: ShaderPass;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
  ) {
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.pass = new ShaderPass(shader);
    this.composer.addPass(this.pass);
  }

  render(elapsed: number) {
    this.pass.uniforms.time.value = elapsed;
    this.composer.render();
  }

  resize(width: number, height: number, pixelRatio: number) {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
    this.pass.uniforms.resolution.value.set(
      width * pixelRatio,
      height * pixelRatio,
    );
  }

  setSubtle(enabled: boolean) {
    this.pass.uniforms.grain.value = enabled ? 0.018 : 0;
    this.pass.uniforms.vignette.value = enabled ? 0.3 : 0;
  }

  dispose() {
    this.composer.dispose();
    this.pass.material.dispose();
  }
}
