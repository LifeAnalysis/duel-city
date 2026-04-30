# YGOPro MSG 协议清单

本文档整理 `STOC_GAME_MSG` 内层 `MSG_*` 协议。字段来源对齐了三个实现：

- `ygopro/gframe/duelclient.cpp`：官方客户端的字节读取顺序和 UI 处理。
- `ygopro-msg-encode/src/protos/msg`：当前 TypeScript 序列化/反序列化实现。
- `Neos/src/api/ocgcore/ocgAdapter` 与 `Neos/src/service/duel`：Neos 前端的适配和业务处理。

## 封包格式

外层 CTOS/STOC 包统一为：

```text
u16 length_le | u8 proto | bytes body
```

`length` 表示 `proto + body` 的长度，不包含自身 2 字节。所有多字节整数都是 little-endian。

`STOC_GAME_MSG` 的 `proto` 是 `0x01`，它的 `body` 是：

```text
u8 msg_id | bytes msg_payload
```

`CTOS_RESPONSE` 的 `proto` 也是 `0x01`，它的 `body` 只包含响应字节，不再带 `msg_id`。客户端收到需要响应的 `MSG_*` 后，应在当前选择完成时发送 `CTOS_RESPONSE`。

## 通用结构

| 名称 | 序列化 | 字段含义 |
| --- | --- | --- |
| `CardLocation` | `u8 controller, u8 location, u8 sequence, u8 position/subsequence` | 一张卡的位置。第 4 字节在不同 MSG 中可能表示表示形式、叠放序号或保留值。 |
| `ShortCardLocation` | `u8 controller, u8 location, u8 sequence` | 不带第 4 字节的位置。 |
| `SimpleCardInfo` | `i32 code, u8 controller, u8 location, u8 sequence` | 7 字节候选卡，常见于主阶段命令和排序。 |
| `CardInfo` | `i32 code, u8 controller, u8 location, u8 sequence, u8 subsequence` | 8 字节候选卡，常见于选卡。 |
| `CardStats` | `CardLocation, i32 atk, i32 def` | 战斗中的卡片位置和攻防。 |
| `QueryChunk` | `i32 length, bytes query_payload` | `length` 包含自身 4 字节。`length == 4` 表示空查询。 |
| `CardQuery` | `u32 flags, fields by QUERY_* order` | 查询卡片数据。字段顺序见 `QUERY_CODE, QUERY_POSITION, QUERY_ALIAS, QUERY_TYPE, QUERY_LEVEL, QUERY_RANK, QUERY_ATTRIBUTE, QUERY_RACE, QUERY_ATTACK, QUERY_DEFENSE, QUERY_BASE_ATTACK, QUERY_BASE_DEFENSE, QUERY_REASON, QUERY_REASON_CARD, QUERY_EQUIP_CARD, QUERY_TARGET_CARD, QUERY_OVERLAY_CARD, QUERY_COUNTERS, QUERY_OWNER, QUERY_STATUS, QUERY_LSCALE, QUERY_RSCALE, QUERY_LINK`。 |

常用 `location`：`DECK=0x01`, `HAND=0x02`, `MZONE=0x04`, `SZONE=0x08`, `GRAVE=0x10`, `REMOVED=0x20`, `EXTRA=0x40`, `OVERLAY=0x80`。

常用 `position`：`FACEUP_ATTACK=0x1`, `FACEDOWN_ATTACK=0x2`, `FACEUP_DEFENSE=0x4`, `FACEDOWN_DEFENSE=0x8`。

## 响应编码

| MSG | CTOS_RESPONSE body | 说明 |
| --- | --- | --- |
| `MSG_SELECT_BATTLECMD` | `u32 (index << 16) | type` | `type`: `0=ACTIVATE`, `1=ATTACK`, `2=TO_M2`, `3=TO_EP`。 |
| `MSG_SELECT_IDLECMD` | `u32 (index << 16) | type` | `type`: `0=SUMMON`, `1=SPSUMMON`, `2=REPOS`, `3=MSET`, `4=SSET`, `5=ACTIVATE`, `6=TO_BP`, `7=TO_EP`, `8=SHUFFLE`。 |
| `MSG_SELECT_EFFECTYN` | `i32 0/1` | `1` 表示确认发动，`0` 表示否。 |
| `MSG_SELECT_YESNO` | `i32 0/1` | `1` 表示是，`0` 表示否。 |
| `MSG_SELECT_OPTION` | `i32 index` | 返回选项下标，不是选项文本/数值本身。 |
| `MSG_SELECT_CARD` | `u8 count, u8[count] indices` 或 `i32 -1` | 返回候选卡下标列表；允许取消时可返回 `-1`。 |
| `MSG_SELECT_UNSELECT_CARD` | `u8 1, u8 index` 或 `i32 -1` | 返回本次点击的候选下标；完成/取消用 `-1`。 |
| `MSG_SELECT_CHAIN` | `i32 index` | `-1` 表示不连锁；有强制连锁时不能返回 `-1`。 |
| `MSG_SELECT_PLACE` | `3 * n` 字节位置三元组 | 每个位置为 `u8 player, u8 location, u8 sequence`。取消时原版客户端发送 `[localPlayer, 0, 0]`。 |
| `MSG_SELECT_DISFIELD` | `3 * n` 字节位置三元组 | 同 `MSG_SELECT_PLACE`，用于禁用区域选择。 |
| `MSG_SELECT_POSITION` | `i32 position` | 返回一个 `POS_*` 掩码。 |
| `MSG_SELECT_TRIBUTE` | `u8 count, u8[count] indices` 或 `i32 -1` | 返回解放候选卡下标列表。 |
| `MSG_SELECT_COUNTER` | `u16[count] selected_counts` | 对每张候选卡返回要取/放的指示物数量。 |
| `MSG_SELECT_SUM` | `u8 count, u8[count] indices` | `count` 包含必须选择的卡和额外选择卡；下标来自候选列表。 |
| `MSG_SORT_CARD` | `u8[count] indices` | 返回排序后的候选下标。 |
| `MSG_ANNOUNCE_RACE` | `i32 race_mask` | 返回选中的种族位图，数量由 `count` 限制。 |
| `MSG_ANNOUNCE_ATTRIB` | `i32 attribute_mask` | 返回选中的属性位图，数量由 `count` 限制。 |
| `MSG_ANNOUNCE_CARD` | `i32 card_code` | 返回宣言卡号。 |
| `MSG_ANNOUNCE_NUMBER` | `i32 index` | 返回 `numbers` 数组中的下标。 |
| `MSG_ROCK_PAPER_SCISSORS` | `u8 result` | `1=ROCK`, `2=SCISSORS`, `3=PAPER`。 |

## MSG 完整清单

| ID | MSG | Payload 序列化 | 字段含义 | 客户端处理 |
| --- | --- | --- | --- | --- |
| 1 | `MSG_RETRY` | 空 | 上一次响应无效，需要重新选择。 | 重新打开上一条可交互 MSG 的 UI，提示选择错误，不改变场面。 |
| 2 | `MSG_HINT` | `u8 type, u8 player, i32 data` | 提示类型、关联玩家、提示数据或描述 ID。 | 根据 `type` 显示事件、选择提示、卡名、种族/属性/数字、区域高亮等；通常不需要响应。 |
| 3 | `MSG_WAITING` | 空 | 等待对方/服务端动作。 | 显示等待提示，关闭当前选择态。 |
| 4 | `MSG_START` | `u8 playerType, u8 duelRule, i32 lp0, i32 lp1, u16 deck0, u16 extra0, u16 deck1, u16 extra1` | 对局视角、规则、双方初始 LP、主卡组和额外卡组数量。 | 清空场地，初始化双方卡组/额外卡组占位、LP、回合状态和选择提示。 |
| 5 | `MSG_WIN` | `u8 player, u8 type` | 获胜方，`2` 通常表示平局；胜利类型。 | 标记对局结束，显示胜负动画/文案，停止交互。 |
| 6 | `MSG_UPDATE_DATA` | `u8 player, u8 location, QueryChunk[]` | 更新某个玩家某区域的全部卡片查询数据。 | 用查询数据刷新区域卡片；MZONE 固定 7 个槽，SZONE 固定 8 个槽，其他区域按剩余 chunk 数。 |
| 7 | `MSG_UPDATE_CARD` | `u8 controller, u8 location, u8 sequence, QueryChunk` | 更新单张卡片查询数据。 | 刷新指定卡；对对手/观战视角需隐藏非公开字段。 |
| 8 | `MSG_REQUEST_DECK` | 空或实现相关 | 旧版内部请求卡组。当前 `ygopro` 客户端未处理。 | 普通前端可忽略；服务端/单机模式可能用 CTOS_UPDATE_DECK 另行同步。 |
| 10 | `MSG_SELECT_BATTLECMD` | `u8 player, u8 activatableCount, ActivatableInfo[activatableCount], u8 attackableCount, AttackableInfo[attackableCount], u8 canM2, u8 canEp` | 战斗阶段可发动效果、可攻击卡、是否能进 M2/EP。`ActivatableInfo=i32 code,u8 controller,u8 location,u8 sequence,i32 desc`；`AttackableInfo=i32 code,u8 controller,u8 location,u8 sequence,u8 directAttack`。 | 展示战斗阶段命令按钮和候选卡；用户选择后发送 `u32 (index << 16) | type`。 |
| 11 | `MSG_SELECT_IDLECMD` | `u8 player` 后依次为 `summonable/spSummonable/reposable/msetable/ssetable` 五组 `u8 count, SimpleCardInfo[count]`，再 `u8 activatableCount, ActivatableInfo[activatableCount], u8 canBp, u8 canEp, u8 canShuffle` | 主阶段可操作列表和阶段按钮。 | 展示通常召唤、特召、变更表示、盖放、发动、BP/EP/洗手按钮；响应为 `u32 (index << 16) | type`。 |
| 12 | `MSG_SELECT_EFFECTYN` | `u8 player, i32 code, u8 controller, u8 location, u8 sequence, u8 position, i32 desc` | 是否发动某卡效果。 | 显示确认对话，可高亮卡片；响应 `i32 1/0`。 |
| 13 | `MSG_SELECT_YESNO` | `u8 player, i32 desc` | 通用是/否问题。 | 显示系统描述；响应 `i32 1/0`。 |
| 14 | `MSG_SELECT_OPTION` | `u8 player, u8 count, i32[count] options` | 多选一选项描述 ID。 | 展示选项列表；响应选项下标 `i32 index`。 |
| 15 | `MSG_SELECT_CARD` | `u8 player, u8 cancelable, u8 min, u8 max, u8 count, CardInfo[count]` | 从候选卡中选择 `min..max` 张。 | 标记候选卡，支持面板模式；响应 `u8 count + indices`，可取消时 `i32 -1`。 |
| 16 | `MSG_SELECT_CHAIN` | `u8 player, u8 count, u8 specialCount, i32 hint0, i32 hint1, ChainInfo[count]` | 连锁候选。`ChainInfo=u8 edesc,u8 forced,i32 code,u8 controller,u8 location,u8 sequence,u8 subsequence,i32 desc`。 | 展示可连锁效果；若无强制项可选择不连锁；响应 `i32 index` 或 `-1`。 |
| 18 | `MSG_SELECT_PLACE` | `u8 player, u8 count, u32 flag` | 选择可放置区域。`flag` 是不可选位图，客户端取反后得到可选位。低 16 位为当前玩家 MZONE/SZONE，高 16 位为对方。 | 高亮可选区域；响应一个或多个 `player/location/sequence` 三元组。 |
| 19 | `MSG_SELECT_POSITION` | `u8 player, i32 code, u8 positions` | 为卡片选择表示形式，`positions` 是可选 `POS_*` 位图。 | 展示可选表示形式按钮；响应一个 `POS_*` 掩码。 |
| 20 | `MSG_SELECT_TRIBUTE` | `u8 player, u8 cancelable, u8 min, u8 max, u8 count, TributeInfo[count]` | 解放候选。`TributeInfo=i32 code,u8 controller,u8 location,u8 sequence,u8 releaseParam`。 | 高亮可解放卡，按 `releaseParam` 计算数量；响应候选下标列表或 `-1`。 |
| 22 | `MSG_SELECT_COUNTER` | `u8 player, u16 counterType, u16 counterCount, u8 count, CounterInfo[count]` | 选择指示物数量。`CounterInfo=i32 code,u8 controller,u8 location,u8 sequence,u16 counterCount`。 | 展示每张卡可选数量，累计到 `counterCount`；响应每张候选卡选择的 `u16` 数组。 |
| 23 | `MSG_SELECT_SUM` | `u8 mode, u8 player, i32 sumVal, u8 min, u8 max, u8 mustSelectCount, SumInfo[mustSelectCount], u8 count, SumInfo[count]` | 选择卡片使等级/数值满足总和。`SumInfo=i32 code,u8 controller,u8 location,u8 sequence,i32 opParam`。 | 必选卡先加入选择，展示其余候选；响应 `u8 count + indices`。 |
| 24 | `MSG_SELECT_DISFIELD` | `u8 player, u8 count, u32 flag` | 选择要禁用的区域，编码同 `MSG_SELECT_PLACE`。 | 高亮可禁用区域；响应位置三元组。 |
| 25 | `MSG_SORT_CARD` | `u8 player, u8 count, SimpleCardInfo[count]` | 对候选卡排序。 | 展示排序 UI；响应排序后的下标数组。 |
| 26 | `MSG_SELECT_UNSELECT_CARD` | `u8 player, u8 finishable, u8 cancelable, u8 min, u8 max, u8 selectableCount, CardInfo[selectableCount], u8 unselectableCount, CardInfo[unselectableCount]` | 增量式选/取消选卡。 | 每次点击发送 `u8 1,u8 index`；完成或取消时发送 `i32 -1`。 |
| 30 | `MSG_CONFIRM_DECKTOP` | `u8 player, u8 count, SimpleCardInfo[count]` | 展示卡组顶若干张，候选项实际只使用 `code`，其余 3 字节通常跳过。 | 更新卡组顶卡号，播放公开动画/日志；不响应。 |
| 31 | `MSG_CONFIRM_CARDS` | `u8 player, u8 skipPanel, u8 count, SimpleCardInfo[count]` | 公开指定卡片列表。 | 更新卡号，场上卡翻开高亮，手牌/卡组多张可走面板展示；不响应。 |
| 32 | `MSG_SHUFFLE_DECK` | `u8 player` | 洗主卡组。 | 播放洗牌动画，清理卡组可见信息。 |
| 33 | `MSG_SHUFFLE_HAND` | `u8 player, u8 count, i32[count] codes` | 洗手牌后给出新顺序卡号，非公开视角可能为 0。 | 重排手牌，按可见性更新卡号；不响应。 |
| 34 | `MSG_REFRESH_DECK` | `u8 player` | 旧版刷新卡组。 | 原版客户端只读取玩家并返回；现代前端通常可忽略或触发卡组区域刷新。 |
| 35 | `MSG_SWAP_GRAVE_DECK` | `u8 player` | 主卡组和墓地交换。 | 调整两区卡片容器、位置和序号，刷新显示。 |
| 36 | `MSG_SHUFFLE_SET_CARD` | `u8 location, u8 count, SetCardInfo[count]` | 洗切覆盖卡。`SetCardInfo=CardLocation oldLocation, CardLocation newLocation`。 | 按映射移动覆盖卡，不应暴露卡名；播放重排动画。 |
| 37 | `MSG_REVERSE_DECK` | 空 | 卡组顺序反转状态切换。 | 切换 `deck_reversed`，刷新卡组顶显示。 |
| 38 | `MSG_DECK_TOP` | `u8 player, u8 sequence, i32 code` | 更新卡组顶部某序号卡号。 | 设置对应 deck 顶卡 code；隐藏时 code 为 0。 |
| 39 | `MSG_SHUFFLE_EXTRA` | `u8 player, u8 count, i32[count] codes` | 洗额外卡组，非公开视角可能为 0。 | 重排额外卡组，保留公开额外卡可见信息。 |
| 40 | `MSG_NEW_TURN` | `u8 player` | 新回合玩家。 | 更新当前回合、回合计数、UI 指示，清理阶段选择状态。 |
| 41 | `MSG_NEW_PHASE` | `u16 phase` | 新阶段枚举。 | 更新阶段显示，清理上阶段临时状态。 |
| 42 | `MSG_CONFIRM_EXTRATOP` | `u8 player, u8 count, SimpleCardInfo[count]` | 展示额外卡组顶部若干张。 | 更新额外卡组顶卡号并播放公开动画；不响应。 |
| 50 | `MSG_MOVE` | `i32 code, CardLocation from, CardLocation to, i32 reason` | 卡片从一个位置移动到另一个位置，附带移动原因。 | 执行移动动画，更新区域、序号、表示形式、叠放关系；按 `reason` 播放送墓/除外等效果。 |
| 53 | `MSG_POS_CHANGE` | `i32 code, ShortCardLocation card, u8 previousPosition, u8 currentPosition` | 卡片表示形式变化。 | 更新卡片表示形式，播放翻转/转向动画。 |
| 54 | `MSG_SET` | `i32 code, CardLocation location` | 盖放卡片。 | 设置卡片到覆盖状态，更新 code 和位置，播放盖放动画。 |
| 55 | `MSG_SWAP` | `i32 code1, CardLocation location1, i32 code2, CardLocation location2` | 两张卡交换位置。 | 交换两张卡对象的位置/序号/表示形式并播放移动。 |
| 56 | `MSG_FIELD_DISABLED` | `u32 disabledField` | 禁用区域位图。 | 更新场地区域禁用遮罩。 |
| 60 | `MSG_SUMMONING` | `i32 code, CardLocation location` | 通常召唤宣言中。 | 显示召唤动画/日志，高亮卡片。 |
| 61 | `MSG_SUMMONED` | 空 | 通常召唤完成。 | 清理召唤临时效果，刷新场面。 |
| 62 | `MSG_SPSUMMONING` | `i32 code, CardLocation location` | 特殊召唤宣言中。 | 显示特召动画/日志，高亮卡片。 |
| 63 | `MSG_SPSUMMONED` | 空 | 特殊召唤完成。 | 清理特召临时效果，刷新场面。 |
| 64 | `MSG_FLIPSUMMONING` | `i32 code, CardLocation location` | 翻转召唤宣言中。 | 显示翻转召唤动画/日志。 |
| 65 | `MSG_FLIPSUMMONED` | 空 | 翻转召唤完成。 | 清理临时效果，刷新场面。 |
| 70 | `MSG_CHAINING` | `i32 code, u8 controller, u8 location, u8 sequence, u8 subsequence, ShortCardLocation chainCardLocation, i32 desc, u8 chainCount` | 新连锁信息。 | 在连锁列表加入条目，显示发动卡、描述、连锁编号和动画。 |
| 71 | `MSG_CHAINED` | `u8 chainCount` | 连锁成功加入。 | 播放连锁确认效果。 |
| 72 | `MSG_CHAIN_SOLVING` | `u8 chainCount` | 正在处理某连锁。 | 高亮当前处理连锁。 |
| 73 | `MSG_CHAIN_SOLVED` | `u8 chainCount` | 某连锁处理完毕。 | 标记连锁已处理，移除/淡化高亮。 |
| 74 | `MSG_CHAIN_END` | 空 | 连锁全部结束。 | 清空连锁 UI 和目标高亮。 |
| 75 | `MSG_CHAIN_NEGATED` | `u8 chainCount` | 某连锁发动被无效。 | 播放无效效果，标记对应连锁。 |
| 76 | `MSG_CHAIN_DISABLED` | `u8 chainCount` | 某连锁效果被禁用。 | 播放禁用/无效提示。 |
| 80 | `MSG_CARD_SELECTED` | `u8 player, u8 count, CardLocation[count]` | 旧版/回放中的已选卡通知。 | 原版客户端直接返回；回放可推进指针，普通前端可忽略。 |
| 81 | `MSG_RANDOM_SELECTED` | `u8 player, u8 count, CardLocation[count]` | 随机选中的卡。 | 高亮随机选中的卡一段时间；不响应。 |
| 83 | `MSG_BECOME_TARGET` | `u8 count, CardLocation[count]` | 成为效果目标的卡。 | 高亮目标卡，加入当前连锁 target 集合，播放目标动画/日志。 |
| 90 | `MSG_DRAW` | `u8 player, u8 count, i32[count] codes` | 抽卡结果；非公开视角可能为 0。 | 从卡组移动到手牌，按 code 更新公开卡，播放抽卡动画。 |
| 91 | `MSG_DAMAGE` | `u8 player, i32 value` | 玩家受到伤害。 | 扣减 LP，播放伤害动画/音效。 |
| 92 | `MSG_RECOVER` | `u8 player, i32 value` | 玩家回复 LP。 | 增加 LP，播放回复动画/音效。 |
| 93 | `MSG_EQUIP` | `CardLocation equipCard, CardLocation targetCard` | 装备卡与目标卡建立装备关系。 | 更新装备关系，刷新卡片箭头/连线。 |
| 94 | `MSG_LPUPDATE` | `u8 player, i32 lp` | 直接设置玩家 LP。 | 将 LP 设置为指定值，刷新显示。 |
| 95 | `MSG_UNEQUIP` | `CardLocation equipCard` | 解除装备关系。 | 移除装备关系和 UI 连线。 |
| 96 | `MSG_CARD_TARGET` | `CardLocation card, CardLocation target` | 某卡指定目标。 | 建立 target 关系，显示目标连线/高亮。 |
| 97 | `MSG_CANCEL_TARGET` | `CardLocation card, CardLocation target` | 取消目标关系。 | 移除 target 关系和 UI 高亮。 |
| 100 | `MSG_PAY_LPCOST` | `u8 player, i32 cost` | 支付 LP 作为 COST。 | 扣减 LP，日志中标记为支付 COST。 |
| 101 | `MSG_ADD_COUNTER` | `u16 counterType, u8 controller, u8 location, u8 sequence, u16 count` | 增加指示物。 | 更新指定卡的指示物数量。 |
| 102 | `MSG_REMOVE_COUNTER` | `u16 counterType, u8 controller, u8 location, u8 sequence, u16 count` | 移除指示物。 | 更新指定卡的指示物数量。 |
| 110 | `MSG_ATTACK` | `CardLocation attacker, CardLocation defender` | 攻击宣言；直接攻击时 defender 可为空位置。 | 播放攻击宣言，设置攻击箭头和高亮。 |
| 111 | `MSG_BATTLE` | `CardStats attacker, u8 attackerBattleState, CardStats defender, u8 defenderBattleState` | 战斗计算双方攻防和状态。 | 显示伤害计算、破坏/战斗状态动画。 |
| 112 | `MSG_ATTACK_DISABLED` | 空 | 攻击被阻止。 | 清除攻击箭头，显示攻击无效提示。 |
| 113 | `MSG_DAMAGE_STEP_START` | 空 | 伤害步骤开始。 | 切换战斗内部状态。 |
| 114 | `MSG_DAMAGE_STEP_END` | 空 | 伤害步骤结束。 | 清理伤害步骤临时状态。 |
| 120 | `MSG_MISSED_EFFECT` | `CardLocation card, i32 code` | 错过发动时点的效果。 | 可记录日志或提示，不改变场面。 |
| 121 | `MSG_BE_CHAIN_TARGET` | 未在当前客户端实现 | 旧版/保留：成为连锁目标。 | 当前 `ygopro` 和 Neos 未处理，建议作为未知 MSG 记录并跳过。 |
| 122 | `MSG_CREATE_RELATION` | 未在当前客户端实现 | 旧版/保留：创建关系。 | 当前 `ygopro` 和 Neos 未处理，建议忽略或记录。 |
| 123 | `MSG_RELEASE_RELATION` | 未在当前客户端实现 | 旧版/保留：释放关系。 | 当前 `ygopro` 和 Neos 未处理，建议忽略或记录。 |
| 130 | `MSG_TOSS_COIN` | `u8 player, u8 count, u8[count] results` | 投硬币结果。 | 展示硬币结果动画/日志。 |
| 131 | `MSG_TOSS_DICE` | `u8 player, u8 count, u8[count] results` | 掷骰结果。 | 展示骰子结果动画/日志。 |
| 132 | `MSG_ROCK_PAPER_SCISSORS` | `u8 player` | 请求玩家猜拳。 | 打开猜拳选择 UI；响应 `u8 1/2/3`。 |
| 133 | `MSG_HAND_RES` | `u8 result` | 猜拳双方结果，低 2 位是玩家 1，高 2 位是玩家 2。 | 展示双方猜拳结果；原版映射为 `1=ROCK,2=SCISSORS,3=PAPER`。 |
| 140 | `MSG_ANNOUNCE_RACE` | `u8 player, u8 count, u32 availableRaces` | 宣言种族，需从可用位图中选 `count` 个。 | 展示种族多选 UI；响应种族位图。 |
| 141 | `MSG_ANNOUNCE_ATTRIB` | `u8 player, u8 count, u32 availableAttributes` | 宣言属性，需从可用位图中选 `count` 个。 | 展示属性多选 UI；响应属性位图。 |
| 142 | `MSG_ANNOUNCE_CARD` | `u8 player, u8 count, i32[count] opcodes` | 宣言卡名，`opcodes` 是过滤表达式。 | 打开卡名输入/搜索，并按 opcode 校验；响应卡号。 |
| 143 | `MSG_ANNOUNCE_NUMBER` | `u8 player, u8 count, i32[count] numbers` | 宣言数字候选。 | 展示数字选项；响应候选下标。 |
| 160 | `MSG_CARD_HINT` | `CardLocation card, u8 type, i32 value` | 卡片提示，例如效果标记、描述值。 | 更新卡片提示标记/浮层。 |
| 161 | `MSG_TAG_SWAP` | `u8 player, u8 mzoneCount, u8 extraCount, u8 pzoneCount, u8 handCount, i32 topCode, i32[handCount] handCards, i32[extraCount] extraCards` | TAG 决斗切换玩家后的区域数量和可见卡号。 | 调整卡组、手牌、额外卡组数量，更新 top card 和可见卡号，播放切换动画。 |
| 162 | `MSG_RELOAD_FIELD` | `u8 duelRule`，然后两个玩家的 `i32 lp, MZONE[7], SZONE[8], u8 deckCount, u8 handCount, u8 graveCount, u8 removedCount, u8 extraCount, u8 extraPCount`，最后 `u8 chainCount, ReloadChainInfo[chainCount]` | 完整场地重载。MZONE 槽：`u8 occupied`，占用时再读 `u8 position,u8 overlayCount`；SZONE 槽：`u8 occupied`，占用时再读 `u8 position`；`ReloadChainInfo=i32 code,u8 chainCardController,u8 chainCardLocation,u8 chainCardSequence,u8 chainCardSubsequence,u8 triggerController,u8 triggerLocation,u8 triggerSequence,i32 desc`。 | 清空并重建整个场地、LP、区域占位、额外 P 数、当前连锁列表，然后刷新全部卡片。 |
| 163 | `MSG_AI_NAME` | `u16 byteLength, utf8[byteLength], u8 nul` | 单机/回放 AI 名称。 | 单机客户端更新对手/AI 名称；普通联机前端可忽略。 |
| 164 | `MSG_SHOW_HINT` | `u16 byteLength, utf8[byteLength], u8 nul` | 单机/回放提示文本。 | 显示提示弹窗；普通联机前端可忽略。 |
| 165 | `MSG_PLAYER_HINT` | `u8 player, u8 type, i32 value` | 玩家级提示。 | 更新玩家提示标记，例如可见提示、标记值或描述。 |
| 170 | `MSG_MATCH_KILL` | `i32 code` | Match Kill 卡号。 | 记录胜利卡，用于后续 `MSG_WIN` 文案。 |
| 180 | `MSG_CUSTOM_MSG` | 实现自定义 | 扩展消息。 | 需要按服务端约定处理；默认记录并跳过。 |
| 221 | `MSG_RESET_TIME` | `i8 player, i16 time` | 重置玩家剩余时间。 | 更新倒计时显示。 |
| 235 | `MSG_SIBYL_NAME` | `utf16le[100] * 6` | Neos 扩展/回放用双方昵称：`name_0,name_0_tag,name_0_c,name_1,name_1_tag,name_1_c`。 | Neos 用于回放模式填充双方昵称；非 Neos 协议可视为扩展消息。 |

## 视角和隐藏规则

客户端不能把收到的 `code` 一律当成真实卡号。服务端会根据玩家视角把非公开区域的 `code` 写成 `0`，或通过 `0x80000000` 标记公开状态。前端应遵循以下规则：

- `DRAW`, `SHUFFLE_HAND`, `SHUFFLE_EXTRA`, `DECK_TOP`, `CONFIRM_*`, `TAG_SWAP` 中 `code == 0` 表示该视角不可见，UI 应保留背面或未知卡。
- `UPDATE_DATA` 和 `UPDATE_CARD` 的 `CardQuery` 由 `QUERY_*` flags 决定字段是否存在；不要按固定长度读取。
- `LOCATION_OVERLAY` 通常和基础 location 组合使用，读取卡片时要用第 4 字节作为叠放序号。
- `SELECT_*` 候选卡里的 `code` 也可能被隐藏；交互逻辑应优先用候选下标响应，而不是依赖卡号匹配。

## Neos 处理路径

Neos 的网络入口是 `src/service/onSocketMessage.ts`，先用 `YgoProPacket.deserialize` 按 `[u16 length][u8 proto]` 拆包，再由 `adaptStoc` 分发。`STOC_GAME_MSG` 在 `stocGameMsg/mod.ts` 读取第一个字节作为 `MSG`，剩余字节交给具体 adapter。业务层在 `src/service/duel/gameMsg.ts` 根据 protobuf oneof 更新 store、场地、动画，并在交互类 MSG 上发送 `CTOS_RESPONSE`。

当前 Neos 只显式处理一部分 MSG。未处理的会进入 `unimplemented`，业务层只记录/忽略。补齐前端时建议按上表逐项增加 adapter 和 handler。

## 已发现的实现差异

| 位置 | 差异 | 建议 |
| --- | --- | --- |
| `ygopro-msg-encode/src/protos/msg/proto/random-selected.ts` | 当前实现把 `MSG_RANDOM_SELECTED` 的数组写成 `i32[count]`。`ygopro` C++ 和 Neos 都按 `CardLocation[count]` 读取。 | 按 `CardLocation` 修正，否则 overlay/位置高亮会错。 |
| `ygopro-msg-encode/src/protos/msg/proto/become-target.ts` | 当前实现把 `MSG_BECOME_TARGET` 的目标写成 `i32[count]`。`ygopro` C++ 和 Neos 都按 `CardLocation[count]` 读取。 | 按 `CardLocation` 修正。 |
| `Neos/src/api/ocgcore/ocgAdapter/stoc/stocGameMsg/penetrate.json` | `MSG_MOVE.reason` 被声明为 `uint8`，但 C++ 和 `ygopro-msg-encode` 都是 `i32`。 | 改为 4 字节整数，避免后续字段或粘包解析错位。 |
| `Neos/src/api/ocgcore/ocgAdapter/protoDecl.ts` | `MSG_CONFIRM_DECKTOP` 与 `MSG_CONFIRM_CARDS` 的 ID 和 ocgcore 常量相反。当前二者共用 handler，所以影响有限。 | 常量名应修正为 `30=CONFIRM_DECKTOP`, `31=CONFIRM_CARDS`。 |
| Neos 猜拳显示 | 原版和 `ygopro-msg-encode` 使用 `1=ROCK,2=SCISSORS,3=PAPER`。 | UI 枚举应和这个映射一致，否则双方结果展示可能错位。 |

## 主要源码索引

- `ygopro/gframe/network.h`：CTOS/STOC 外层 proto 和部分 MSG 常量。
- `ygopro/gframe/duelclient.cpp`：`ClientRead`, `HandleSTOCPacketLan`, `ClientAnalyze`, `SetResponseI/B`, `SendResponse`。
- `ygopro/gframe/event_handler.cpp`：交互类 MSG 的响应字节生成。
- `ygopro-msg-encode/src/proto-base/ygopro-proto-base.ts`：外层包序列化。
- `ygopro-msg-encode/src/protos/stoc/proto/game-msg.ts`：`STOC_GAME_MSG` 到 `MSG` registry。
- `ygopro-msg-encode/src/protos/msg/base.ts`：内层 `MSG` 的 `msg_id + payload` 编码。
- `ygopro-msg-encode/src/protos/msg/proto`：各 MSG 的 TypeScript 字段定义。
- `Neos/src/api/ocgcore/ocgAdapter/packet.ts`：Neos 外层拆包/封包。
- `Neos/src/api/ocgcore/ocgAdapter/stoc/stocGameMsg/mod.ts`：Neos 内层 MSG adapter。
- `Neos/src/api/ocgcore/ocgAdapter/ctos/ctosGameMsgResponse`：Neos `CTOS_RESPONSE` 编码。
- `Neos/src/service/duel/gameMsg.ts`：Neos 业务层处理。
