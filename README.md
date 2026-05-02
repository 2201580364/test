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

```text
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

## 配置与启动方法

### 1. 环境要求

本项目是一款纯浏览器端游戏，对运行环境的要求极低：

- **浏览器**：任何现代浏览器（Chrome、Firefox、Safari、Edge）的最新两个大版本即可完美运行。
- **无需 Node.js**：项目不依赖 Node.js 运行环境，无需 `npm install` 或任何包管理器。
- **零外部依赖**：所有代码使用浏览器原生 ES Modules 和 Web API 实现，不引入任何第三方库或框架。
- **操作系统**：跨平台支持 Windows、macOS、Linux 以及移动端浏览器。

### 2. 本地启动方式

提供两种本地运行方式，任选其一即可。

#### 方式一：直接打开 HTML 文件（简单快速）

直接在浏览器中打开项目根目录下的 `index.html` 文件（双击或用浏览器「打开文件」菜单）。适用于大多数日常使用场景。

> **注意**：部分浏览器可能因安全策略限制 `file://` 协议下的 ES Modules 加载。如遇此问题，请使用方式二。

#### 方式二：本地静态服务器（推荐）

使用任意本地静态文件服务器在项目根目录启动服务，可避免 ES Modules 的 CORS 跨域限制。

**使用 Python 内置服务器：**

```bash
python -m http.server 8000
```

然后在浏览器访问 `http://localhost:8000`。

**使用 npx serve：**

```bash
npx serve .
```

按终端提示的地址（通常 `http://localhost:3000`）访问即可。

### 3. 可配置项说明

游戏的核心参数集中在 `js/modules/m5-game-controller.js` 文件中，通过以下三个常量进行控制：

| 参数 | 默认值 | 说明 | 所在位置 |
|------|--------|------|----------|
| `TICK_INTERVAL` | `150`（毫秒） | 控制蛇的移动速度。值越小蛇移动越快，越大越慢。 | `js/modules/m5-game-controller.js` |
| `GRID_WIDTH` | `20` | 游戏网格的横向格子数。决定游戏区域宽度（格子数 × 像素）。 | `js/modules/m5-game-controller.js` |
| `GRID_HEIGHT` | `20` | 游戏网格的纵向格子数。决定游戏区域高度（格子数 × 像素）。 | `js/modules/m5-game-controller.js` |
| `CELL_SIZE` | `24`（像素） | 每个格子的像素大小。Canvas 实际尺寸 = 格子数 × 该值。 | `js/modules/m5-game-controller.js` |

### 4. 目录结构说明

项目采用扁平化的模块目录组织，各文件职责明确：

```text
snake-game/
├── README.md                         ← 项目文档
├── index.html                        ← 单页应用入口，定义 Canvas 与 UI 结构
├── css/
│   └── style.css                     ← 全局样式文件，采用 BEM 命名规范
└── js/
    ├── main.js                       ← 应用入口，DOM 就绪后引导启动
    └── modules/
        ├── m1-game-core.js           ← M1 游戏核心逻辑（Game 类）
        ├── m2-keyboard.js            ← M2 键盘控制（KeyboardController 类）
        ├── m3-renderer.js            ← M3 Canvas 渲染器（Renderer 类）
        ├── m4-scoreboard.js          ← M4 排行榜与本地存储
        └── m5-game-controller.js     ← M5 游戏流程控制器（整合模块）
```

- **`css/style.css`** — 全局样式，采用 BEM 命名规范，涵盖页面布局、Canvas 容器、按钮控件、排行榜面板等样式定义。
- **`js/main.js`** — 应用入口文件，监听 `DOMContentLoaded` 事件后调用 M5 的 `initGame()` 完成初始化，并绑定暂停/恢复/重启按钮事件。
- **`js/modules/`** — 模块目录，按照 M1 至 M5 的编号存放各功能模块，每个文件对应一个独立职责的模块。

### 5. 修改游戏参数的简要指引

如需调整游戏的速度、网格尺寸或渲染大小，只需编辑 `js/modules/m5-game-controller.js` 文件中的对应常量即可：

- **调整蛇移动速度**：修改 `TICK_INTERVAL` 常量值（单位：毫秒）。例如设为 `100` 让蛇移动更快，设为 `200` 让蛇移动更慢。
- **调整游戏网格尺寸**：修改 `GRID_WIDTH` 和 `GRID_HEIGHT` 常量值（单位：格子数）。例如设为 `30 × 30` 可获得更大的游戏区域。
- **调整渲染像素大小**：修改 `CELL_SIZE` 常量值（单位：像素）。例如设为 `32` 让每个格子更大，Canvas 整体尺寸会自动等比放大。

所有参数修改后刷新浏览器即可生效，无需重新编译或构建。

---

## 快速开始

1. 克隆项目到本地。
2. 使用任意 HTTP 静态文件服务器在项目根目录启动服务（例如 `python -m http.server 8080` 或 `npx serve .`），因为 ES Modules 需要通过 HTTP(S) 加载。
3. 在浏览器中打开 `http://localhost:8080`。
4. 使用方向键控制蛇移动，点击 Pause / Resume / Restart 按钮控制游戏流程。

无需编译、无需 `npm install`。
