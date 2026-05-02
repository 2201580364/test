/**
 * M3 - Game Renderer
 * Draws the game state onto an HTML5 Canvas.
 * Handles visual representation only.
 *
 * @module m3-renderer
 */

/**
 * @typedef {Object} GameState
 * @property {Array<{x: number, y: number}>} snake  - Snake body segments (head first)
 * @property {{x: number, y: number}}          food   - Food position in grid coords
 * @property {number}                          gridWidth  - Number of cells horizontally
 * @property {number}                          gridHeight - Number of cells vertically
 * @property {boolean}                         [isGameOver] - Whether the game has ended
 */

/**
 * Renders the snake game onto a canvas element.
 */
class Renderer {
  /**
   * @param {HTMLCanvasElement} canvas   - The canvas to draw on
   * @param {number}           cellSize  - Pixels per grid cell (default 20)
   */
  constructor(canvas, cellSize) {
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new TypeError('canvas must be an HTMLCanvasElement');
    }

    /** @type {HTMLCanvasElement} */
    this.canvas = canvas;

    /** @type {CanvasRenderingContext2D} */
    this.ctx = canvas.getContext('2d');

    /** @type {number} Pixels per grid cell */
    this.cellSize = typeof cellSize === 'number' && cellSize > 0 ? cellSize : 20;

    // Color palette
    this.colors = {
      background: '#1a1a2e',
      grid: '#16213e',
      snakeHead: '#00d2ff',
      snakeBody: '#0095b6',
      food: '#ff6b6b',
      foodGlow: 'rgba(255, 107, 107, 0.3)',
      gameOverOverlay: 'rgba(0, 0, 0, 0.5)',
      gameOverText: '#ffffff',
    };
  }

  /**
   * Draw the entire game state: grid, food, snake.
   * @param {GameState} gameState
   */
  render(gameState) {
    if (!gameState || typeof gameState !== 'object') {
      return;
    }

    const { snake, food, gridWidth, gridHeight, isGameOver } = gameState;
    const { ctx, canvas, cellSize } = this;

    // Resize canvas to match grid dimensions exactly (if needed)
    const expectedWidth = gridWidth * cellSize;
    const expectedHeight = gridHeight * cellSize;
    if (canvas.width !== expectedWidth || canvas.height !== expectedHeight) {
      canvas.width = expectedWidth;
      canvas.height = expectedHeight;
    }

    // 1. Clear and draw background
    ctx.fillStyle = this.colors.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Draw grid lines
    this._drawGrid(gridWidth, gridHeight);

    // 3. Draw food
    if (food && typeof food.x === 'number' && typeof food.y === 'number') {
      this._drawFood(food.x, food.y);
    }

    // 4. Draw snake
    if (Array.isArray(snake) && snake.length > 0) {
      this._drawSnake(snake);
    }

    // 5. Game over overlay
    if (isGameOver) {
      this._drawGameOver();
    }
  }

  /**
   * Draw grid lines.
   * @param {number} gridWidth
   * @param {number} gridHeight
   */
  _drawGrid(gridWidth, gridHeight) {
    const { ctx, cellSize } = this;
    const totalW = gridWidth * cellSize;
    const totalH = gridHeight * cellSize;

    ctx.strokeStyle = this.colors.grid;
    ctx.lineWidth = 0.5;

    // Vertical lines
    for (let x = 0; x <= gridWidth; x++) {
      const px = x * cellSize;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, totalH);
      ctx.stroke();
    }

    // Horizontal lines
    for (let y = 0; y <= gridHeight; y++) {
      const py = y * cellSize;
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(totalW, py);
      ctx.stroke();
    }
  }

  /**
   * Draw the food item at grid position.
   * @param {number} gx - Grid x
   * @param {number} gy - Grid y
   */
  _drawFood(gx, gy) {
    const { ctx, cellSize } = this;
    const cx = gx * cellSize + cellSize / 2;
    const cy = gy * cellSize + cellSize / 2;
    const radius = cellSize / 2 - 2;

    // Glow effect
    ctx.fillStyle = this.colors.foodGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 3, 0, Math.PI * 2);
    ctx.fill();

    // Food dot
    ctx.fillStyle = this.colors.food;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Draw the snake: head distinct from body.
   * @param {Array<{x: number, y: number}>} segments
   */
  _drawSnake(segments) {
    const { ctx, cellSize } = this;
    const len = segments.length;

    for (let i = len - 1; i >= 0; i--) {
      const seg = segments[i];
      if (!seg || typeof seg.x !== 'number' || typeof seg.y !== 'number') {
        continue;
      }

      const padding = 1; // small gap between cells for segment definition
      const x = seg.x * cellSize + padding;
      const y = seg.y * cellSize + padding;
      const size = cellSize - padding * 2;

      if (i === 0) {
        // Head
        ctx.fillStyle = this.colors.snakeHead;
        ctx.shadowColor = this.colors.snakeHead;
        ctx.shadowBlur = 6;
      } else {
        // Body
        ctx.fillStyle = this.colors.snakeBody;
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      }

      // Rounded rectangle segment
      const radius = cellSize * 0.2;
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + size - radius, y);
      ctx.quadraticCurveTo(x + size, y, x + size, y + radius);
      ctx.lineTo(x + size, y + size - radius);
      ctx.quadraticCurveTo(x + size, y + size, x + size - radius, y + size);
      ctx.lineTo(x + radius, y + size);
      ctx.quadraticCurveTo(x, y + size, x, y + size - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
      ctx.fill();
    }

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }

  /**
   * Draw a semi-transparent game-over overlay with text.
   */
  _drawGameOver() {
    const { ctx, canvas } = this;

    // Overlay
    ctx.fillStyle = this.colors.gameOverOverlay;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Text
    ctx.fillStyle = this.colors.gameOverText;
    ctx.font = `bold ${Math.floor(canvas.height / 8)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2);
  }
}

/**
 * Create a Renderer instance.
 *
 * Matches API contract:
 *   POST /renderer/Renderer
 *   Body: { canvas: HTMLCanvasElement, cellSize: number (default 20) }
 *   Returns: Renderer instance
 *
 * @param {{ canvas: HTMLCanvasElement, cellSize?: number }} params
 * @returns {Renderer}
 */
function create(params) {
  if (!params || typeof params !== 'object') {
    throw new TypeError('params object is required');
  }
  if (!(params.canvas instanceof HTMLCanvasElement)) {
    throw new TypeError('params.canvas must be an HTMLCanvasElement');
  }

  const cellSize = params.cellSize !== undefined ? params.cellSize : 20;
  return new Renderer(params.canvas, cellSize);
}

// Module exports
export { Renderer, create };
