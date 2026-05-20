# LLM Duel Agent 方案

## 结论

基于 Neos 接入大模型线上对战时，推荐把大模型玩家实现为一个外部 **Duel Agent**，而不是改造 Neos 让大模型直接构造 ygopro 协议数据。

核心链路：

```text
Neos 浏览器页面
    ↑↓ Playwright 操作 UI / 读取 DOM
Duel Agent
    ↑↓ LLM API
LLM 后端 / 模型服务
```

这个方案的关键判断：

- 不让大模型直接构造 CTOS/STOC 或 `CTOS_RESPONSE` 字节数据，避免协议细节、响应编码和时序错误。
- Agent 像真实玩家一样通过 Playwright 操作 Neos UI，降低大模型理解 ygopro 技术细节的成本。
- Neos 和 srvpro/ygopro 继续负责规则合法性和对局推进。
- 该方案天然适合演示，headed 模式可以直观看到大模型玩家正在操作浏览器。

## 职责边界

### Neos

Neos 仍然是完整的网页对战客户端：

- 保持现有页面、路由、状态和协议处理流程。
- 继续连接真实 srvpro/ygopro server。
- 继续通过现有 UI 发送合法玩家响应。
- 通过 DOM、`data-testid`、`data-card-*`、`data-zone-*` 等页面可观察属性暴露局面和可操作项。
- 不需要知道当前是否由人类或 Agent 操作。

### Duel Agent

Duel Agent 是外部控制器，是该方案的核心运行时：

- 启动浏览器，支持 headed 和 headless。
- 登录 MyCard 账号，保存和复用 Playwright `storageState`。
- 进入匹配、自定义房间、AI 房间或指定房间。
- 选择卡组、准备、开始对局、完成猜拳和先后攻选择。
- 从 Neos 页面 DOM 读取当前局面。
- 生成当前页面真实可执行的动作列表。
- 构造提示词和结构化模型输入。
- 持有 LLM API 鉴权信息并调用 LLM 后端。
- 校验 LLM 返回的 `actionId` 必须存在于动作列表中。
- 将 `actionId` 转换成具体 Playwright 点击、输入或等待指令。
- 循环执行：观察 -> 决策 -> 执行 -> 等待局面变化。
- 保存日志、截图、trace、模型输入输出和执行结果。

### LLM 后端 / 模型服务

LLM 后端只负责模型推理：

- 接收 Agent 构造的 prompt 或 messages。
- 返回结构化决策，例如 `{ "actionId": "...", "reason": "..." }`。
- 不直接操作浏览器。
- 不登录 MyCard。
- 不理解或构造 ygopro 协议。
- 不直接调用 Neos 内部函数。

## Agent Loop

Agent 对局主循环：

```text
打开 Neos
→ 确认登录态
→ 进入对局
→ 等待可操作状态
→ observe 页面 DOM
→ collect executable UI actions
→ convert to semantic legal actions
→ build prompt/messages
→ call LLM
→ validate actionId
→ execute Playwright action
→ wait for state change
→ repeat until duel ends
```

模型不应该被问“你想做什么”。Agent 应该先生成合法动作集合，模型只能从中选择一个。

给 LLM 的内容应该是游戏语义层信息，不包含 DOM、Playwright、`CardView.visible`、ygopro 协议字段等技术细节。简化示例：

```json
{
  "gameState": {
    "summary": "It is your Main Phase 1. You have no monsters on the field.",
    "phase": "Your Main Phase 1",
    "self": {
      "hand": ["Mystical Elf"],
      "monsters": []
    },
    "opponent": {
      "hand": "5 unknown cards",
      "monsters": []
    },
    "life": {
      "self": 8000,
      "opponent": 8000
    }
  },
  "legalActions": [
    {
      "id": "a_001",
      "description": "Normal Summon Mystical Elf from your hand."
    },
    {
      "id": "a_002",
      "description": "Enter the Battle Phase."
    },
    {
      "id": "a_003",
      "description": "End your turn."
    }
  ]
}
```

模型响应：

```json
{
  "actionId": "a_001",
  "reason": "You need to establish a monster on the field before ending the turn."
}
```

Agent 必须校验 `actionId`。如果模型返回不存在的动作、非 JSON、超时或空响应，应走兜底策略。

## 运行模式

### Headed 模式

用于演示和调试：

- 浏览器可见。
- 可以观察 Agent 操作 Neos 的全过程。
- 可以放慢每步执行速度。
- 每步保存截图和日志，方便复盘模型决策。

示例命令：

```bash
npm run agent -- play --mode headed
```

### Headless 模式

用于服务器运行和批量测试：

- 浏览器不可见。
- 依赖已保存的登录态。
- 更严格地处理超时、重试和自动清理。
- 保存 Playwright trace、截图和 JSON 日志。

示例命令：

```bash
npm run agent -- play --mode headless --storage .agent/state/mycard.json
```

### 登录态管理

MyCard SSO、验证码和风控不适合混在每局对战流程中处理。推荐拆出独立登录命令：

```bash
npm run agent -- auth --mode headed --storage .agent/state/mycard.json
```

后续 headless 对战直接复用该 `storageState`。

## 推荐目录

Agent 不应放在 `tests/e2e` 下作为普通测试长期运行。更合理的组织方式是独立运行时工具：

```text
agent/
  package.json
  src/
    cli.ts
    config.ts
    browser.ts
    auth/
      mycard.ts
      storageState.ts
    duel/
      enterRoom.ts
      observe.ts
      actions.ts
      executor.ts
      loop.ts
    llm/
      client.ts
      prompt.ts
      schema.ts
    logs/
      recorder.ts
```

如果第一版只是验证链路，也可以先复用 `tests/e2e/helpers/live.ts` 中已有的页面动作封装，再逐步迁移到 `agent/`。

## Observation 层

Observation 层只从页面可观察状态读取信息，不 import Neos 的 store 或 service。

建议采集：

- 当前 URL 和页面阶段。
- 当前操作方。
- 当前阶段，例如 Draw、Standby、Main1、Battle、End。
- 我方手牌、怪兽区、魔陷区、墓地、除外、额外卡组数量。
- 对方场上、墓地、除外、手牌数量。
- 双方 LP。
- 当前弹窗状态，例如选卡、选区域、选项、表示形式、yes/no、宣言。
- 可点击卡牌动作。
- 可点击阶段动作。
- 可选择区域。
- 最近若干条可见行动历史。

可复用的 DOM 属性包括：

- `data-testid="duel-card"`
- `data-card-code`
- `data-card-zone`
- `data-card-controller`
- `data-card-sequence`
- `data-card-idle-actions`
- `data-card-idle-responses`
- `data-card-idle-response-sources`
- `data-testid="duel-zone"`
- `data-zone`
- `data-controller`
- `data-sequence`
- `data-place-selectable`
- `data-testid="duel-phase-select"`
- `data-testid="duel-select-cards-modal"`
- `data-testid="duel-option-modal"`
- `data-testid="duel-position-modal"`
- `data-testid="duel-yesno-yes"`
- `data-testid="duel-yesno-no"`

如现有 DOM 语义不足，应优先在 Neos UI 增加稳定的 `data-testid` 或 `data-*` 属性，而不是让 Agent 读取内部 store。

## Actions 层

Agent 应该把当前页面上的真实可执行操作抽象成动作列表。这里有两个视图：

- Agent 私有视图：包含 Playwright 执行所需的 selector、DOM 属性、zone、sequence、handler 等信息。
- LLM 可见视图：只包含稳定 `id` 和英文自然语言 `description`。

动作类型建议：

- `card_action`：通常召唤、特殊召唤、盖放、发动、攻击。
- `phase`：进入战斗阶段、进入主要阶段 2、结束阶段。
- `select_card`：弹窗中选择一张或多张卡。
- `select_place`：选择怪兽区或魔陷区格子。
- `select_option`：选择效果选项。
- `select_position`：选择表示形式。
- `select_yesno`：选择是或否。
- `announce`：宣言卡名、数字、属性或种族。
- `surrender`：投降，通常只用于清理或超时兜底。

Agent 内部动作对象必须包含足够的执行信息：

```ts
interface AgentAction {
  id: string;
  type: string;
  llmDescription: string;
  selector?: string;
  payload?: unknown;
}
```

发送给 LLM 时只投影为：

```ts
{
  id: action.id,
  description: action.llmDescription,
}
```

`id` 是模型唯一能返回的决策值。`selector`、`payload`、DOM 属性和 Playwright handler 仅供 Agent executor 使用，不进入 LLM prompt。

## Executor 层

Executor 负责把动作转换为 Playwright 指令：

- 点击卡牌后点击动作菜单项。
- 点击阶段按钮并选择阶段项。
- 点击可选区域。
- 在选择卡片弹窗中勾选目标并确认。
- 在选项、表示形式、yes/no 弹窗中点击目标按钮。
- 处理动作执行后的等待，例如等待弹窗关闭、卡片移动、阶段变化或对局结束。

Executor 只接受由 Actions 层生成的白名单动作。不要执行模型返回的自由文本、任意 selector 或任意脚本。

## LLM 调用

Agent 持有模型鉴权信息并调用 LLM 后端：

```bash
LLM_API_KEY=...
LLM_MODEL=...
```

如果需要支持多模型，可以在 Agent 的 `llm/client.ts` 做 provider 抽象：

```ts
interface LlmClient {
  decide(input: AgentDecisionInput): Promise<AgentDecision>;
}
```

Prompt 约束：

- 面向 LLM 的系统提示词、局面摘要、卡名、效果摘要和动作描述优先使用英文。
- 只能从 `legalActions` 中选择一个 `id`。
- 只返回 JSON。
- 不允许编造动作。
- 不允许描述或构造 ygopro 协议。
- 不允许输出 Playwright 代码。
- 不允许输出 CSS selector、DOM 属性或 Neos 内部技术字段。
- 如果没有明显收益，优先选择推进阶段或结束阶段。

兜底策略建议：

1. 如果当前有必选弹窗，选择第一个合法项。
2. 如果可以攻击，优先攻击。
3. 如果可以通常召唤，优先通常召唤。
4. 如果可以发动明显可发动动作，选择第一个发动项。
5. 如果可以结束阶段，结束阶段。
6. 否则等待短时间后重新观察。

## Agent 与 LLM 的决策协议

Agent 与 LLM 之间的协议应定义为 **Agent-LLM Decision Protocol**。它不是 Playwright 协议，也不是 ygopro 协议。

核心原则：

```text
Agent 给 LLM：游戏语义层的局面摘要 + 英文自然语言合法动作列表
LLM 给 Agent：从合法动作列表中选择一个 actionId
Agent 执行：actionId -> Agent 私有 action registry -> Playwright 指令
```

LLM 不应该看到以下技术细节：

- DOM selector。
- Playwright 代码。
- `data-testid`、`data-card-*`、`data-zone-*` 等测试属性。
- `controller = 0/1`、`zone value = 2`、`sequence` 这类底层定位字段。
- `CardView.visible` 这类技术可见性字段。
- CTOS/STOC、`CTOS_RESPONSE`、ygopro 字节协议。

LLM 也不应该输出任意自由动作描述；它只能返回本轮 `legalActions` 中的 `actionId`。

LLM 应该看到：

- 当前阶段、回合、双方 LP。
- 双方场面的人类可理解描述。
- 我方已知手牌。
- 对方未知手牌数量。
- 墓地、除外、额外卡组等公开信息。
- 当前正在等待处理的交互，例如选择召唤位置、选择是否发动效果。
- 当前所有合法动作，每个动作有稳定 `id` 和英文自然语言 `description`。

### LLM 输入语言

面向 LLM 的协议建议以英文为主：

- 系统提示词使用英文。
- 局面摘要使用英文。
- 卡名优先使用英文官方名。
- 卡片效果摘要优先使用英文。
- 动作描述使用英文。
- Agent 日志和产品 UI 可以继续使用中文。

原因：

- 大模型对英文 Yu-Gi-Oh! 语料、官方卡名、裁定讨论和社区表达通常更熟悉。
- `Normal Summon`、`activate`、`target`、`graveyard`、`banish`、`once per turn` 等英文表达更稳定。
- 英文 prompt 更容易约束模型只返回结构化 JSON。

如果某张卡只有中文、日文或先行卡文本，可以保留原始卡名，同时给英文解释：

```text
Card: 原始生命態ニビル / Nibiru, the Primal Being
Effect summary: Can be Special Summoned after the opponent Summons 5 or more monsters this turn.
```

### 推荐输入格式

```ts
interface LlmDecisionRequest {
  version: 1;
  duelId: string;
  stepId: number;
  instruction: string;
  gameState: {
    summary: string;
    turn: number | "unknown";
    phase: string;
    life: {
      self: number;
      opponent: number;
    };
    self: {
      hand: string[];
      monsters: string[];
      spellsAndTraps: string[];
      graveyard: string[];
      banished: string[];
      extraDeck: string;
    };
    opponent: {
      hand: string;
      monsters: string[];
      spellsAndTraps: string[];
      graveyard: string[];
      banished: string[];
      extraDeck: string;
    };
    pendingInteraction?: string;
    recentHistory: string[];
  };
  legalActions: {
    id: string;
    description: string;
  }[];
}
```

示例：

```json
{
  "version": 1,
  "duelId": "duel-20260518-001",
  "stepId": 17,
  "instruction": "Choose exactly one legal action. Return JSON only.",
  "gameState": {
    "summary": "It is your Main Phase 1. You have no monsters on the field.",
    "turn": 1,
    "phase": "Your Main Phase 1",
    "life": {
      "self": 8000,
      "opponent": 8000
    },
    "self": {
      "hand": ["Mystical Elf"],
      "monsters": [],
      "spellsAndTraps": [],
      "graveyard": [],
      "banished": [],
      "extraDeck": "15 cards"
    },
    "opponent": {
      "hand": "5 unknown cards",
      "monsters": [],
      "spellsAndTraps": [],
      "graveyard": [],
      "banished": [],
      "extraDeck": "15 cards"
    },
    "pendingInteraction": "Choose one currently legal action.",
    "recentHistory": []
  },
  "legalActions": [
    {
      "id": "a_001",
      "description": "Normal Summon Mystical Elf from your hand."
    },
    {
      "id": "a_002",
      "description": "Enter the Battle Phase."
    },
    {
      "id": "a_003",
      "description": "End your turn."
    }
  ]
}
```

### LLM 输出格式

LLM 只返回 JSON：

```ts
interface LlmDecisionResponse {
  version: 1;
  stepId: number;
  actionId: string;
  reason: string;
}
```

示例：

```json
{
  "version": 1,
  "stepId": 17,
  "actionId": "a_001",
  "reason": "You need to establish a monster on the field before ending the turn."
}
```

Agent 必须校验：

- `version` 是否支持。
- `stepId` 是否匹配当前决策步骤。
- `actionId` 是否存在于本轮 `legalActions`。
- 当前页面状态是否仍可执行该动作。

校验失败时，不应该把模型输出直接执行；应记录错误并走兜底动作。

### Agent 私有 Action Registry

发给 LLM 的动作只保留 `id` 和英文自然语言描述。所有技术执行细节保留在 Agent 内部：

```ts
interface AgentPrivateAction {
  id: string;
  llmDescription: string;
  kind:
    | "card_action"
    | "phase"
    | "select_card"
    | "select_place"
    | "select_option"
    | "select_position"
    | "select_yesno"
    | "announce"
    | "wait"
    | "surrender";
  execute: (page: Page) => Promise<void>;
  debug?: {
    selector?: string;
    cardCode?: number;
    zone?: string;
    controller?: string | number;
    sequence?: number;
  };
}
```

发送给 LLM：

```ts
const legalActions = privateActions.map((action) => ({
  id: action.id,
  description: action.llmDescription,
}));
```

执行 LLM 决策：

```ts
const action = privateActions.find(
  (candidate) => candidate.id === decision.actionId,
);

if (!action) {
  throw new Error(`Invalid LLM actionId: ${decision.actionId}`);
}

await action.execute(page);
```

### 动作到 Playwright 的转换

Agent executor 根据私有 action registry 执行 Playwright 操作：

```text
card_action
→ 定位具体 duel-card
→ click card
→ click duel-action-summon / activate / attack / sset

phase
→ click duel-phase-select
→ click duel-phase-battle / duel-phase-end

select_place
→ 定位 data-testid="duel-zone"
→ 匹配 zone / controller / sequence
→ click

select_card
→ 定位 duel-select-cards-modal
→ 点击对应 duel-select-card-option
→ click duel-select-card-submit

select_option
→ 定位 duel-option-modal
→ click 对应 duel-option-item

select_position
→ 定位 duel-position-modal
→ click 对应 position option

select_yesno
→ click duel-yesno-yes 或 duel-yesno-no
```

这些执行细节只存在于 Agent 内部日志和调试信息中，不进入 LLM prompt。

### Prompt 约束

系统提示词建议：

```text
You are controlling a Yu-Gi-Oh duel client.

Choose exactly one legal action from the provided legalActions list.
Return JSON only with: version, stepId, actionId, reason.
Do not invent actions.
Do not output Playwright code.
Do not output CSS selectors.
Do not describe ygopro protocol packets.
If no action improves the position, choose a phase/end/wait fallback action.
```

该协议的目标是让模型只负责“选哪个动作”，让 Agent 负责“如何在 Neos UI 上执行该动作”。

## 第一版范围

第一版目标是演示链路成立，不追求强度：

- 复用 Playwright 打开 Neos。
- 使用已保存登录态。
- 进入自定义房间或 AI 房间。
- 自动选择卡组、准备、猜拳和先后攻。
- 支持主阶段常见动作：通常召唤、特殊召唤、盖放、发动、进 BP、结束阶段。
- 支持战斗阶段攻击和结束战斗阶段。
- 支持基础弹窗：选区域、选卡、选项、表示形式、yes/no。
- 保存每一步 observation、actions、prompt、模型响应、执行结果和截图。

成功标准：

```text
DOM 局面读取
→ 生成合法 UI actions
→ LLM 选择 actionId
→ Agent 校验并执行 Playwright 指令
→ Neos/srvpro 推进对局
→ 循环直到对局结束或主动清理
```

## 非目标

第一版不做：

- 不让模型直接构造协议包。
- 不把模型接入 Neos 前端运行时。
- 不把 MyCard 账号密钥或模型 API key 放入浏览器页面。
- 不直接读取或修改 `matStore`、`cardStore`、`roomStore`。
- 不追求完整理解所有游戏王规则。
- 不承诺高水平竞技表现。

该方案本质上是“外部大模型玩家通过浏览器操作 Neos”，而不是“Neos 内部新增一个协议级 AI 玩家”。
