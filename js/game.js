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
        this.setup();
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
    }

    // Update the UI to represent the current game state
    actuate(grid, metadata) {
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
            if (metadata.won) this.message(true); // You win!
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
        // These constants should ideally be sourced from CSS or configuration
        // if they were to change. For this project, they match the CSS.
        const PADDING_PX = 15; // Corresponds to padding in .grid-tiles and .grid-background
        const GAP_PX = 15;     // Corresponds to gap in .grid-background
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
        
        // The width and height of the tile are set by CSS: calc((100% - 75px) / 4).
        // This CSS calculation should already correctly size the tile to match cellWidth.
        // 100% in that CSS refers to containerPaddingBoxWidth.
        // So, tile_css_width = (containerPaddingBoxWidth - 75px) / 4.
        // Our calculated cellWidth = (containerPaddingBoxWidth - 2*15px - 3*15px) / 4 
        //                        = (containerPaddingBoxWidth - 30px - 45px) / 4 
        //                        = (containerPaddingBoxWidth - 75px) / 4.
        // They match, so no need to set width/height from JS here.
    }

    // Update the score display
    updateScore(score) {
        this.score = score;
        document.getElementById('current-score').textContent = this.score;
    }

    // Display a game message
    message(won) {
        const type = won ? 'game-won' : 'game-over';
        const messageText = won ? 'You win!' : 'Game over!';

        // this.messageContainer.classList.add(type);
        this.messageContainer.classList.add('active', type); // Use 'active' to control visibility
        this.messageContainer.querySelector('p').textContent = messageText;
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

        // Respond to swipe events
        let touchStartClientX, touchStartClientY;
        const gameContainer = document.querySelector('.game-container');

        gameContainer.addEventListener('touchstart', event => {
            if (event.touches.length > 1) return;
            touchStartClientX = event.touches[0].clientX;
            touchStartClientY = event.touches[0].clientY;
            event.preventDefault();
        });

        gameContainer.addEventListener('touchmove', event => {
            event.preventDefault();
        });

        gameContainer.addEventListener('touchend', event => {
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
        this.solver = new Solver(this.game); // Initialize AI Solver

        this.isAutoPlaying = false;
        this.autoPlayIntervalId = null;
        this.autoPlayDelay = 500; // Milliseconds between AI moves

        this.inputManager.on('move', this.move.bind(this));
        this.inputManager.on('restart', this.restart.bind(this));
        this.inputManager.on('keepPlaying', this.keepPlaying.bind(this));
        this.inputManager.on('theme-toggle', this.toggleTheme.bind(this));

        // Auto Play Button
        const autoPlayButton = document.getElementById('auto-play-btn');
        autoPlayButton.addEventListener('click', this.toggleAutoPlay.bind(this));
    }

    move(direction) {
        if (this.isAutoPlaying) return; // Disable manual moves during auto play
        this.game.move(direction);
    }

    restart() {
        if (this.isAutoPlaying) {
            this.stopAutoPlay(); // Stop AI if game is restarted
        }
        this.game.restart();
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
            autoPlayButton.classList.add('active'); // Optional: for styling active button
            this.startAutoPlay();
        } else {
            autoPlayButton.textContent = 'Auto Play';
            autoPlayButton.classList.remove('active');
            this.stopAutoPlay();
        }
    }

    startAutoPlay() {
        if (this.game.over || (this.game.won && !this.game.keepPlaying)) {
            this.isAutoPlaying = false; // Can't start if game is already over
            document.getElementById('auto-play-btn').textContent = 'Auto Play';
            document.getElementById('auto-play-btn').classList.remove('active');
            return;
        }
        this.autoPlayIntervalId = setInterval(() => {
            this.autoPlayStep();
        }, this.autoPlayDelay);
    }

    stopAutoPlay() {
        clearInterval(this.autoPlayIntervalId);
        this.autoPlayIntervalId = null;
        if (this.isAutoPlaying) { // Ensure toggleAutoPlay is called if stopped programmatically
            this.isAutoPlaying = false;
            const autoPlayButton = document.getElementById('auto-play-btn');
            autoPlayButton.textContent = 'Auto Play';
            autoPlayButton.classList.remove('active');
        }
    }

    autoPlayStep() {
        if (this.game.over || (this.game.won && !this.game.keepPlaying)) {
            this.stopAutoPlay();
            return;
        }

        const bestMove = this.solver.findBestMove(3, 450); // Max depth 3, 450ms time limit
        if (bestMove !== -1) { 
            this.game.move(bestMove);
        } else {
            // No valid moves found by AI, or game might be stuck in a loop for the AI
            // This might happen if all moves lead to an immediate game over, or AI can't improve score.
            // For a simple AI, it might just stop.
            console.log("AI couldn't find a move or game is effectively over for AI.");
            this.stopAutoPlay(); 
        }

        // Check again if game ended after AI move
        if (this.game.over || (this.game.won && !this.game.keepPlaying)) {
            this.stopAutoPlay();
        }
    }

    toggleTheme() {
        document.body.classList.toggle('dark-theme');
        localStorage.setItem('theme', document.body.classList.contains('dark-theme') ? 'dark' : 'light');
    }
}

// AI Solver Class (Simple Heuristic)
class Solver {
    constructor(gameInstance) {
        this.game = gameInstance; // Reference to the main game instance
    }

    // searchDepth: How many of AI's own moves to look ahead.
    // e.g., depth 1: AI moves -> Chance tile -> Evaluate
    // e.g., depth 2: AI moves -> Chance tile -> AI moves -> Chance tile -> Evaluate
    // A searchDepth of N means N AI moves are optimized.
    findBestMove(maxAllowedDepth = 3, timeLimitMs = 450) {
        let overallBestMove = -1;
        let overallBestScore = -Infinity; // Keep track of the score for the best move found so far
        const startTime = Date.now();

        for (let currentSearchDepth = 1; currentSearchDepth <= maxAllowedDepth; currentSearchDepth++) {
            let bestMoveForThisDepth = -1;
            let bestScoreForThisDepth = -Infinity;
            // console.log(`Starting search at depth: ${currentSearchDepth}`);

            for (let direction = 0; direction < 4; direction++) {
                const tempGame = this._copyGame(this.game);
                const moved = this._simulateMoveOnTempGame(tempGame, direction);

                if (moved) {
                    // currentSearchDepth is the total number of AI moves we want to make in this iteration.
                    // One move (direction) is already made. So, (currentSearchDepth - 1) more AI moves to search.
                    const scoreForThisDirection = this._expectiSearch(tempGame.grid, tempGame.score, currentSearchDepth - 1);
                    if (scoreForThisDirection > bestScoreForThisDepth) {
                        bestScoreForThisDepth = scoreForThisDirection;
                        bestMoveForThisDepth = direction;
                    }
                }
            }

            if (bestMoveForThisDepth !== -1) {
                overallBestMove = bestMoveForThisDepth;
                overallBestScore = bestScoreForThisDepth; // Update the best score found
                // console.log(`Depth ${currentSearchDepth}: Best move ${overallBestMove} with score ${overallBestScore}`);
            }
            
            // Check time limit after completing a full depth search
            if (Date.now() - startTime > timeLimitMs) {
                // console.log(`Time limit (${timeLimitMs}ms) reached at depth ${currentSearchDepth}. Using move from this depth.`);
                break;
            }
        }
        
        // Fallback if no valid move was found by iterative deepening (e.g., all initial moves are bad or time ran out before depth 1 finished)
        if (overallBestMove === -1 && this.game.movesAvailable()) {
            // console.log("Iterative deepening found no best move or timed out early. Using fallback.");
            for (let direction = 0; direction < 4; direction++) {
                const tempGameCheck = this._copyGame(this.game);
                if (this._simulateMoveOnTempGame(tempGameCheck, direction)) {
                    // console.log("Fallback: taking first available valid move:", direction);
                    return direction; 
                }
            }
        }
        // console.log(`Final AI Decision: Move ${overallBestMove}, Score: ${overallBestScore}, Time: ${Date.now() - startTime}ms`);
        return overallBestMove;
    }

    // Simulates AI's turn: maximize score
    _aiTurnSearch(grid, score, depth) {
        const terminalState = this._isTerminal(grid);
        // If depth is 0, it means we've completed the desired number of AI moves. Evaluate.
        // Or if game is over.
        if (depth < 0 || terminalState.over) { // depth < 0 should not happen with correct calls, but as safeguard
             return this.evaluateBoard(grid, score);
        }
        if (depth === 0) {
             return this.evaluateBoard(grid, score);
        }


        let maxScore = -Infinity;
        let moveMade = false;

        for (let direction = 0; direction < 4; direction++) {
            const tempGame = { grid: this._cloneGrid(grid), score: score, over: false, won: false };
            const moved = this._simulateMoveOnTempGame(tempGame, direction);

            if (moved) {
                moveMade = true;
                // After AI's move, it's chance node's turn.
                // The next call to expectiSearch will lead to an AI search of (depth - 1).
                maxScore = Math.max(maxScore, this._expectiSearch(tempGame.grid, tempGame.score, depth -1));
            }
        }
        // If no move was possible from this state (e.g. a "stuck" intermediate state),
        // evaluate the current board.
        return moveMade ? maxScore : this.evaluateBoard(grid, score);
    }

    // Simulates Chance node's turn: calculate expected score
    // Depth here refers to the remaining AI plies to search *after* this chance node.
    _expectiSearch(grid, score, depth) {
        const terminalState = this._isTerminal(grid);
        if (terminalState.over || depth < 0) { // depth < 0 means we've gone past search limit
            return this.evaluateBoard(grid, score);
        }

        const availableCells = grid.availableCells();
        if (availableCells.length === 0 && !terminalState.over) {
            // This state should ideally be caught by terminalState.over if no cells are available
            // and no moves can be made. If cells are 0 but moves exist (impossible), it's an issue.
            // For robustness, evaluate.
            return this.evaluateBoard(grid, score);
        }
        if (availableCells.length === 0 && terminalState.over) {
             return this.evaluateBoard(grid, score);
        }


        let totalExpectedScore = 0;
        
        availableCells.forEach(cellPos => {
            // Scenario 1: A '2' tile appears
            const gridWith2 = this._cloneGrid(grid);
            gridWith2.insertTile(new Tile(cellPos, 2));
            // After chance tile, AI makes its next move (depth is already reduced for this level of AI search)
            totalExpectedScore += 0.9 * this._aiTurnSearch(gridWith2, score, depth);

            // Scenario 2: A '4' tile appears
            const gridWith4 = this._cloneGrid(grid);
            gridWith4.insertTile(new Tile(cellPos, 4));
            totalExpectedScore += 0.1 * this._aiTurnSearch(gridWith4, score, depth);
        });
        
        return availableCells.length > 0 ? totalExpectedScore / availableCells.length : this.evaluateBoard(grid, score);
    }


    _copyGame(gameInstance) {
        const newGrid = this._cloneGrid(gameInstance.grid);
        return {
            grid: newGrid,
            score: gameInstance.score,
            over: gameInstance.over, // Current 'over' state might not be relevant for simulation start
            won: gameInstance.won   // Same for 'won'
        };
    }

    _cloneGrid(gridInstance) {
        const newGrid = new Grid(gridInstance.size);
        gridInstance.eachCell((x, y, tile) => {
            if (tile) {
                newGrid.insertTile(new Tile({ x: x, y: y }, tile.value));
            }
        });
        return newGrid;
    }

    _simulateMoveOnTempGame(tempGame, direction) {
        const grid = tempGame.grid;
        let score = tempGame.score; // Use let as score can change
        const vector = this.game.getVector(direction);
        const traversals = this.game.buildTraversals(vector);
        let moved = false;

        grid.eachCell((x, y, tile) => {
            if (tile) tile.mergedFrom = null;
        });

        traversals.x.forEach(x => {
            traversals.y.forEach(y => {
                const cell = { x, y };
                let tile = grid.cellContent(cell); // Use let, as tile object in cell might change due to merge

                if (tile) {
                    const positions = this.game.findFarthestPosition.call({ grid: grid }, cell, vector);
                    const nextCellDesc = grid.cellContent(positions.next);

                    if (nextCellDesc && nextCellDesc.value === tile.value && !nextCellDesc.mergedFrom) {
                        const merged = new Tile(positions.next, tile.value * 2);
                        merged.mergedFrom = [tile, nextCellDesc];

                        grid.insertTile(merged);
                        grid.removeTile(tile); // Remove the original tile that moved
                        grid.removeTile(nextCellDesc); // Remove the tile it merged with

                        score += merged.value;
                        moved = true;
                    } else {
                        const originalCellX = tile.x;
                        const originalCellY = tile.y;
                        const targetCellX = positions.farthest.x;
                        const targetCellY = positions.farthest.y;

                        if (originalCellX !== targetCellX || originalCellY !== targetCellY) {
                            grid.cells[originalCellX][originalCellY] = null;
                            tile.updatePosition(positions.farthest);
                            grid.cells[targetCellX][targetCellY] = tile;
                            moved = true;
                        }
                    }
                }
            });
        });

        tempGame.score = score;
        // Check for game over state on this tempGame AFTER the move
        if (!this._movesAvailable(grid)) {
            tempGame.over = true;
        }
        // Check for win, though AI typically plays past it
        grid.eachCell((x,y,tile) => { if(tile && tile.value === 2048) tempGame.won = true;});

        return moved;
    }

    _movesAvailable(grid) {
        if (grid.availableCells().length > 0) return true;

        for (let x = 0; x < grid.size; x++) {
            for (let y = 0; y < grid.size; y++) {
                const tile = grid.cellContent({ x, y });
                if (tile) {
                    for (let direction = 0; direction < 4; direction++) {
                        const vector = this.game.getVector(direction);
                        const cell = { x: x + vector.x, y: y + vector.y };
                        const other = grid.cellContent(cell);
                        if (other && other.value === tile.value) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    _isTerminal(grid) {
        return { over: !this._movesAvailable(grid) };
    }

    // evaluateBoard should be self-contained or use this.game for static properties only
    evaluateBoard(grid, currentScore) {
        let evalScore = 0;

        // 1. Raw Score contribution (less emphasized now, heuristics are more important)
        evalScore += currentScore * 0.1; 

        // 2. Empty Cells Bonus (Crucial)
        const emptyCells = grid.availableCells().length;
        evalScore += emptyCells * 275; // Increased weight slightly

        // 3. Smoothness Bonus (Penalize differences between adjacent tiles)
        let smoothness = 0;
        grid.eachCell((x, y, tile) => {
            if (tile) {
                // Check right neighbor
                if (x + 1 < grid.size) {
                    const rightNeighbor = grid.cellContent({ x: x + 1, y: y });
                    if (rightNeighbor) {
                        smoothness -= Math.abs(Math.log2(tile.value) - Math.log2(rightNeighbor.value));
                    } else {
                        smoothness += 1; // Bonus for empty cell next to a tile (potential for movement)
                    }
                }
                // Check down neighbor
                if (y + 1 < grid.size) {
                    const downNeighbor = grid.cellContent({ x: x, y: y + 1 });
                    if (downNeighbor) {
                        smoothness -= Math.abs(Math.log2(tile.value) - Math.log2(downNeighbor.value));
                    } else {
                        smoothness += 1; // Bonus for empty cell next to a tile
                    }
                }
            }
        });
        evalScore += smoothness * 10;

        // 4. Monotonicity Bonus (Encourage sorted rows/columns)
        let monotonicity = 0;
        const directions = [ {x:1, y:0}, {x:0, y:1} ]; // Horizontal and Vertical

        for(let d_idx = 0; d_idx < directions.length; d_idx++){
            const dirVector = directions[d_idx];
            for (let i = 0; i < grid.size; i++) {
                let currentLineValues = [];
                for (let j = 0; j < grid.size; j++) {
                    let cellContent;
                    if(dirVector.x === 1) { // Traversing a row
                        cellContent = grid.cellContent({x: j, y: i});
                    } else { // Traversing a column
                        cellContent = grid.cellContent({x: i, y: j});
                    }
                    if(cellContent) currentLineValues.push(cellContent.value);
                    else currentLineValues.push(0); // Represent empty cells as 0 for monotonicity check
                }

                let increaseScore = 0;
                let decreaseScore = 0;
                for (let k = 0; k < currentLineValues.length - 1; k++) {
                    if (currentLineValues[k] > 0 && currentLineValues[k+1] > 0) { // Only consider adjacent tiles
                        if (currentLineValues[k] > currentLineValues[k+1]) {
                            decreaseScore += Math.log2(currentLineValues[k]) - Math.log2(currentLineValues[k+1]);
                        }
                        if (currentLineValues[k] < currentLineValues[k+1]) {
                           increaseScore += Math.log2(currentLineValues[k+1]) - Math.log2(currentLineValues[k]);
                        }
                    }
                }
                monotonicity += Math.max(increaseScore, decreaseScore);
            }
        }
        evalScore += monotonicity * 45; // Adjusted weight
        
        // 5. Max Value in Corner Bonus (e.g., bottom-right)
        let maxValue = 0;
        grid.eachCell((x,y,tile) => { if(tile) maxValue = Math.max(maxValue, tile.value); });
        
        const cornerX = grid.size -1;
        const cornerY = grid.size -1;
        const cornerTile = grid.cellContent({x: cornerX, y: cornerY});

        if (cornerTile && cornerTile.value === maxValue) {
            evalScore += maxValue * 2.5; // Strong bonus if max tile is in desired corner
        }
        // Penalize if max tile is not on an edge
        else {
            let maxTileOnEdge = false;
            for(let i=0; i<grid.size; i++){
                if( (grid.cellContent({x:i, y:0})?.value === maxValue) ||
                    (grid.cellContent({x:i, y:grid.size-1})?.value === maxValue) ||
                    (grid.cellContent({x:0, y:i})?.value === maxValue) ||
                    (grid.cellContent({x:grid.size-1, y:i})?.value === maxValue) ){
                        maxTileOnEdge = true;
                        break;
                    }
            }
            if(maxValue > 128 && !maxTileOnEdge){ // Only penalize for larger tiles not on edge
                evalScore -= maxValue * 2.0;
            }
        }

        // 6. Penalty for too many distinct tile values / Lack of mergeable pairs
        let distinctValues = new Set();
        let mergePotential = 0;
        grid.eachCell((x,y,tile) => {
            if(tile){
                distinctValues.add(tile.value);
                // Check for horizontal merge potential
                if(x + 1 < grid.size && grid.cellContent({x:x+1, y:y})?.value === tile.value) mergePotential += tile.value;
                // Check for vertical merge potential
                if(y + 1 < grid.size && grid.cellContent({x:x, y:y+1})?.value === tile.value) mergePotential += tile.value;
            }
        });
        evalScore += mergePotential * 1.5; // Bonus for immediate merge opportunities
        if(distinctValues.size > (grid.size * grid.size) / 2 && emptyCells < 4) { // If many distinct values and few empty cells
            evalScore -= distinctValues.size * 20;
        }

        return evalScore;
    }
}

// Start the game when the page loads
window.addEventListener('DOMContentLoaded', () => {
    // Apply saved theme if any
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
    }

    // Start the game
    new GameManager();
}); 