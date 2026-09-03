<p align="center">
  <a href="https://neos.moecube.com">
     <img src="./neos-assets/neos-logo.svg" height="128">
    <h1 align="center">NEOS</h1>
  </a>
</p>


<p align="center">
  <a aria-label="Language" href="https://www.typescriptlang.org/">
    <img alt="" src="https://img.shields.io/github/languages/top/DarkNeos/neos-ts?style=for-the-badge">
  </a>
  <a aria-label="React" href="https://reactjs.org/">
    <img alt="" src="https://img.shields.io/badge/react.js-%5E18.2.0-yellow?style=for-the-badge&logo=react">
  </a>
  <a aria-label="License" href="https://github.com/DarkNeos/neos-ts/blob/main/LICENSE">
    <img alt="" src="https://img.shields.io/github/license/DarkNeos/neos-ts?color=&style=for-the-badge">
  </a>
</p>

English | [简体中文](./README-zh_CN.md)

Neos is web version of [Yu-Gi-Oh!](https://www.yugioh-card.com/en/) game written in [TypeScript](https://www.typescriptlang.org/), [React.js](https://reactjs.org/) and [WebAssembly](https://webassembly.org/).

## Public Beta!!
NEOS has launched its public beta! For more details, please visit the [post](https://ygobbs.com/t/447323) on the Moecard community.

## ✨ Features

- **Competitive Match**
  - Battle against tens of thousands of other players in MyCard Ladder, striving to become the strongest. Rankings are announced and rewards are distributed at 22:00 on the last day of each month.
- **Entertainment Match**
  - Set aside victory and defeat for now, and enjoy the thrill of dueling. The top 20 most-used decks in ranked matches from the past week will be temporarily disabled.
- **MC Watching List**
  - Watch ongoing duels on MyCard.
- **Single Mode**
  - Start a duel against AI on the Koishi 7210 server to test your deck or simply pass the time.
- **Custom Room**
  - Create a custom duel room to easily battle with friends.
- **Replay**
  - Freely review past duels and savor those thrilling moments of reversal.

## 📦Quick Start
See the [player guide](https://doc.neos.moe/docs/category/%E7%8E%A9%E5%AE%B6%E6%8C%87%E5%8D%97) for details.

## Screenshot
<p align="center">
  <img alt="" src="./screenshots/duel.png" width="512">
</p>

## Document
See the [Document for Neos](https://doc.neos.moe).

## Deployed
* https://neos.moecube.com by Mycard community
* https://www.neos.moe by [Cloudflare](https://www.cloudflare.com/)

## 🤝Contributing
Create merge requests in [gitlab repo](https://code.mycard.moe/mycard/Neos).

## 🔗Community
Neos is developed in [mycard](https://mycard.moe/) community, join the [QQ Chat](https://github.com/DarkNeos/ygopro-doc/blob/main/assets/ygo_qq.png), where you can ask questions and make discussions.

## Why we develop Neos?
- [Document](./docs/release-2023_02_19_CN.md) by the author
- [Post](https://ygobbs.com/t/ygopro%E7%BD%91%E9%A1%B5%E7%89%88%E5%BC%80%E5%8F%91%E8%BF%9B%E5%B1%95/403397) in [ygobbs](https://ygobbs.com/) forum

## Authors
- Chunchi Che ([@SKTT1Ryze](https://github.com/SKTT1Ryze))
- timelic [@timelic](https://github.com/timelic)

## Duel City 3D layer

Duel City adds an optional voxel diorama behind the existing Neos PlayMat. The DOM PlayMat, message components, duel engine, protocol adapter, socket middleware, and duel handlers remain authoritative. The Three.js mount is lazy, pointer-inert, independently disposable, and guarded by a React error boundary; disabling it or losing WebGL leaves the 2D duel path unchanged.

Run `npm run dev`, then open `/world`. Use WASD to move, Shift to run, drag to orbit, E to use a nearby table control, and F3 to show FPS, WebGL calls, and triangle count. The amber lever cycles time through paused, 1×, and 4×; the cyan switch controls city lights; the red button launches the bundled code-authored YRP3D demo through the existing local replay socket. The demo contains only start, turn, phase, and life-point packets, with no card identities or external data dependency.

The implementation is split into small modules under `src/duel3d`:

- `art` owns the shared 20-color palette, voxel scale, three-step gradient, and toon materials.
- `model` owns the `[x,y,z,colorIndex]` format, generic creature variants, and the global instanced batch. Each palette color gets at most one `InstancedMesh`.
- `city` owns the fixed-seed grid, 30–50 buildings, stage, harbor, park, original card shop, monorail, authored traffic paths, and four-minute day/night controller.
- `figure` owns the voxel duelist rig and hand-keyed idle, walk, run, and jump poses.
- `duel` owns zone projection, passive store/event observation, slabs and creatures, particles, LP numerals, stage animation, postprocessing, and camera direction.
- `render` owns the single combined outline, grain, and vignette post pass.
- `replay` owns the original local demo packet sequence; `world` owns the physical table controls.
- `src/world/WorldScene.ts` composes the walkable BVH/controller view. `src/ui/Duel/DioramaLayer` owns the failure boundary, React mount, Watch HUD, and full-screen layout.

Interactive duels use one calibrated board camera so projected 3D zones stay aligned with the DOM zones. It never takes input and disables grain and vignette to protect card and prompt readability. Watch mode reuses the same mounted duel, replay stream, PlayMat, messages, adapter, and renderer; only layout, HUD, and camera behavior change. Moves use the board shot, attacks use a low over-shoulder shot with a short shake, and major summons use a push-in. All transitions use a 300 ms smoothstep. Prompt visibility holds the current shot and lowers only canvas exposure. Exiting Watch restores the normal duel at the same replay position.

The layer targets fewer than 150 WebGL calls. The local demo smoke test is `tests/e2e/duel-diorama-replay.spec.ts`; it verifies the physical World control, local replay stream, Watch HUD, preserved PlayMat, render budget, and zero third-party requests.

## Lincese
                    GNU GENERAL PUBLIC LICENSE
                       Version 3, 29 June 2007

 Copyright (C) 2007 Free Software Foundation, Inc. <https://fsf.org/>
 Everyone is permitted to copy and distribute verbatim copies
 of this license document, but changing it is not allowed.
