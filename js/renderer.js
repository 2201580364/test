(function() {
  'use strict';

  /**
   * Renderer class - handles all canvas drawing.
   * @param {CanvasRenderingContext2D} canvasContext - the canvas 2D context
   * @param {number} gridWidth - number of columns in the game grid
   * @param {number} gridHeight - number of rows in the game grid
   * @param {number} cellSize - pixel size of each cell
   */
  class Renderer {
    constructor(canvasContext, gridWidth, gridHeight, cellSize) {
      this.ctx = canvasContext;
      this.gridWidth = gridWidth;
      this.gridHeight = gridHeight;
      this.cellSize = cellSize;
    }

    /**
     * Clears the entire canvas.
     */
    clear() {
      this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
    }

    /**
     * Draws the game state: grid background, snake, food, and score.
     * @param {Object} state - {snake, food, isGameOver}
     * @param {number} score - current score
     */
    draw(state, score) {
      this.clear();
      this._drawGrid();
      if (state.food) {
        this._drawFood(state.food);
      }
      this._drawSnake(state.snake);
      this._drawScore(score);
    }

    /**
     * Displays a "Game Over" overlay on the canvas.
     */
    showGameOver() {
      const ctx = this.ctx;
      const canvasW = ctx.canvas.width;
      const canvasH = ctx.canvas.height;
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.fillRect(0, 0, canvasW, canvasH);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 40px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Game Over', canvasW / 2, canvasH / 2);
      ctx.restore();
    }

    /** Private: draws checkerboard grid background */
    _drawGrid() {
      const ctx = this.ctx;
      const size = this.cellSize;
      const cols = this.gridWidth;
      const rows = this.gridHeight;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          ctx.fillStyle = (row + col) % 2 === 0 ? '#95c11f' : '#aad139';
          ctx.fillRect(col * size, row * size, size, size);
        }
      }
    }

    /** Private: draws a red circle for food */
    _drawFood(food) {
      const ctx = this.ctx;
      const size = this.cellSize;
      const x = food.x * size + size / 2;
      const y = food.y * size + size / 2;
      const radius = size / 2 - 2;
      ctx.save();
      ctx.fillStyle = '#e74c3c';
      ctx.shadowColor = '#c0392b';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fill();
      ctx.restore();
    }

    /** Private: draws the snake body with gradient from bright to dark green */
    _drawSnake(snake) {
      if (!snake || snake.length === 0) return;
      const ctx = this.ctx;
      const size = this.cellSize;
      const len = snake.length;
      for (let i = len - 1; i >= 0; i--) {
        const segment = snake[i];
        const brightness = 1 - (i / len) * 0.5;
        const r = Math.floor(40 * brightness);
        const g = Math.floor(180 * brightness);
        const b = Math.floor(40 * brightness);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        const x = segment.x * size;
        const y = segment.y * size;
        const pad = 1;
        ctx.fillRect(x + pad, y + pad, size - pad * 2, size - pad * 2);
      }
    }

    /** Private: draws the current score text */
    _drawScore(score) {
      const ctx = this.ctx;
      ctx.save();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`Score: ${score}`, 10, 10);
      ctx.restore();
    }
  }

  // Expose to window
  window.SnakeGame = window.SnakeGame || {};
  window.SnakeGame.Renderer = Renderer;
})();
