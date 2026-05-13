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
- 下一步：在暂停状态下推进到下一条关键 `GAME_MSG`，跳过 `update_data`、`hint`、`wait` 等高频同步消息。
- 继续：恢复自动消费后续 replay 消息。

控制按钮只在 replay 模式下显示，位于 Duel 页面右下角菜单中：

- `data-testid="replay-toggle"`：暂停/继续。
- `data-testid="replay-advance"`：下一步。

默认下一步会停在卡牌移动、抽卡、阶段变化、召唤、连锁、攻击、LP 变化、胜负结算等用户可观察事件上。被跳过的消息仍然会正常进入 `adaptStoc -> handleGameMsg -> store -> DOM` 流程，只是不作为暂停点。

测试侧公共函数封装在 `tests/e2e/helpers/replay.ts`：

- `uploadReplay(page, replayPath)`：打开 `/match`，通过 UI 上传 replay，并等待进入 `/duel`。
- `pauseReplay(page)`：点击 replay 暂停按钮，并等待按钮状态变为 paused。
- `advanceReplay(page, steps)`：点击下一步按钮，每次推进到下一条关键 `GAME_MSG`。
- `advanceReplayTo(page, advanceMask)`：通过测试控制事件推进到下一条匹配 bit flag 的 `GAME_MSG`。
- `duelCards(page)`：返回所有 Duel 卡牌 DOM locator。
- `expectDuelCardZoneCounts(page, expected)`：按 zone 断言卡牌数量。
- `writeReplayFixture(testInfo, fileName, replay)`：把测试生成的 replay 写入 Playwright 临时目录。

这些 helper 只封装 Playwright 对页面的操作和 DOM 读取，不 import 项目业务代码。

`advanceMask` 是 bit flag，例如：

```ts
ReplayAdvanceFlag.MOVE | ReplayAdvanceFlag.DRAW | ReplayAdvanceFlag.WIN;
```

当测试只关心卡牌移动、抽卡和结算时，可以用这个 mask 跳过其他关键消息。默认 mask 不包含 `UPDATE_DATA`，因为它通常只是同步卡牌数据，出现频率很高，不适合作为自动断言 checkpoint。

`collectReplayExpected(page)` 默认使用更窄的 expected 生成 mask：它只停在更可能影响卡牌 DOM 或连锁标记的消息上，例如 `DRAW`、`MOVE`、`SET`、召唤、连锁、`POS_CHANGE`、`BECOME_TARGET`、`RELOAD_FIELD`、洗牌、计数器和 `WIN`。阶段变化、LP 变化、攻击宣言这类当前 expected 不断言的 UI 状态不会作为默认 checkpoint。

## Expected JSON

真实 replay 用例按“一个目录一个 case”的方式组织，`replay.yrp3d` 和预期 DOM 状态 `expected.json` 放在同一个目录中：

```text
tests/e2e/fixtures/replays/<case-name>/
  replay.yrp3d
  expected.json
```

`tests/e2e/replay.spec.ts` 会在启动时扫描 `tests/e2e/fixtures/replays/*`，对每个同时包含 `replay.yrp3d` 和 `expected.json` 的目录生成一个 Playwright 测试。`UPDATE_EXPECTED=1` 时，目录里只要有 `replay.yrp3d` 就会生成或更新 `expected.json`。目录名会进入测试名，建议使用稳定、可读的 kebab-case，例如 `minimal-duel`、`dragon-combo-win`。

`expected.json` 描述的是 Playwright 能从页面 DOM 观察到的对局状态，不是 `matStore`、`cardStore` 或其他内部 store 的快照。

`expected.json` 由 Playwright 自动生成。生成器会在 replay 暂停后按 expected 生成 mask 推进，每推进一次采集一次 DOM 快照；如果快照和上一个已记录 checkpoint 不同，就自动追加一个 checkpoint。

建议格式：

```json
{
  "version": 1,
  "checkpoints": [
    {
      "advance": 0,
      "cards": [
        {
          "code": 89631139,
          "controller": 0,
          "zone": "MZONE",
          "sequence": 2,
          "position": "FACEUP_ATTACK",
          "isOverlay": false,
          "overlaySequence": 0,
          "isToken": false,
          "status": 0,
          "selectable": false,
          "selected": false,
          "targeted": false,
          "disabled": false
        }
      ],
      "deckCounts": [
        {
          "controller": 0,
          "count": 34
        },
        {
          "controller": 1,
          "count": 31
        }
      ],
      "extraCounts": [
        {
          "controller": 0,
          "count": 12
        },
        {
          "controller": 1,
          "count": 9
        }
      ],
      "chainMarkers": [
        {
          "index": 1,
          "controller": 0,
          "zone": "MZONE",
          "sequence": 2
        }
      ]
    }
  ]
}
```

字段语义：

- `version`：expected 文件格式版本。
- `checkpoints`：按顺序执行的断言点，只记录 DOM 快照发生变化的点。
- `advance`：从上一个已记录 checkpoint 继续推进多少次 replay 下一步。每次下一步默认会跳到下一条关键 `GAME_MSG`，不是原始消息流里的每一条 `GAME_MSG`。第一个 checkpoint 通常是 `0`，表示进入 Duel 后的初始暂停状态。
- `cards`：当前 DOM 中需要逐张断言的 `[data-testid="duel-card"]` 完整语义快照，默认精确匹配；不包含 `DECK`、`EXTRA`、`TZONE` 区域。
- `deckCounts`：当前 DOM 中 `DECK` 区域的剩余卡组数量，只按 `controller` 记录数量，不记录卡组内每张卡的 `code`、位置、状态或顺序。
- `extraCounts`：当前 DOM 中 `EXTRA` 区域的剩余额外卡组数量，只按 `controller` 记录数量，不记录额外卡组内每张卡的 `code`、位置、状态或顺序。
- `chainMarkers`：当前 DOM 中所有 `[data-testid="duel-chain-marker"]` 的可见连锁数字标记，默认精确匹配。

`cards` 不应包含 `uuid`。`data-card-uuid` 是运行时实例标识，不适合作为稳定 expected。

`cards` 也不包含 `zone = "DECK"` 或 `zone = "EXTRA"` 的卡。卡组和额外卡组通常不可见且单张卡状态断言价值低，expected 只用 `deckCounts` 和 `extraCounts` 验证剩余数量。

`TZONE` 不进入 expected。它属于当前渲染里的辅助占位区域，不作为 replay 黑盒断言对象。

`chainMarkers` 表示已经形成的连锁栈在场上的可见标记。回放不会等待玩家选择连锁，因此 `select_chain` 弹窗状态不进入 expected。当前 UI 每个位置只显示最大的连锁编号；如果同一位置存在多个连锁编号，expected 中也只记录实际可见的那个标记。

更新 expected：

```bash
UPDATE_EXPECTED=1 npm run test:e2e -- --project=chrome
```

这个命令会批量跑所有受管 replay fixture，并把每个 case 目录下的 `expected.json` 更新为当前实现生成出的 DOM snapshot。普通测试运行会重新采集 replay DOM 快照，并在每个实际 checkpoint 产生时立即和已有 `expected.json` 的对应 checkpoint 做精确比较：

```bash
npm run test:e2e -- --project=chrome
```

只跑受管 replay fixture：

```bash
npm run test:e2e -- --project=chrome --grep "managed replay fixtures"
```

真实录像耗时较长时，可以调大上限：

```bash
REPLAY_FIXTURE_TIMEOUT=600000 \
REPLAY_FIXTURE_MAX_STEPS=50000 \
npm run test:e2e -- --project=chrome --grep "managed replay fixtures"
```

验证外部真实 replay 时，可以显式传入 replay 文件和 expected 文件：

```bash
REAL_REPLAY_PATH=/path/to/replay.yrp3d \
REAL_REPLAY_EXPECTED_PATH=/path/to/expected.json \
npm run test:e2e -- --project=chrome --grep "external yrp3d"
```

自动生成的 expected 代表“当前实现的可观察行为”。第一次生成后仍然需要 review `expected.json` diff，确认它没有把已有 bug 记录成基准。

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

连锁标记使用 `[data-testid="duel-chain-marker"]` 和 `data-chain-*` 属性断言。关键属性包括：

- `data-chain-index`
- `data-chain-controller`
- `data-chain-zone`
- `data-chain-zone-value`
- `data-chain-sequence`

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
