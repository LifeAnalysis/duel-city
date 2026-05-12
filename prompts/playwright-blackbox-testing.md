# Playwright 黑盒测试方案

## 目标

Playwright 黑盒测试用于从浏览器用户视角验证 Neos 前端行为是否正确。测试不直接调用 `src` 内部函数，不读取 `matStore`、`cardStore` 等运行时对象，也不 mock 前端业务逻辑，而是通过以下边界完成验证：

- 打开真实页面
- 点击真实 UI
- 上传 `.yrp3d` 文件
- 走前端本地 replay 解析和消息处理流程
- 等待页面跳转和渲染
- 从 DOM、文本、截图或浏览器可观察状态做断言

这种测试适合覆盖“用户实际能否完成一条流程”，例如回放文件上传、进入决斗页面、卡牌渲染、结算弹窗展示等。

## 当前实现

当前已落地一个最小回放黑盒用例：

- 配置文件：`playwright.config.ts`
- 测试文件：`tests/e2e/replay.spec.ts`
- 测试公共函数：`tests/e2e/helpers/replay.ts`
- 运行脚本：`npm run test:e2e`、`npm run test:e2e:headed`

测试流程：

1. Playwright 自动启动 Vite dev server。
2. 使用本机 Chrome 打开 `/match` 页面。
3. 测试代码临时生成一个最小 `.yrp3d` 文件。
4. 通过页面上的回放上传入口选择该文件。
5. 点击“开始回放”。
6. 前端本地解析 `.yrp3d` 数据，转换成 `STOC_GAME_MSG` 消息。
7. 本地 replay stream 按现有 socket looper 入口分发消息，前端按正常路径处理。
8. 页面跳转到 `/duel`。
9. Playwright 点击 replay 暂停按钮，让回放停在当前 DOM 状态。
10. 断言卡牌 DOM 已渲染，且结算结果尚未出现。
11. Playwright 点击 replay 下一步按钮，推进一条 `GAME_MSG`。
12. 断言出现 `Win` 结算结果。

最小 `.yrp3d` 内容包含两条记录：

- `MSG_START`：初始化双方 LP、主卡组、额外卡组和 token 占位卡。
- `MSG_WIN`：触发胜利结算弹窗。

该用例覆盖的是从“上传回放”到“决斗结束展示”的前端闭环，不验证具体卡片效果逻辑。

## 本地 Replay 流

Neos 现在不依赖远程 `replay.neos.moe` 服务来播放 `.yrp3d`。前端会在本地完成 replay worker 原本承担的轻量转换：

1. 读取 `.yrp3d` 中的每条记录：`func:uint8 + length:uint32le + data`。
2. 将记录包装成现有 `YgoProPacket`：`proto = STOC_GAME_MSG`，`exData = [func, ...data]`。
3. 通过 `LocalReplayStream.execute(onMessage)` 串行交给 `handleSocketMessage`。

因此 replay 黑盒测试仍然覆盖真实的 `adaptStoc -> handleGameMsg -> store -> DOM` 路径，但不会受远程 replay 服务、WebSocket 网络时序或服务可用性影响。

## Replay 控制

为了让真实录像的中间态断言稳定，项目侧提供了 replay 控制能力：

- 暂停：停止继续消费本地 replay 流中的后续 `GAME_MSG`。
- 下一步：在暂停状态下只放行一个后续 `GAME_MSG`。
- 继续：恢复自动消费后续 replay 消息。

控制按钮只在 replay 模式下显示，位于 Duel 页面右下角菜单中：

- `data-testid="replay-toggle"`：暂停/继续。
- `data-testid="replay-advance"`：下一步。

测试侧公共函数封装在 `tests/e2e/helpers/replay.ts`：

- `uploadReplay(page, replayPath)`：打开 `/match`，通过 UI 上传 replay，并等待进入 `/duel`。
- `pauseReplay(page)`：点击 replay 暂停按钮，并等待按钮状态变为 paused。
- `advanceReplay(page, steps)`：点击下一步按钮。
- `duelCards(page)`：返回所有 Duel 卡牌 DOM locator。
- `expectDuelCardZoneCounts(page, expected)`：按 zone 断言卡牌数量。
- `writeReplayFixture(testInfo, fileName, replay)`：把测试生成的 replay 写入 Playwright 临时目录。

这些 helper 只封装 Playwright 对页面的操作和 DOM 读取，不 import 项目业务代码。

## 黑盒边界

这类测试应该避免：

- 直接 import 或调用 `src` 中的业务函数。
- 直接读写 `matStore`、`cardStore`、`roomStore`。
- 用测试代码替换前端 WebSocket、adapter、service 或 store。
- 通过私有运行时状态判断测试结果。

这类测试可以使用：

- 页面文本，例如按钮、弹窗、结果文字。
- 用户交互，例如点击、上传、输入。
- DOM 结构和属性，例如卡牌节点是否出现。
- 浏览器 URL，例如是否进入 `/duel`。
- 截图和 trace，用于定位 UI 失败原因。

当前测试使用 `[data-testid="duel-card"]` 和 `data-card-zone` 等 DOM 属性断言卡牌渲染结果。这些属性被当作页面可观察输出，不代表测试直接读取内部 store。

Replay 控制同样通过真实 DOM 按钮完成，测试不直接调用 `replayStore.pause()` 或 `replayStore.advance()`。

## 运行方法

普通无头模式：

```bash
npm run test:e2e
```

展示 Chrome UI：

```bash
npm run test:e2e:headed
```

只跑 Chrome 项目：

```bash
npm run test:e2e -- --project=chrome
```

打开 Playwright 交互式 UI：

```bash
npm run test:e2e -- --ui
```

放慢 headed 测试，便于观察：

```bash
npm run test:e2e -- --project=chrome --headed --slow-mo=300
```

## Dev Server 配置

默认情况下，Playwright 会自动启动：

```bash
npm run dev -- --host 127.0.0.1 --port 5173
```

如果希望连接已经手动启动的 dev server，可以设置：

```bash
PLAYWRIGHT_SKIP_WEB_SERVER=true \
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 \
npm run test:e2e:headed
```

默认脚本会显式设置 `PLAYWRIGHT_SKIP_WEB_SERVER=false`，避免本机 shell 环境变量导致 Vite 没有被启动。

## 浏览器要求

当前 Playwright project 使用本机 Chrome：

```ts
channel: "chrome"
```

这样可以避免额外下载 Playwright 自带浏览器。运行机器需要已经安装 Google Chrome。

如果后续 CI 环境没有 Chrome，可以改为安装 Playwright 浏览器：

```bash
npx playwright install chromium
```

并把 `playwright.config.ts` 中的 `channel: "chrome"` 移除或改成 Chromium 项目。

## 常见问题

### `ERR_CONNECTION_REFUSED`

说明测试访问了 `baseURL`，但 dev server 没有启动。

检查：

- 是否设置了 `PLAYWRIGHT_SKIP_WEB_SERVER=true`。
- `PLAYWRIGHT_BASE_URL` 是否指向正确端口。
- 是否有已有服务占用或阻止 `5173`。

普通运行建议直接用：

```bash
npm run test:e2e:headed
```

### 页面卡在 1%

通常是卡片数据库、禁限表、strings 等远端资源加载失败。常见原因是本机代理、网络或 CDN 访问问题。

这些资源属于真实页面初始化流程。黑盒测试默认不 mock 这些资源，因此网络环境需要能访问配置中的资源地址。

### Replay 流程不稳定

当前黑盒测试走前端本地 replay 流，不依赖 `replay.neos.moe`。如果仍然出现不稳定，优先检查 replay 控制是否已经进入 paused/waiting 状态，再检查 DOM 断言是否依赖动画尚未完成的瞬间状态。

## 后续扩展

可以逐步增加以下用例：

- 上传真实历史 `.yrp3d` 文件，验证复杂回放可进入 Duel。
- 检查不同阶段的页面文字、弹窗和按钮状态。
- 对关键页面做截图回归。
- 使用 Playwright trace 分析失败现场。
- 增加多个浏览器项目，例如 Chromium、Firefox、WebKit。
- 在 CI 中运行无头模式测试，并上传失败截图和 trace。

扩展测试时优先保持黑盒边界：从页面入口驱动，从用户可见结果断言。
