# Snake Game

## 项目概述

Snake Game 是一款基于 HTML5 Canvas 的浏览器贪吃蛇游戏，采用纯原生 JavaScript ES Modules 构建，零外部依赖。玩家通过键盘方向键控制蛇的移动，吃掉随机生成的食物获得分数。游戏结束条件包括撞墙和撞到自己身体。历史最高分通过排行榜持久化保存。

项目遵循五模块架构设计，各模块职责清晰、耦合度低，便于测试与维护。

---

## 项目技术架构

### 技术栈说明

| 层级 | 技术选型 | 说明 |
|------|----------|------|
| 渲染层 | HTML5 Canvas 2D API | 绘制蛇身、食物、网格及 Game Over 遮罩 |
| 模块系统 | Vanilla JS ES Modules (`import`/`export`) | 原生浏览器模块加载，无需打包工具 |
| 样式 | CSS3，BEM 命名约定 | 布局、颜色、控件样式，语义化类名 |
| 持久化 | `localStorage` | 排行榜数据本地持久化存储 |

### 五模块架构

#### M1 — 游戏核心逻辑

- **路径**：`js/modules/m1-game-core.js`
- **核心类**：`Game`
- **职责**：蛇移动、食物生成、碰撞检测（墙壁与自身）、得分计算。纯逻辑模块，不依赖 UI 或 DOM。
- **关键接口**：
  - `new Game(gridWidth, gridHeight)` — 创建游戏实例
  - `start()` — 初始化/重置游戏状态
  - `move(direction: 'UP'|'DOWN'|'LEFT'|'RIGHT')` — 单步推进
  - `getState()` — 返回只读状态快照 `{ snake, food, score, gameOver, gridWidth, gridHeight }`
  - `reset()` — 强制重置
  - `isGameOver()` — 查询游戏是否结束
  - `onGameOver(callback)` — 注册游戏结束回调
- **设计约束**：方向 180° 反转被禁止；未知方向输入保持当前方向；`start()` 具有重入保护。

#### M2 — 键盘控制

- **路径**：`js/modules/m2-keyboard.js`
- **核心类**：`KeyboardController`
- **职责**：监听 `keydown` 事件，将 ArrowUp/ArrowDown/ArrowLeft/ArrowRight 映射为 `'UP'/'DOWN'/'LEFT'/'RIGHT'` 方向指令，调用 M1 `Game.move()`。阻止反向移动和游戏结束后的输入。
- **关键接口**：
  - `new KeyboardController(game)` — 绑定 Game 实例
  - `start()` — 注册事件监听
  - `stop()` — 移除事件监听

#### M3 — Canvas 渲染器

- **路径**：`js/modules/m3-renderer.js`
- **核心类**：`Renderer`
- **职责**：接收游戏状态对象（由 M1 `getState()` 提供）并绘制到 Canvas 上。绘制内容包括：背景、网格线、食物（带光晕效果）、蛇身（头部与身体使用不同颜色）、Game Over 遮罩与文字。
- **关键接口**：
  - `new Renderer(canvas, cellSize)` — 绑定 Canvas 元素并设定每格像素
  - `render(gameState)` — 完整绘制一帧

#### M4 — 排行榜与本地存储

- **路径**：`js/modules/m4-scoreboard.js`
- **导出函数**：
  - `saveScore(score)` — 将得分持久化到 `localStorage`（key: `snake_leaderboard`，最多保留 10 条）
  - `getLeaderboard()` — 返回排序后的排行榜数组
  - `renderLeaderboard(container)` — 在指定 DOM 容器中渲染排行榜 HTML
- **设计要点**：内置 `localStorage` 可用性检测；对损坏数据做容错处理；得分非负校验；去重与排序逻辑。

#### M5 — 游戏流程控制器

- **路径**：`js/modules/m5-game-controller.js` + `js/main.js` + `index.html`
- **职责**：整合 M1/M2/M3/M4，管理完整游戏生命周期。基于 `requestAnimationFrame` 驱动游戏循环（tick 间隔 150ms），提供暂停/恢复/重启控制，在游戏结束时自动保存得分并刷新排行榜。
- **关键接口**：
  - `initGame({ canvasId, scoreElementId, leaderboardContainerId })` — 初始化全部模块并启动循环
  - `pauseGame()` — 暂停
  - `resumeGame()` — 恢复
  - `restartGame()` — 重启
- **入口文件**：`js/main.js` 在 `DOMContentLoaded` 后调用 `initGame()`，并绑定 Pause / Resume / Restart 按钮事件。

### 模块间依赖关系与数据流

```
                  ┌──────────────────────────┐
                  │     index.html / DOM      │
                  │  (Canvas, Score, Buttons) │
                  └────────────┬─────────────┘
                               │
                  ┌────────────▼─────────────┐
                  │  js/main.js              │
                  │  (DOM 就绪后引导启动)      │
                  └────────────┬─────────────┘
                               │ initGame()
                  ┌────────────▼─────────────┐
                  │  M5: Game Controller     │
                  │  (协调者，依赖 M1/M2/M3/M4)│
                  └──┬─────┬──────┬──────┬───┘
                     │     │      │      │
           ┌─────────▼┐ ┌──▼──┐ ┌─▼───┐ ┌▼─────────┐
           │ M2: 键盘  │ │ M1  │ │ M3  │ │ M4: 排行榜│
           │ 控制器    │ │ 核心 │ │ 渲染 │ │ & 存储    │
           └─────┬─────┘ └──┬──┘ └──▲──┘ └──────────┘
                 │          │       │
                 │ move()   │getState()
                 └──────────►       │
                          │         │
                          └─────────┘
```

- **M5 → M1**：M5 创建 `Game` 实例，在每次 tick 调用 `move()`，并注册 `onGameOver` 回调。
- **M5 → M2**：M5 创建 `KeyboardController` 并传入 M1 的 `Game` 实例，M2 调用 `game.move()`。
- **M5 → M3**：M5 在游戏循环中调用 `renderer.render(game.getState())`，将 M1 的状态快照传递给渲染器。
- **M5 → M4**：游戏结束时 M5 调用 `saveScore(score)` 保存得分，调用 `renderLeaderboard(container)` 更新排行榜 DOM。
- **M4 独立**：M4 仅依赖 `localStorage` 和 DOM，不依赖其他模块。

### 完整项目文件结构树

```
snake-game/
├── README.md                            ← 项目文档（本文件）
├── index.html                           ← 单页应用入口，定义 Canvas 与 UI 结构
├── css/
│   └── style.css                        ← 全局样式，BEM 命名
└── js/
    ├── main.js                          ← 启动入口，DOM 就绪后初始化 M5
    └── modules/
        ├── m1-game-core.js              ← M1 游戏核心逻辑（Game 类）
        ├── m2-keyboard.js               ← M2 键盘控制（KeyboardController 类）
        ├── m3-renderer.js               ← M3 Canvas 渲染器（Renderer 类）
        ├── m4-scoreboard.js             ← M4 排行榜与本地存储
        └── m5-game-controller.js        ← M5 游戏流程控制器（整合模块）
```

---

## 快速开始

1. 克隆项目到本地。
2. 使用任意 HTTP 静态文件服务器在项目根目录启动服务（例如 `python -m http.server 8080` 或 `npx serve .`），因为 ES Modules 需要通过 HTTP(S) 加载。
3. 在浏览器中打开 `http://localhost:8080`。
4. 使用方向键控制蛇移动，点击 Pause / Resume / Restart 按钮控制游戏流程。

无需编译、无需 `npm install`。
