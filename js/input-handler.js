(function() {
  'use strict';

  const MODULE_NAME = 'InputHandler';

  // 按键到游戏方向的映射
  const KEY_DIRECTION_MAP = {
    'ArrowUp': 'UP',
    'ArrowDown': 'DOWN',
    'ArrowLeft': 'LEFT',
    'ArrowRight': 'RIGHT',
    'w': 'UP',
    'a': 'LEFT',
    's': 'DOWN',
    'd': 'RIGHT'
  };

  /**
   * 输入处理类，负责将键盘事件转换为游戏引擎的方向指令
   */
  class InputHandler {
    /**
     * @param {Object} gameEngine - GameEngine 实例，需包含 setDirection 方法
     */
    constructor(gameEngine) {
      if (!gameEngine || typeof gameEngine.setDirection !== 'function') {
        throw new TypeError('InputHandler 需要有效的 GameEngine 实例，且必须实现 setDirection 方法');
      }

      /** @private */
      this._gameEngine = gameEngine;
      /** @private */
      this._bound = false;

      // 绑定 this，确保在事件处理中能正确引用实例
      this._handleKeyDown = this._handleKeyDown.bind(this);
    }

    /**
     * 绑定键盘事件监听，开始处理方向输入
     * 可多次安全调用（内部会先解绑再绑定）
     */
    bind() {
      if (this._bound) {
        this.unbind();
      }
      document.addEventListener('keydown', this._handleKeyDown);
      this._bound = true;
    }

    /**
     * 解绑键盘事件监听，停止处理方向输入
     * 可安全调用，即使尚未绑定也不会报错
     */
    unbind() {
      if (this._bound) {
        document.removeEventListener('keydown', this._handleKeyDown);
        this._bound = false;
      }
    }

    /**
     * 键盘按下事件的内部处理方法
     * @private
     * @param {KeyboardEvent} event
     */
    _handleKeyDown(event) {
      const key = event.key;
      // 尝试直接匹配，若失败则尝试小写字母匹配（兼容大小写）
      const direction = KEY_DIRECTION_MAP[key] || KEY_DIRECTION_MAP[key.toLowerCase()];
      if (direction) {
        // 阻止页面滚动等默认行为
        event.preventDefault();
        this._gameEngine.setDirection(direction);
      }
    }
  }

  // 确保全局命名空间存在
  window.SnakeGame = window.SnakeGame || {};
  window.SnakeGame[MODULE_NAME] = InputHandler;
})();
