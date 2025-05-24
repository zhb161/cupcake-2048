// Game class
class Game {
    constructor(actuator) {
        this.gridSize = 4;
        this.startingTiles = 2;
        this.grid = new Grid(this.gridSize);
        this.score = 0;
        this.bestScore = this.getBestScore();
        this.gamesPlayed = this.getGamesPlayed();
        this.bestDate = this.getBestDate() || '-';
        this.over = false;
        this.won = false;
        this.keepPlaying = false;
        this.actuator = actuator;
        this.moveCount = 0; // 添加移动次数统计
        this.gameStartTime = Date.now(); // 添加游戏开始时间
        this.setup();
    }

    // Setup a new game
    setup() {
        this.updateScoreDisplay();
        this.updateBestDisplay();
        this.grid.clearGrid();

        // Add the starting tiles
        this.addStartingTiles();

        // Update the actuator
        this.actuate();
    }

    // Set up the initial tiles
    addStartingTiles() {
        for (let i = 0; i < this.startingTiles; i++) {
            this.addRandomTile();
        }
    }

    // Adds a tile in a random position
    addRandomTile() {
        if (this.grid.cellsAvailable()) {
            const value = Math.random() < 0.9 ? 2 : 4;
            const tile = new Tile(this.grid.randomAvailableCell(), value);

            this.grid.insertTile(tile);
        }
    }

    // Update the score display
    updateScoreDisplay() {
        document.getElementById('current-score').textContent = this.score;
        document.getElementById('all-time-best').textContent = this.bestScore;
        document.getElementById('best-date').textContent = this.bestDate;
        document.getElementById('games-played').textContent = this.gamesPlayed;
    }

    // Update the best score display
    updateBestDisplay() {
        document.getElementById('best-score').textContent = this.bestScore;
    }

    // Get the best score from local storage
    getBestScore() {
        return parseInt(localStorage.getItem('bestScore')) || 0;
    }

    // Get the best date from local storage
    getBestDate() {
        return localStorage.getItem('bestDate') || '-';
    }

    // Get games played from local storage
    getGamesPlayed() {
        return parseInt(localStorage.getItem('gamesPlayed')) || 0;
    }

    // Save the best score to local storage
    setBestScore(score) {
        localStorage.setItem('bestScore', score);
        localStorage.setItem('bestDate', new Date().toLocaleDateString());
        this.bestScore = score;
        this.bestDate = new Date().toLocaleDateString();
    }

    // Increment games played
    incrementGamesPlayed() {
        const gamesPlayed = this.getGamesPlayed() + 1;
        localStorage.setItem('gamesPlayed', gamesPlayed);
        this.gamesPlayed = gamesPlayed;
    }

    // Actuate the game state
    actuate() {
        if (this.score > this.bestScore) {
            this.setBestScore(this.score);
            this.updateBestDisplay();
        }

        this.updateScoreDisplay();

        // Clear the message container before actuating, 
        // especially if game is ongoing (not over and not won or won but keepPlaying)
        if (!this.over && (!this.won || this.keepPlaying)) {
            this.actuator.clearMessage();
        }

        this.actuator.actuate(this.grid, {
            score: this.score,
            over: this.over,
            won: this.won,
            keepPlaying: this.keepPlaying
        });
    }

    // Move tiles in a direction
    move(direction) {
        // Don't do anything if the game is over
        if (this.over || this.won && !this.keepPlaying) return;

        const vector = this.getVector(direction);
        const traversals = this.buildTraversals(vector);
        let moved = false;

        // Save the current tile positions and remove merged flags
        this.prepareTiles();

        // Traverse the grid in the right direction and move tiles
        traversals.x.forEach(x => {
            traversals.y.forEach(y => {
                const cell = { x, y };
                const tile = this.grid.cellContent(cell);

                if (tile) {
                    const positions = this.findFarthestPosition(cell, vector);
                    const next = this.grid.cellContent(positions.next);

                    // Only one merger per row traversal
                    if (next && next.value === tile.value && !next.mergedFrom) {
                        const merged = new Tile(positions.next, tile.value * 2);
                        merged.mergedFrom = [tile, next];

                        this.grid.insertTile(merged);
                        this.grid.removeTile(tile);

                        // Converge the two tiles' positions
                        tile.updatePosition(positions.next);

                        // Update the score
                        this.score += merged.value;

                        // Check if we've won
                        if (merged.value === 2048) this.won = true;
                    } else {
                        this.moveTile(tile, positions.farthest);
                    }

                    if (!this.positionsEqual(cell, tile)) {
                        moved = true;
                    }
                }
            });
        });

        if (moved) {
            this.addRandomTile();
            this.moveCount++; // 增加移动次数

            if (!this.movesAvailable()) {
                this.over = true; // Game over!
                this.incrementGamesPlayed();
            }

            this.actuate();
        }
    }

    // Get the vector representing the chosen direction
    getVector(direction) {
        const map = {
            0: { x: 0, y: -1 }, // Up
            1: { x: 1, y: 0 },  // Right
            2: { x: 0, y: 1 },  // Down
            3: { x: -1, y: 0 }  // Left
        };

        return map[direction];
    }

    // Build a list of positions to traverse in the right order
    buildTraversals(vector) {
        const traversals = { x: [], y: [] };

        for (let pos = 0; pos < this.gridSize; pos++) {
            traversals.x.push(pos);
            traversals.y.push(pos);
        }

        // Always traverse from the farthest cell in the chosen direction
        if (vector.x === 1) traversals.x = traversals.x.reverse();
        if (vector.y === 1) traversals.y = traversals.y.reverse();

        return traversals;
    }

    // Prepare the tiles for movement
    prepareTiles() {
        this.grid.eachCell((x, y, tile) => {
            if (tile) {
                tile.mergedFrom = null;
                tile.savePosition();
            }
        });
    }

    // Move a tile and its representation
    moveTile(tile, cell) {
        this.grid.cells[tile.x][tile.y] = null;
        this.grid.cells[cell.x][cell.y] = tile;
        tile.updatePosition(cell);
    }

    // Find the farthest position in a direction
    findFarthestPosition(cell, vector) {
        let previous;
        let next = { x: cell.x, y: cell.y };

        // Progress towards the vector direction until an obstacle is found
        do {
            previous = next;
            next = { x: previous.x + vector.x, y: previous.y + vector.y };
        } while (this.grid.withinBounds(next) && this.grid.cellAvailable(next));

        return {
            farthest: previous,
            next: next // Used to check if a merge is required
        };
    }

    // Check if positions are equal
    positionsEqual(first, second) {
        return first.x === second.x && first.y === second.y;
    }

    // Check if there are any moves available
    movesAvailable() {
        return this.grid.cellsAvailable() || this.tileMatchesAvailable();
    }

    // Check for available matches between tiles
    tileMatchesAvailable() {
        for (let x = 0; x < this.gridSize; x++) {
            for (let y = 0; y < this.gridSize; y++) {
                const tile = this.grid.cellContent({ x, y });

                if (tile) {
                    for (let direction = 0; direction < 4; direction++) {
                        const vector = this.getVector(direction);
                        const cell = { x: x + vector.x, y: y + vector.y };
                        const other = this.grid.cellContent(cell);

                        if (other && other.value === tile.value) {
                            return true;
                        }
                    }
                }
            }
        }

        return false;
    }

    // Restart the game
    restart() {
        this.actuator.clearMessage(); // Clear message before setup
        this.incrementGamesPlayed();
        this.score = 0;
        this.over = false;
        this.won = false;
        this.keepPlaying = false;
        this.moveCount = 0; // 重置移动次数
        this.gameStartTime = Date.now(); // 重置游戏开始时间
        this.setup();
    }

    // Add _tryMoveOnGrid to Game class for AI fallback, if not already present
    // This is a simplified simulation for checking if a move is possible
    // The actual SmartAI simulation is more complex. This is just for the fallback.
    _tryMoveOnGrid(grid, direction) {
        let moved = false;
        const vector = this.getVector(direction);
        const traversals = this.buildTraversals(vector);
        let breakOuter = false; // Flag to break from outer loops

        traversals.x.forEach(xPos => {
            if (breakOuter) return;
            traversals.y.forEach(yPos => {
                if (breakOuter) return;
                const cell = { x: xPos, y: yPos };
                const tile = grid.cellContent(cell);
                if (tile) {
                    // Use a context for findFarthestPosition that matches what Game.move uses
                    const contextForFindFarthest = { 
                            grid: grid, 
                            withinBounds: grid.withinBounds.bind(grid),
                            cellAvailable: grid.cellAvailable.bind(grid)
                        };
                    const positions = this.findFarthestPosition.call(contextForFindFarthest, cell, vector);
                    
                    // Check if tile can move to a new empty spot
                    if (positions.farthest.x !== cell.x || positions.farthest.y !== cell.y) {
                        moved = true;
                        breakOuter = true; // Set flag to break all loops
                        return;
                    }
                    // Check if a merge is possible (simplified)
                    const nextCell = grid.cellContent(positions.next);
                    if (nextCell && nextCell.value === tile.value) {
                        moved = true;
                        breakOuter = true; // Set flag to break all loops
                        return;
                    }
                }
            });
        });
        return { grid, moved }; 
    }
}

// Grid class
class Grid {
    constructor(size) {
        this.size = size;
        this.cells = this.empty();
    }

    // Build an empty grid
    empty() {
        const cells = [];

        for (let x = 0; x < this.size; x++) {
            const row = cells[x] = [];

            for (let y = 0; y < this.size; y++) {
                row.push(null);
            }
        }

        return cells;
    }

    // Clear the grid
    clearGrid() {
        this.cells = this.empty();
    }

    // Find the first available random position
    randomAvailableCell() {
        const cells = this.availableCells();

        if (cells.length) {
            return cells[Math.floor(Math.random() * cells.length)];
        }
    }

    // Return all available cells
    availableCells() {
        const cells = [];

        this.eachCell((x, y, tile) => {
            if (!tile) {
                cells.push({ x, y });
            }
        });

        return cells;
    }

    // Call callback for every cell
    eachCell(callback) {
        for (let x = 0; x < this.size; x++) {
            for (let y = 0; y < this.size; y++) {
                callback(x, y, this.cells[x][y]);
            }
        }
    }

    // Check if there are any cells available
    cellsAvailable() {
        return !!this.availableCells().length;
    }

    // Check if the specified cell is taken
    cellAvailable(cell) {
        return !this.cellContent(cell);
    }

    // Get the content of a cell
    cellContent(cell) {
        if (this.withinBounds(cell)) {
            return this.cells[cell.x][cell.y];
        } else {
            return null;
        }
    }

    // Insert a tile at its position
    insertTile(tile) {
        this.cells[tile.x][tile.y] = tile;
    }

    // Remove a tile
    removeTile(tile) {
        this.cells[tile.x][tile.y] = null;
    }

    // Check if a position is within bounds
    withinBounds(position) {
        return position.x >= 0 && position.x < this.size &&
               position.y >= 0 && position.y < this.size;
    }

    // Clone the grid
    clone() {
        const newGrid = new Grid(this.size);
        this.eachCell((x, y, tile) => {
            if (tile) {
                newGrid.insertTile(new Tile({ x: x, y: y }, tile.value));
            }
        });
        return newGrid;
    }
}

// Tile class
class Tile {
    constructor(position, value) {
        this.x = position.x;
        this.y = position.y;
        this.value = value;
        this.previousPosition = null;
        this.mergedFrom = null; // Tracks tiles that merged to create this tile
    }

    // Save the previous position
    savePosition() {
        this.previousPosition = { x: this.x, y: this.y };
    }

    // Update the position
    updatePosition(position) {
        this.x = position.x;
        this.y = position.y;
    }
}

// HTMLActuator class to handle the UI updates
class HTMLActuator {
    constructor() {
        this.tileContainer = document.querySelector('.grid-tiles');
        this.messageContainer = document.querySelector('.game-message');
        this.score = 0;
        this.grid = null; // 用于存储grid引用
        this.gameInstance = null; // 用于存储Game实例引用
        
        // 添加新按钮的事件监听器
        this.bindButtons();
    }

    // 绑定按钮事件
    bindButtons() {
        // 绑定结算界面的Try Again按钮
        document.addEventListener('click', (event) => {
            if (event.target.classList.contains('game-message-buttons') || 
                event.target.closest('.game-message-buttons')) {
                // 找到具体的按钮
                const button = event.target.tagName === 'BUTTON' ? 
                              event.target : 
                              event.target.closest('button');
                
                if (button && button.textContent.includes('Try Again')) {
                    // 触发重新开始游戏
                    const restartEvent = new CustomEvent('restart');
                    document.dispatchEvent(restartEvent);
                    
                    // 直接调用游戏管理器的重启方法
                    if (window.gameManager) {
                        window.gameManager.restart();
                    }
                    
                    // 清除消息界面
                    this.clearMessage();
                }
            }
        });
    }

    // 获取蛋糕名称 - 改为英文
    getCupcakeName(value) {
        const names = {
            2: 'Vanilla Cupcake',
            4: 'Strawberry Vanilla Cupcake',
            8: 'Lemon Cupcake',
            16: 'Red Velvet Cupcake',
            32: 'Mint Cupcake',
            64: 'Jumbo Oreo Cupcake',
            128: 'Birthday Cupcake',
            256: 'Royal Blue Cupcake',
            512: 'Caramel Cupcake',
            1024: 'Pink Champagne Cupcake',
            2048: 'Christmas Cupcake'
        };
        return names[value] || 'Cupcake';
    }

    // Update the UI to represent the current game state
    actuate(grid, metadata) {
        // 存储grid引用
        this.grid = grid;
        
        window.requestAnimationFrame(() => {
            this.clearContainer(this.tileContainer);

            grid.cells.forEach(column => {
                column.forEach(cell => {
                    if (cell) {
                        this.addTile(cell);
                    }
                });
            });

            this.updateScore(metadata.score);

            if (metadata.over) this.message(false); // You lose
            if (metadata.won && !metadata.keepPlaying) this.message(true); // You win!
        });
    }

    // Continue the game (after winning)
    continueGame() {
        this.clearMessage();
    }

    // Clear the tile container
    clearContainer(container) {
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }
    }

    // Add a tile to the UI
    addTile(tile) {
        const element = document.createElement('div');
        const targetPosition = { x: tile.x, y: tile.y };
        const value = tile.value;

        element.classList.add('tile', `tile-${value}`);

        let renderAtPrevious = false;
        if (tile.previousPosition && 
            (tile.previousPosition.x !== targetPosition.x || tile.previousPosition.y !== targetPosition.y)) {
            // This tile has moved from a different grid cell
            renderAtPrevious = true;
            this.applyPosition(element, tile.previousPosition); // Render at old spot first
        } else {
            // New tile, or a merged tile appearing at its spot, or a tile that didn't move.
            this.applyPosition(element, targetPosition);
        }

        // Add to DOM - Add to DOM early so CSS can apply initial state before transition for move
        this.tileContainer.appendChild(element);

        // If it was rendered at previous, now trigger the move to the target position
        if (renderAtPrevious) {
            window.requestAnimationFrame(() => {
                this.applyPosition(element, targetPosition); // Animate to new spot
            });
        }

        // Handle animations for new tiles and merged tiles (pop/appear)
        if (tile.mergedFrom) { // This is the *resulting* tile of a merge
            element.classList.add('tile-merged'); // Pop animation
        } else if (!tile.previousPosition && !tile.mergedFrom) { 
            // A brand new tile (not from merge, no previous logical grid position)
            element.classList.add('tile-new'); // Appear animation
        }
    }

    // Apply a position to a tile element
    applyPosition(element, position) {
        // 动态获取padding和gap值，根据屏幕尺寸
        const isMobile = window.innerWidth <= 600;
        const PADDING_PX = isMobile ? 10 : 15; // 手机端10px，桌面端15px
        const GAP_PX = isMobile ? 10 : 15;     // 手机端10px，桌面端15px
        const NUM_CELLS = 4;   // Grid size

        const tileContainer = this.tileContainer; // This is .grid-tiles element
        
        // Get the full width of the .grid-tiles container (padding-box width)
        const containerPaddingBoxWidth = tileContainer.offsetWidth;

        // Calculate the width of a single cell.
        // The available content width for cells within .grid-background (and thus for tiles)
        // is container's padding-box width minus its own padding (on two sides),
        // then minus the total gap space.
        // Note: .grid-tiles itself also has PADDING_PX on each side.
        const contentWidthForCells = containerPaddingBoxWidth - (2 * PADDING_PX);
        const cellWidth = (contentWidthForCells - (NUM_CELLS - 1) * GAP_PX) / NUM_CELLS;
        
        // Calculate top-left for the tile in pixels, relative to .grid-tiles's border.
        // Since .grid-tiles has PADDING_PX, the first tile (index 0) starts at PADDING_PX from the border.
        const tileLeft = PADDING_PX + position.x * (cellWidth + GAP_PX);
        const tileTop  = PADDING_PX + position.y * (cellWidth + GAP_PX);

        element.style.left = `${tileLeft}px`;
        element.style.top = `${tileTop}px`;
        
        // The width and height of the tile are set by CSS
        // For mobile: calc((100% - 50px) / 4) where 50px = 2*10px + 3*10px
        // For desktop: calc((100% - 75px) / 4) where 75px = 2*15px + 3*15px
        // This CSS calculation should already correctly size the tile to match cellWidth.
    }

    // Update the score display
    updateScore(score) {
        this.score = score;
        document.getElementById('current-score').textContent = this.score;
    }

    // Display a game message
    message(won) {
        const type = won ? 'game-won' : 'game-over';
        
        // 新的结算界面逻辑
        this.showResultScreen(won);
        
        this.messageContainer.classList.add('active', type);
    }

    // 新的结算界面显示方法
    showResultScreen(won) {
        // 获取游戏统计数据
        const gameStats = this.calculateGameStats();
        
        // 更新结算界面内容
        this.updateResultContent(won, gameStats);
    }

    // 计算游戏统计数据
    calculateGameStats() {
        // 找到最高瓦片
        let maxTileValue = 2;
        const grid = this.grid;
        
        if (grid && grid.cells) {
            grid.cells.forEach(column => {
                column.forEach(cell => {
                    if (cell && cell.value > maxTileValue) {
                        maxTileValue = cell.value;
                    }
                });
            });
        }

        // 计算移动次数（从Game实例获取真实数据）
        const moves = this.getMoveCount();
        
        // 计算游戏时间（从Game实例获取真实数据）
        const gameTime = this.getGameTime();
        
        // 计算效率指数
        const efficiency = this.calculateEfficiency(maxTileValue, moves);
        
        // 计算超越百分比
        const rankPercentage = this.calculateRankPercentage(maxTileValue);
        
        return {
            maxTile: maxTileValue,
            moves: moves,
            gameTime: gameTime,
            efficiency: efficiency,
            rankPercentage: rankPercentage,
            score: this.score
        };
    }

    // 获取移动次数（从Game实例获取真实数据）
    getMoveCount() {
        return this.gameInstance ? this.gameInstance.moveCount : 0;
    }

    // 获取游戏时间（从Game实例获取真实数据）
    getGameTime() {
        if (!this.gameInstance) return '0:00';
        
        const gameTimeMs = Date.now() - this.gameInstance.gameStartTime;
        const minutes = Math.floor(gameTimeMs / 60000);
        const seconds = Math.floor((gameTimeMs % 60000) / 1000);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    // 计算效率指数
    calculateEfficiency(maxTile, moves) {
        const efficiencyScore = (Math.log2(maxTile) * 100) / moves;
        
        if (efficiencyScore >= 0.8) return 'S';
        if (efficiencyScore >= 0.6) return 'A';
        if (efficiencyScore >= 0.4) return 'B';
        if (efficiencyScore >= 0.2) return 'C';
        return 'D';
    }

    // 计算超越百分比
    calculateRankPercentage(maxTile) {
        const percentageMap = {
            2: 15, 4: 25, 8: 35, 16: 45, 32: 55, 64: 65,
            128: 75, 256: 82, 512: 88, 1024: 93, 2048: 97, 4096: 99
        };
        return percentageMap[maxTile] || 15;
    }

    // 获取蛋糕图片名称
    getCupcakeImageName(value) {
        const imageNames = {
            2: 'vanilla-cupcake',
            4: 'strawberry-vanilla-cupcake',
            8: 'lemon-cupcake',
            16: 'red-velvet-cupcake',
            32: 'mint-cupcake',
            64: 'jumbo-oreo-cupcake',
            128: 'birthday-cupcake',
            256: 'royal-blue-cupcake',
            512: 'caramel-cupcake',
            1024: 'pink-champagne-cupcake',
            2048: 'christmas-cupcake'
        };
        return imageNames[value] || 'vanilla-cupcake';
    }

    // 更新结算界面内容
    updateResultContent(won, stats) {
        // 更新主图片
        const resultImg = document.getElementById('result-cupcake-img');
        resultImg.src = `img/${stats.maxTile}-${this.getCupcakeImageName(stats.maxTile)}.webp`;
        resultImg.alt = `${stats.maxTile} - ${this.getCupcakeName(stats.maxTile)}`;

        // 更新标题
        const resultTitle = document.getElementById('result-title');
        resultTitle.textContent = this.getResultTitle(won, stats.maxTile);

        // 更新主要统计信息 - 改为英文
        document.getElementById('result-score-text').textContent = 
            `You scored ${stats.score.toLocaleString()} points!`;
        
        document.getElementById('result-cupcake-text').textContent = 
            `Successfully baked ${stats.maxTile}-${this.getCupcakeName(stats.maxTile)}!`;
        
        document.getElementById('result-rank-text').textContent = 
            `Beat ${stats.rankPercentage}% of global bakers!`;

        // 更新详细统计
        document.getElementById('result-max-tile').textContent = stats.maxTile;
        document.getElementById('result-moves').textContent = stats.moves;
        document.getElementById('result-time').textContent = stats.gameTime;
        document.getElementById('result-efficiency').textContent = stats.efficiency;
    }

    // 获取结果标题
    getResultTitle(won, maxTile) {
        if (won) {
            if (maxTile >= 2048) return 'Master Baker! 🏆';
            if (maxTile >= 1024) return 'Excellent Work! ⭐';
            return 'Amazing Work! 🎉';
        } else {
            if (maxTile >= 512) return 'Almost There! 🌟';
            if (maxTile >= 128) return 'Keep Going! 💪';
            return 'Keep Baking! 🔥';
        }
    }

    // Clear the game message
    clearMessage() {
        // this.messageContainer.classList.remove('game-won', 'game-over');
        this.messageContainer.classList.remove('active', 'game-won', 'game-over');
    }
}

// KeyboardInputManager class to handle user input
class KeyboardInputManager {
    constructor() {
        this.events = {};
        this.listen();
    }

    // Add an event listener
    on(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
    }

    // Emit an event
    emit(event, data) {
        const callbacks = this.events[event];
        if (callbacks) {
            callbacks.forEach(callback => {
                callback(data);
            });
        }
    }

    // Listen for events
    listen() {
        // Respond to key presses
        document.addEventListener('keydown', event => {
            const mapped = this.mapKeys(event);

            if (mapped !== undefined) {
                event.preventDefault();
                this.emit('move', mapped);
            }

            // Restart the game on R key
            if (event.key === 'r' || event.key === 'R') {
                this.restart(event);
            }
        });

        // Respond to button presses
        document.getElementById('retry-button').addEventListener('click', this.restart.bind(this));
        document.getElementById('new-game-btn').addEventListener('click', this.restart.bind(this));

        // Respond to swipe events - Only in the grid area
        let touchStartClientX, touchStartClientY;
        const gridContainer = document.querySelector('.grid-container');

        gridContainer.addEventListener('touchstart', event => {
            if (event.touches.length > 1) return;
            
            touchStartClientX = event.touches[0].clientX;
            touchStartClientY = event.touches[0].clientY;
            event.preventDefault();
        });

        gridContainer.addEventListener('touchmove', event => {
            event.preventDefault();
        });

        gridContainer.addEventListener('touchend', event => {
            if (event.touches.length > 0) return;

            const touchEndClientX = event.changedTouches[0].clientX;
            const touchEndClientY = event.changedTouches[0].clientY;

            const dx = touchEndClientX - touchStartClientX;
            const dy = touchEndClientY - touchStartClientY;

            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);

            if (Math.max(absDx, absDy) > 10) {
                // (right : left) : (down : up)
                this.emit('move', absDx > absDy ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0));
            }
        });

        // Theme toggle
        document.getElementById('theme-toggle').addEventListener('click', () => {
            this.emit('theme-toggle');
        });
    }

    // Map keys to directions
    mapKeys(event) {
        const map = {
            'ArrowUp': 0,
            'ArrowRight': 1,
            'ArrowDown': 2,
            'ArrowLeft': 3,
            'w': 0,
            'd': 1,
            's': 2,
            'a': 3,
            'W': 0,
            'D': 1,
            'S': 2,
            'A': 3,
        };

        return map[event.key];
    }

    // Restart the game
    restart(event) {
        event.preventDefault();
        this.emit('restart');
    }
}

// Application class to tie everything together
class GameManager {
    constructor() {
        this.inputManager = new KeyboardInputManager();
        this.actuator = new HTMLActuator();
        this.game = new Game(this.actuator);
        this.actuator.gameInstance = this.game; // 传递Game实例引用给actuator
        this.solver = new SmartAI(this.game);

        this.isAutoPlaying = false;
        this.autoPlayIntervalId = null;

        this.SPEED_SLOW = 1000;
        this.SPEED_MEDIUM = 500;
        this.SPEED_FAST = 200;
        this.autoPlaySpeedSetting = this.SPEED_MEDIUM;
        this.autoPlayDelay = this.autoPlaySpeedSetting;

        // Cupcake Gallery Unlock State
        this.unlockedCupcakes = new Set([2, 4]); // Default unlocked
        this.localStorageKeyUnlocked = "cupcake2048_unlockedCupcakes";

        this.inputManager.on('move', this.onUserMove.bind(this));
        this.inputManager.on('restart', this.restart.bind(this));
        this.inputManager.on('keepPlaying', this.keepPlaying.bind(this));
        this.inputManager.on('theme-toggle', this.toggleTheme.bind(this));

        const autoPlayButton = document.getElementById('auto-play-btn');
        autoPlayButton.addEventListener('click', this.toggleAutoPlay.bind(this));

        document.getElementById('ai-speed-slow').addEventListener('click', () => this.setAISpeed(this.SPEED_SLOW));
        document.getElementById('ai-speed-medium').addEventListener('click', () => this.setAISpeed(this.SPEED_MEDIUM));
        document.getElementById('ai-speed-fast').addEventListener('click', () => this.setAISpeed(this.SPEED_FAST));
        
        this.loadAISpeedPreference();
        this.updateSpeedButtonUI();

        this.loadUnlockedCupcakes(); // Load gallery state
        this.scanGridAndUnlockRevealed(); // Initial scan
        this.updateCupcakeGalleryDisplay(); // Initial gallery display update
    }

    // Renamed from move to onUserMove to avoid clash with Game.move if Game instance needs to call a GM.move
    onUserMove(direction) { 
        if (this.isAutoPlaying && direction !== undefined) return;
        this.game.move(direction);
        this.scanGridAndUnlockRevealed(); // Scan after player move
    }

    restart() {
        if (this.isAutoPlaying) {
            this.stopAutoPlay();
        }
        this.game.restart();
        this.actuator.gameInstance = this.game; // 确保引用正确
        this.scanGridAndUnlockRevealed(); // Scan after restart
        // No need to update gallery display here, scanGridAndUnlockRevealed will if changes are made
    }

    keepPlaying() {
        this.game.keepPlaying = true;
        this.actuator.clearMessage();
    }

    toggleAutoPlay() {
        this.isAutoPlaying = !this.isAutoPlaying;
        const autoPlayButton = document.getElementById('auto-play-btn');
        if (this.isAutoPlaying) {
            autoPlayButton.textContent = 'Stop Auto';
            autoPlayButton.classList.add('active');
            this.startAutoPlay();
        } else {
            autoPlayButton.textContent = 'Auto Play';
            autoPlayButton.classList.remove('active');
            this.stopAutoPlay();
        }
    }

    startAutoPlay() {
        if (this.game.over || (this.game.won && !this.game.keepPlaying)) {
            this.isAutoPlaying = false; 
            const autoPlayButton = document.getElementById('auto-play-btn');
            autoPlayButton.textContent = 'Auto Play';
            autoPlayButton.classList.remove('active');
            return;
        }
        this.autoPlayIntervalId = setInterval(() => {
            this.autoPlayStep();
        }, this.autoPlayDelay);
    }

    stopAutoPlay() {
        clearInterval(this.autoPlayIntervalId);
        this.autoPlayIntervalId = null;
        const wasPlaying = this.isAutoPlaying;
        this.isAutoPlaying = false; 

        const autoPlayButton = document.getElementById('auto-play-btn');
        autoPlayButton.textContent = 'Auto Play';
        autoPlayButton.classList.remove('active');
    }

    autoPlayStep() {
        if (this.game.over || (this.game.won && !this.game.keepPlaying)) {
            this.stopAutoPlay();
            return;
        }

        if (!this.solver) {
            console.error("Solver not initialized!");
            this.stopAutoPlay();
            return;
        }

        const bestMove = this.solver.nextMove();
        
        if (bestMove !== undefined && bestMove !== -1 && bestMove !== null) {
            this.game.move(bestMove);
            this.scanGridAndUnlockRevealed(); // Scan after AI move
        } else {
            console.log("AI couldn't find a move. Attempting fallback.");
            let moved = false;
            if (this.solver && this.solver.game) { 
                 for (let i = 0; i < 4; i++) {
                    // Check if game has isMoveAvailable, if not, this needs to be adapted
                    // Assuming Game class has a method like isMovePossible(direction) or can simulate a move
                    // For now, we'll rely on the AI to make valid moves, or game.move to handle invalid ones gracefully
                    const tempGrid = this.game.grid.clone();
                    const sim = this.game._tryMoveOnGrid(tempGrid, i); // A hypothetical method in Game
                    if (sim.moved) { 
                         this.game.move(i);
                         this.scanGridAndUnlockRevealed(); // Scan after AI fallback move
                         moved = true;
                         break;
                    }
                 }
            }
            if (!moved) {
                console.log("Fallback failed. Stopping AI."); 
                this.stopAutoPlay(); 
            }
        }

        if (this.game.over || (this.game.won && !this.game.keepPlaying)) {
            this.stopAutoPlay();
        }
    }

    toggleTheme() {
        document.body.classList.toggle('dark-theme');
        localStorage.setItem('theme', document.body.classList.contains('dark-theme') ? 'dark' : 'light');
    }

    setAISpeed(speed) {
        this.autoPlaySpeedSetting = speed;
        this.autoPlayDelay = speed;
        localStorage.setItem('aiPlaySpeed', speed);
        this.updateSpeedButtonUI();

        if (this.isAutoPlaying) {
            clearInterval(this.autoPlayIntervalId);
            this.autoPlayIntervalId = setInterval(() => {
                this.autoPlayStep();
            }, this.autoPlayDelay);
        }
    }

    loadAISpeedPreference() {
        const savedSpeed = localStorage.getItem('aiPlaySpeed');
        if (savedSpeed) {
            this.autoPlaySpeedSetting = parseInt(savedSpeed, 10);
            this.autoPlayDelay = this.autoPlaySpeedSetting;
        }
    }

    updateSpeedButtonUI() {
        document.getElementById('ai-speed-slow').classList.remove('active');
        document.getElementById('ai-speed-medium').classList.remove('active');
        document.getElementById('ai-speed-fast').classList.remove('active');

        if (this.autoPlaySpeedSetting === this.SPEED_SLOW) {
            document.getElementById('ai-speed-slow').classList.add('active');
        } else if (this.autoPlaySpeedSetting === this.SPEED_MEDIUM) {
            document.getElementById('ai-speed-medium').classList.add('active');
        } else if (this.autoPlaySpeedSetting === this.SPEED_FAST) {
            document.getElementById('ai-speed-fast').classList.add('active');
        }
    }

    // --- Cupcake Gallery Unlock Logic ---
    loadUnlockedCupcakes() {
        const saved = localStorage.getItem(this.localStorageKeyUnlocked);
        if (saved) {
            try {
                const unlockedArray = JSON.parse(saved);
                if (Array.isArray(unlockedArray)) {
                    this.unlockedCupcakes = new Set(unlockedArray.map(Number)); // Ensure numbers
                    // Ensure 2 and 4 are always present after loading
                    this.unlockedCupcakes.add(2);
                    this.unlockedCupcakes.add(4);
                } else {
                    this.unlockedCupcakes = new Set([2, 4]); // Fallback if not an array
                }
            } catch (e) {
                console.error("Error loading unlocked cupcakes:", e);
                this.unlockedCupcakes = new Set([2, 4]); // Fallback on error
            }
        } else {
            // If nothing saved, defaults are already set (2, 4)
        }
    }

    saveUnlockedCupcakes() {
        localStorage.setItem(this.localStorageKeyUnlocked, JSON.stringify(Array.from(this.unlockedCupcakes)));
    }

    checkAndUnlockCupcake(value) {
        if (!this.unlockedCupcakes.has(value)) {
            this.unlockedCupcakes.add(value);
            this.saveUnlockedCupcakes();
            this.updateCupcakeGalleryDisplay(value); // Pass the newly unlocked value for animation
            return true; // Indicates a new cupcake was unlocked
        }
        return false; // Already unlocked
    }

    scanGridAndUnlockRevealed() {
        if (!this.game || !this.game.grid) return;
        let newUnlockHappened = false;
        this.game.grid.eachCell((x, y, tile) => {
            if (tile) {
                if (this.checkAndUnlockCupcake(tile.value)) {
                    newUnlockHappened = true;
                }
            }
        });
        // No need to call updateCupcakeGalleryDisplay if checkAndUnlockCupcake does it
        // However, if checkAndUnlockCupcake only updates one item, a full refresh might be desired by some logic
        // For now, checkAndUnlockCupcake handles its own update including animation trigger
    }

    updateCupcakeGalleryDisplay(newlyUnlockedValue = null) {
        const galleryItems = document.querySelectorAll('.cupcake-gallery .cupcake-item');
        galleryItems.forEach(item => {
            const value = parseInt(item.dataset.value, 10);
            item.classList.remove('newly-unlocked'); // Clear previous animation class

            if (this.unlockedCupcakes.has(value)) {
                item.classList.remove('locked');
                if (value === newlyUnlockedValue) {
                    // Apply animation for the newly unlocked item
                    item.classList.add('newly-unlocked');
                    // Consider removing the class after animation, or rely on animation-fill-mode
                    // For simplicity, we might remove it after a timeout if CSS doesn't handle it well
                    // setTimeout(() => item.classList.remove('newly-unlocked'), 800); // Match animation duration
                }
            } else {
                item.classList.add('locked');
            }
        });
    }
}

class SmartAI {
    constructor(gameInstance) {
        this.game = gameInstance; // gameInstance is the actual Game object
    }

    _simulateMoveOnGridClone(originalGrid, direction) {
        const newGrid = originalGrid.clone();
        const vector = this.game.getVector(direction); // Use from the Game object passed to constructor
        const traversals = this.game.buildTraversals(vector);
        let moved = false;

        newGrid.eachCell((x, y, tile) => {
            if (tile) tile.mergedFrom = null;
        });

        traversals.x.forEach(xPos => {
            traversals.y.forEach(yPos => {
                const cell = { x: xPos, y: yPos };
                let tile = newGrid.cellContent(cell);
                if (tile) {
                    // For findFarthestPosition, the context 'this' needs to be an object with a 'grid' property
                    // and any methods like getVector if findFarthestPosition itself calls them using 'this'
                    // The original Game.findFarthestPosition expects 'this.grid'.
                    const contextForFindFarthest = { 
                        grid: newGrid, 
                        // Provide other methods if findFarthestPosition or its callees from Game need them
                        withinBounds: newGrid.withinBounds.bind(newGrid), // Grid method
                        cellAvailable: newGrid.cellAvailable.bind(newGrid) // Grid method
                    };
                    const positions = this.game.findFarthestPosition.call(contextForFindFarthest, cell, vector);
                    const next = newGrid.cellContent(positions.next);

                    if (next && next.value === tile.value && !next.mergedFrom) {
                        const merged = new Tile(positions.next, tile.value * 2);
                        merged.mergedFrom = [tile, next];
                        newGrid.insertTile(merged);
                        newGrid.removeTile(tile);
                        moved = true;
                    } else {
                        // Simulate moving the tile on the newGrid
                        if (newGrid.cells[tile.x][tile.y] === tile) { // Ensure we are moving the correct tile instance
                           if (tile.x !== positions.farthest.x || tile.y !== positions.farthest.y) {
                                newGrid.cells[tile.x][tile.y] = null;
                                newGrid.cells[positions.farthest.x][positions.farthest.y] = tile;
                                tile.updatePosition(positions.farthest); // Update tile's own record of position
                            moved = true;
                            }
                        }
                    }
                }
            });
        });
        return { newGrid, moved };
    }

    gridQuality(grid) {
        var monoScore = 0;
        const traversals = this.game.buildTraversals({x: -1, y: 0});
        var prevValue;
        var incScore, decScore;

        var scoreCell = function(cell) {
            var tile = grid.cellContent(cell);
            var tileValue = (tile ? tile.value : 0);
            incScore += tileValue;
            if (tileValue <= prevValue || prevValue === -1) {
                decScore += tileValue;
                if (tileValue < prevValue) {
                    incScore -= prevValue;
                }
            }
            prevValue = tileValue;
        };
        
        traversals.x.forEach(function (xIndex) {
            prevValue = -1; incScore = 0; decScore = 0;
            traversals.y.forEach(function (yIndex) {
                scoreCell({ x: xIndex, y: yIndex });
            });
            monoScore += Math.max(incScore, decScore);
        });

        traversals.y.forEach(function (yIndex) { 
            prevValue = -1; incScore = 0; decScore = 0;
            traversals.x.forEach(function (xIndex) {
                scoreCell({ x: xIndex, y: yIndex });
            });
            monoScore += Math.max(incScore, decScore);
        });
        
        var availableCells = grid.availableCells();
        var emptyCellWeight = 8;
        var emptyScore = availableCells.length * emptyCellWeight;
        return monoScore + emptyScore;
    }

    chooseBestMove(results, originalQuality) {
        var bestResult = null;
        for (var i = 0; i < results.length; i++) {
            if (results[i] == null) continue;
            if (!bestResult ||
                results[i].qualityLoss < bestResult.qualityLoss ||
                (results[i].qualityLoss === bestResult.qualityLoss && results[i].quality > bestResult.quality) ||
                (results[i].qualityLoss === bestResult.qualityLoss && results[i].quality === bestResult.quality && (results[i].probability || 1) < (bestResult.probability || 1) )) {
                bestResult = results[i];
            }
        }
        if (!bestResult) {
             for(let dir = 0; dir < 4; dir++) {
                if (results[dir] !== null && results[dir].direction !== undefined) return results[dir]; // Ensure direction is valid
            }
            return { quality: -1, probability: 1, qualityLoss: originalQuality, direction: -1 }; // Fallback with -1 direction
        }
        return bestResult;
    }

    planAhead(grid, numMoves, originalQuality) {
        var results = new Array(4);
        for (var d = 0; d < 4; d++) {
            const sim = this._simulateMoveOnGridClone(grid, d);
            if (!sim.moved) {
                results[d] = null; continue;
            }
            var currentMovedGrid = sim.newGrid;
            var result = { quality: -1, probability: 1, qualityLoss: 0, direction: d };
            var availableCells = currentMovedGrid.availableCells();
            let consideredSpawnLocations = 0;

            if (availableCells.length === 0) {
                result.quality = this.gridQuality(currentMovedGrid);
                result.qualityLoss = Math.max(0, originalQuality - result.quality);
                result.probability = 1;
                    } else {
                for (var i = 0; i < availableCells.length; i++) {
                    var cellPos = availableCells[i];
                    var hasAdjacentTileCurrentCell = false;
                    for (var d2 = 0; d2 < 4; d2++) {
                        var vector = this.game.getVector(d2);
                        var adjCell = { x: cellPos.x + vector.x, y: cellPos.y + vector.y };
                        if (currentMovedGrid.cellContent(adjCell)) {
                            hasAdjacentTileCurrentCell = true; break;
                        }
                    }
                    
                    let anyCellIsAdjacentOverall = false;
                    if (availableCells.length > 1) {
                        for(const ac of availableCells) {
                            let currentACIsAdj = false;
                            for(let d3=0; d3<4; d3++) {
                                const vec = this.game.getVector(d3);
                                if(currentMovedGrid.cellContent({x: ac.x + vec.x, y: ac.y + vec.y})) {
                                    currentACIsAdj = true; break;
                                }
                            }
                            if(currentACIsAdj) { anyCellIsAdjacentOverall = true; break; }
                        }
                    }
                    if (anyCellIsAdjacentOverall && !hasAdjacentTileCurrentCell && availableCells.length > 1) continue;

                    consideredSpawnLocations++;
                    var testGrid2 = currentMovedGrid.clone();
                    var newTileForTest = new Tile(cellPos, 2); // Original AI only considers '2'
                    testGrid2.insertTile(newTileForTest);

                    var tileResult;
                    if (numMoves > 1) {
                        var subResults = this.planAhead(testGrid2, numMoves - 1, originalQuality);
                        tileResult = this.chooseBestMove(subResults, originalQuality);
                    } else {
                        var tileQualityVal = this.gridQuality(testGrid2);
                        tileResult = {
                            quality: tileQualityVal,
                            probability: 1,
                            qualityLoss: Math.max(0, originalQuality - tileQualityVal)
                        };
                    }
                    
                    if (tileResult && tileResult.quality !== undefined) { // Check tileResult and its quality
                        if (result.quality === -1 || tileResult.quality < result.quality) {
                            result.quality = tileResult.quality;
                            result.probability = (tileResult.probability || 1) / (consideredSpawnLocations || 1);
                        } else if (tileResult.quality === result.quality) {
                            result.probability += (tileResult.probability || 1) / (consideredSpawnLocations || 1);
                        }
                        result.qualityLoss += (tileResult.qualityLoss || 0) / (consideredSpawnLocations || 1);
                    } else if (consideredSpawnLocations === 1 && tileResult && tileResult.quality !== undefined) {
                        // If only one spawn location was considered and it yielded a result
                        result.quality = tileResult.quality;
                        result.probability = tileResult.probability || 1;
                        result.qualityLoss = tileResult.qualityLoss || 0;
                    }
                }
                if (consideredSpawnLocations === 0 && availableCells.length > 0) {
                    var firstCell = availableCells[0];
                    var testGridFallback = currentMovedGrid.clone();
                    var newTileFallback = new Tile(firstCell, 2);
                    testGridFallback.insertTile(newTileFallback);
                    var fbTileResult;
                    if (numMoves > 1) {
                        var fbSubResults = this.planAhead(testGridFallback, numMoves - 1, originalQuality);
                        fbTileResult = this.chooseBestMove(fbSubResults, originalQuality);
                    } else {
                         var fbTileQualityVal = this.gridQuality(testGridFallback);
                         fbTileResult = { quality: fbTileQualityVal, probability: 1, qualityLoss: Math.max(0, originalQuality - fbTileQualityVal) };
                    }
                     if (fbTileResult && fbTileResult.quality !== undefined) { 
                        result.quality = fbTileResult.quality;
                        result.probability = fbTileResult.probability || 1;
                        result.qualityLoss = fbTileResult.qualityLoss || 0;
                    }
                }
            }
            results[d] = result;
        }
        return results;
    }

    nextMove() {
        if (!this.game || !this.game.grid) {
            console.error("SmartAI: Game or grid not available!");
            return 0; 
        }
        var originalQuality = this.gridQuality(this.game.grid);
        var results = this.planAhead(this.game.grid, 3, originalQuality); 
        var bestResult = this.chooseBestMove(results, originalQuality);
        
        // Ensure a valid direction is returned, otherwise default (e.g. if bestResult.direction is -1)
        return (bestResult && bestResult.direction !== -1 && bestResult.direction !== undefined) ? bestResult.direction : 0;
    }
}

// Start the game when the page loads
window.addEventListener('DOMContentLoaded', () => {
    // Apply saved theme if any
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
    }

    // Start the game and make it globally accessible
    window.gameManager = new GameManager();
}); 