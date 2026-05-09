/**
 * AE Zombie Defender Clone - Core Game Logic
 */

const CONFIG = {
    gridSize: 50,
    cols: 16,
    rows: 10,
    startMoney: 50,
    startHealth: 20,
    sellRefundFactor: 0.5,
    pauseBetweenRounds: 4500,
    roundBonus: 28,
    baseSpeed: 0.035,             // px/ms at round 1 for a normal zombie
    speedPerRound: 0.0015,
    maxRoundSpeedBonus: 0.04,
    maxLevel: 3,                  // tower can be upgraded up to 3 times (4 levels total)
    upgradeCostFactors: [0.7, 1.0, 1.5]
};

const COLORS = {
    paperLight: '#e8d5a8',
    paperDark: '#c9a87a',
    grid: 'rgba(91, 47, 18, 0.07)',
    ink: '#2c1810'
};

const TOWER_STATS = {
    spike:      { range: 1.5, damage: 6,  fireRate: 1300, cost: 5,   ignoresFlying: true, label: 'Espinhos' },
    pistol:     { range: 2.5, damage: 9,  fireRate: 800,  cost: 10,  label: 'Pistola' },
    machinegun: { range: 3.0, damage: 11, fireRate: 380,  cost: 30,  label: 'Metralhadora' },
    poison:     { range: 2.5, damage: 4,  fireRate: 700,  cost: 40,  slowFactor: 0.55, slowMs: 1400, label: 'Veneno' },
    radar:      { range: 7.0, damage: 60, fireRate: 1500, cost: 100, label: 'Radar' },
    robot:      { range: 3.5, damage: 22, fireRate: 550,  cost: 120, label: 'Robô' },
    rocket:     { range: 4.0, damage: 30, fireRate: 1300, cost: 150, splashRadius: 1.3, label: 'Foguete' },
    tesla:      { range: 4.0, damage: 80, fireRate: 1100, cost: 200, chains: 3, chainRange: 2.5, chainFalloff: 0.65, label: 'Tesla' }
};

const ZOMBIE_STATS = {
    normal:   { hpMult: 1.0,  speedMult: 1.0, body: '#6b8e3a', head: '#94b54a', size: 1.0,  unlockRound: 1,  weight: 100, label: 'Normal' },
    tank:     { hpMult: 2.6,  speedMult: 0.7, body: '#3a5d20', head: '#5b8a35', size: 1.3,  unlockRound: 2,  weight: 22,  horns: true, label: 'Tanque' },
    fast:     { hpMult: 0.55, speedMult: 1.7, body: '#a3cf52', head: '#c5e578', size: 0.78, unlockRound: 3,  weight: 28,  label: 'Rápido' },
    flying:   { hpMult: 0.85, speedMult: 1.2, body: '#7fa850', head: '#a3cf52', size: 0.95, unlockRound: 4,  weight: 16,  flying: true, label: 'Voador' },
    skeleton: { hpMult: 0.75, speedMult: 1.05, body: '#d8d2c0', head: '#f0ebd8', size: 0.95, unlockRound: 5,  weight: 22,  skeletal: true, slowImmune: true, label: 'Esqueleto' },
    ghost:    { hpMult: 0.5,  speedMult: 1.0, body: '#e3e8e1', head: '#f6f8f3', size: 1.0,  unlockRound: 6,  weight: 18,  ghost: true, dodgeChance: 0.45, label: 'Fantasma' },
    poison:   { hpMult: 1.0,  speedMult: 0.95, body: '#7a4f8a', head: '#a578b3', size: 1.0,  unlockRound: 7,  weight: 16,  poisonous: true, label: 'Venenoso' },
    bomber:   { hpMult: 0.7,  speedMult: 0.9, body: '#a14431', head: '#c4654f', size: 1.0,  unlockRound: 8,  weight: 14,  bomb: true, label: 'Bombista' },
    ice:      { hpMult: 1.6,  speedMult: 0.85, body: '#5d8db0', head: '#85b3d4', size: 1.4, unlockRound: 9,  weight: 14,  frosty: true, slowImmune: true, freezesTowers: true, label: 'Gelo' },
    baby:     { hpMult: 0.30, speedMult: 1.9, body: '#b5da70', head: '#d4ec9f', size: 0.55, unlockRound: 10, weight: 26,  bigHead: true, label: 'Bebê' },
    king:     { hpMult: 11,   speedMult: 0.55, body: '#4a6e25', head: '#6b8e3a', size: 1.55, unlockRound: 12, weight: 0,   isBoss: true, horns: true, crown: true, label: 'Rei Zumbi' }
};

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = CONFIG.cols * CONFIG.gridSize;
        this.canvas.height = CONFIG.rows * CONFIG.gridSize;

        this.money = CONFIG.startMoney;
        this.health = CONFIG.startHealth;
        this.score = 0;
        this.round = 0;
        this.gameOver = false;

        this.grid = [];
        this.towers = [];
        this.zombies = [];
        this.projectiles = [];
        this.floatingTexts = [];

        this.selectedTowerType = null;
        this.selectedTower = null;
        this.hoverCell = null;

        this.start = { x: 0, y: Math.floor(CONFIG.rows / 2) };
        this.end   = { x: CONFIG.cols - 1, y: Math.floor(CONFIG.rows / 2) };

        this.waveState = 'pause';
        this.waveTimer = 0;
        this.zombiesToSpawn = 0;
        this.bossPending = false;
        this.lastSpawnTime = 0;
        this.spawnInterval = 1100;
        this.lastFrameTime = 0;
        this.gameTime = 0;
        this.speedMultiplier = 1;
        this.currentPath = [];

        this.initGrid();
        this.initEventListeners();
        this.updatePath();
        this.updateHUD();

        this.loop = this.loop.bind(this);
        this.startNextRound(this.gameTime);
        requestAnimationFrame(this.loop);
    }

    initGrid() {
        for (let x = 0; x < CONFIG.cols; x++) {
            this.grid[x] = [];
            for (let y = 0; y < CONFIG.rows; y++) this.grid[x][y] = 0;
        }
    }

    initEventListeners() {
        document.querySelectorAll('.shop-item').forEach(item => {
            item.addEventListener('click', () => {
                const type = item.dataset.type;
                if (this.money < TOWER_STATS[type].cost) return;
                const wasSelected = (this.selectedTowerType === type);
                document.querySelectorAll('.shop-item').forEach(i => i.classList.remove('selected'));
                if (wasSelected) {
                    this.selectedTowerType = null;
                } else {
                    item.classList.add('selected');
                    this.selectedTowerType = type;
                }
            });
        });

        document.querySelectorAll('#speed-control button').forEach(btn => {
            btn.addEventListener('click', () => {
                const speed = parseInt(btn.dataset.speed, 10);
                this.speedMultiplier = speed;
                document.querySelectorAll('#speed-control button').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        const cellFromEvent = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const sx = this.canvas.width / rect.width;
            const sy = this.canvas.height / rect.height;
            const x = Math.floor((e.clientX - rect.left) * sx / CONFIG.gridSize);
            const y = Math.floor((e.clientY - rect.top)  * sy / CONFIG.gridSize);
            return { x, y };
        };

        this.canvas.addEventListener('mousemove', (e) => {
            this.hoverCell = cellFromEvent(e);
        });
        this.canvas.addEventListener('mouseleave', () => { this.hoverCell = null; });

        this.canvas.addEventListener('click', (e) => {
            if (this.gameOver) return;
            const { x, y } = cellFromEvent(e);
            if (x < 0 || x >= CONFIG.cols || y < 0 || y >= CONFIG.rows) return;

            const existing = this.findTowerAt(x, y);
            if (existing) {
                this.toggleTowerMenu(existing);
                return;
            }

            // clicking on empty cell closes any open menu
            this.hideTowerMenu();

            if (!this.selectedTowerType) return;
            const cost = TOWER_STATS[this.selectedTowerType].cost;
            if (this.money < cost) {
                this.flashFloating(x, y, 'Sem $!', '#c0392b');
                return;
            }
            if (!this.canPlaceTower(x, y)) {
                this.flashFloating(x, y, 'X', '#c0392b');
                return;
            }
            this.placeTower(x, y, this.selectedTowerType);
        });

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.selectedTowerType = null;
                document.querySelectorAll('.shop-item').forEach(i => i.classList.remove('selected'));
                this.hideTowerMenu();
            }
            if (e.key >= '0' && e.key <= '4') {
                const speed = parseInt(e.key, 10);
                this.speedMultiplier = speed;
                document.querySelectorAll('#speed-control button').forEach(b => {
                    b.classList.toggle('active', parseInt(b.dataset.speed, 10) === speed);
                });
            }
        });
    }

    findTowerAt(x, y) {
        return this.towers.find(t => t.x === x && t.y === y) || null;
    }

    canPlaceTower(x, y) {
        if (x < 0 || x >= CONFIG.cols || y < 0 || y >= CONFIG.rows) return false;
        if (x === this.start.x && y === this.start.y) return false;
        if (x === this.end.x && y === this.end.y) return false;
        if (this.grid[x][y] === 1) return false;

        this.grid[x][y] = 1;
        const path = this.findPath();
        let zombiesOk = true;
        if (path) {
            for (const z of this.zombies) {
                if (ZOMBIE_STATS[z.type].flying) continue; // flying ignore obstacles
                const gx = Math.floor(z.screenX / CONFIG.gridSize);
                const gy = Math.floor(z.screenY / CONFIG.gridSize);
                if (gx === x && gy === y) { zombiesOk = false; break; }
                if (!this.findPath(gx, gy)) { zombiesOk = false; break; }
            }
        }
        this.grid[x][y] = 0;
        return !!path && zombiesOk;
    }

    placeTower(x, y, type) {
        const cost = TOWER_STATS[type].cost;
        this.money -= cost;
        this.grid[x][y] = 1;
        this.towers.push(new Tower(x, y, type));
        this.updatePath();
        for (const z of this.zombies) z.recalcPath(this);
        this.updateHUD();
    }

    sellTower(tower) {
        const refund = Math.floor(tower.totalInvested * CONFIG.sellRefundFactor);
        this.money += refund;
        this.grid[tower.x][tower.y] = 0;
        this.towers = this.towers.filter(t => t !== tower);
        this.updatePath();
        for (const z of this.zombies) z.recalcPath(this);
        this.floatingTexts.push({
            x: tower.x * CONFIG.gridSize + CONFIG.gridSize / 2,
            y: tower.y * CONFIG.gridSize + CONFIG.gridSize / 2,
            text: `+$${refund}`,
            color: '#5a4010',
            life: 70
        });
        this.hideTowerMenu();
        this.updateHUD();
    }

    upgradeTower(tower) {
        if (tower.level >= CONFIG.maxLevel) return;
        const cost = tower.getUpgradeCost();
        if (this.money < cost) {
            this.flashFloating(tower.x, tower.y, 'Sem $!', '#c0392b');
            return;
        }
        this.money -= cost;
        tower.upgrade(cost);
        this.floatingTexts.push({
            x: tower.x * CONFIG.gridSize + CONFIG.gridSize / 2,
            y: tower.y * CONFIG.gridSize + CONFIG.gridSize / 2,
            text: `Nível ${tower.level + 1}!`,
            color: '#27ae60',
            life: 70
        });
        this.renderTowerMenu();
        this.updateHUD();
    }

    toggleTowerMenu(tower) {
        if (this.selectedTower === tower) {
            this.hideTowerMenu();
        } else {
            this.showTowerMenu(tower);
        }
    }

    showTowerMenu(tower) {
        this.selectedTower = tower;
        // close shop selection while menu is open
        this.selectedTowerType = null;
        document.querySelectorAll('.shop-item').forEach(i => i.classList.remove('selected'));

        const menu = document.getElementById('tower-menu');
        this.renderTowerMenu();

        // use percentages so menu positions correctly even when canvas is scaled (mobile)
        const leftPct = ((tower.x + 0.5) / CONFIG.cols) * 100;
        menu.style.left = `${leftPct}%`;

        // show first so we can measure the rendered size
        menu.classList.add('show');
        requestAnimationFrame(() => {
            const menuW = menu.offsetWidth;
            const menuH = menu.offsetHeight;
            const containerW = menu.parentElement.offsetWidth;
            const containerH = menu.parentElement.offsetHeight;

            // --- vertical placement ---
            const towerCenterY = (tower.y + 0.5) / CONFIG.rows * containerH;
            const spaceAbove = towerCenterY;
            const spaceBelow = containerH - towerCenterY;

            let placeBelow = false;
            if (spaceBelow >= menuH && spaceAbove >= menuH) {
                placeBelow = true;
            } else if (spaceBelow >= menuH) {
                placeBelow = true;
            } else if (spaceAbove >= menuH) {
                placeBelow = false;
            } else {
                placeBelow = spaceBelow > spaceAbove;
            }

            if (placeBelow) {
                menu.style.top = `${((tower.y + 1) / CONFIG.rows) * 100}%`;
                menu.classList.add('below');
            } else {
                menu.style.top = `${(tower.y / CONFIG.rows) * 100}%`;
                menu.classList.remove('below');
            }

            // --- horizontal placement (clamp to stay inside) ---
            const towerCenterX = (tower.x + 0.5) / CONFIG.cols * containerW;
            let leftPx = towerCenterX;
            const halfW = menuW / 2;
            if (leftPx - halfW < 0) {
                leftPx = halfW; // snap to left edge
            } else if (leftPx + halfW > containerW) {
                leftPx = containerW - halfW; // snap to right edge
            }
            menu.style.left = `${(leftPx / containerW) * 100}%`;
        });
    }

    hideTowerMenu() {
        if (!this.selectedTower) return;
        this.selectedTower = null;
        document.getElementById('tower-menu').classList.remove('show');
    }

    renderTowerMenu() {
        const t = this.selectedTower;
        if (!t) return;
        const menu = document.getElementById('tower-menu');
        const stats = TOWER_STATS[t.type];
        const isMax = t.level >= CONFIG.maxLevel;
        const upgradeCost = isMax ? 0 : t.getUpgradeCost();
        const refund = Math.floor(t.totalInvested * CONFIG.sellRefundFactor);

        const stars = [];
        for (let i = 0; i < CONFIG.maxLevel + 1; i++) {
            stars.push(`<span class="${i <= t.level ? '' : 'empty'}">★</span>`);
        }

        const next = isMax ? null : t.previewUpgrade();
        const dmg = Math.round(t.damage);
        const range = (t.range / CONFIG.gridSize).toFixed(1);
        const dps = (t.damage / (t.fireRate / 1000)).toFixed(1);

        const stat = (label, cur, nxt) => {
            const same = nxt === undefined || nxt === cur;
            return `${label}: <strong>${cur}</strong>` +
                   (same ? '' : ` <span class="arrow">→ ${nxt}</span>`);
        };

        menu.innerHTML = `
            <div class="tm-header">${stats.label}</div>
            <div class="tm-level">
                Nível ${t.level + 1}/${CONFIG.maxLevel + 1}
                <span class="tm-stars">${stars.join('')}</span>
            </div>
            <div class="tm-stats">
                ${stat('Dano', dmg, next ? Math.round(next.damage) : undefined)}<br>
                ${stat('Alcance', range, next ? (next.range / CONFIG.gridSize).toFixed(1) : undefined)}<br>
                ${stat('DPS', dps, next ? (next.damage / (next.fireRate / 1000)).toFixed(1) : undefined)}
            </div>
            <button class="tm-upgrade" ${isMax || this.money < upgradeCost ? 'disabled' : ''}>
                ${isMax ? '★ NÍVEL MÁXIMO ★' : `⬆ Melhorar  $${upgradeCost}`}
            </button>
            <button class="tm-sell">💰 Vender  +$${refund}</button>
        `;

        const upBtn = menu.querySelector('.tm-upgrade');
        if (upBtn && !isMax) {
            upBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.upgradeTower(t);
            });
        }
        menu.querySelector('.tm-sell').addEventListener('click', (e) => {
            e.stopPropagation();
            this.sellTower(t);
        });
    }

    updateHUD() {
        document.getElementById('money').innerText = this.money;
        document.getElementById('health').innerText = Math.max(0, this.health);
        document.getElementById('score').innerText = this.score;
        document.getElementById('round').innerText = this.round;

        document.querySelectorAll('.shop-item').forEach(item => {
            const cost = TOWER_STATS[item.dataset.type].cost;
            item.classList.toggle('disabled', this.money < cost);
        });
    }

    // ---------- A* pathfinding ----------
    findPath(fromX = this.start.x, fromY = this.start.y) {
        const startN = { x: fromX, y: fromY };
        const end = this.end;
        const key = (p) => `${p.x},${p.y}`;

        const openSet = new Map();
        openSet.set(key(startN), startN);
        const cameFrom = {};
        const gScore = { [key(startN)]: 0 };
        const fScore = { [key(startN)]: this.dist(startN, end) };

        while (openSet.size > 0) {
            let current = null, bestF = Infinity;
            for (const node of openSet.values()) {
                const f = fScore[key(node)] ?? Infinity;
                if (f < bestF) { bestF = f; current = node; }
            }
            if (!current) break;

            if (current.x === end.x && current.y === end.y) {
                const path = [];
                let curr = current;
                while (curr) { path.push(curr); curr = cameFrom[key(curr)]; }
                return path.reverse();
            }

            openSet.delete(key(current));
            for (const n of this.getNeighbors(current)) {
                const tentative = gScore[key(current)] + 1;
                if (tentative < (gScore[key(n)] ?? Infinity)) {
                    cameFrom[key(n)] = current;
                    gScore[key(n)] = tentative;
                    fScore[key(n)] = tentative + this.dist(n, end);
                    if (!openSet.has(key(n))) openSet.set(key(n), n);
                }
            }
        }
        return null;
    }

    getNeighbors(p) {
        const dirs = [{x:0,y:1},{x:0,y:-1},{x:1,y:0},{x:-1,y:0}];
        const out = [];
        for (const d of dirs) {
            const nx = p.x + d.x, ny = p.y + d.y;
            if (nx < 0 || nx >= CONFIG.cols || ny < 0 || ny >= CONFIG.rows) continue;
            if (this.grid[nx][ny] === 1) continue;
            out.push({ x: nx, y: ny });
        }
        return out;
    }

    dist(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }

    updatePath() {
        this.currentPath = this.findPath() || [];
    }

    // ---------- waves ----------
    startNextRound(time) {
        this.round++;
        this.zombiesToSpawn = 4 + Math.floor(this.round * 1.6);
        this.spawnInterval = Math.max(360, 1100 - this.round * 28);
        this.bossPending = (this.round >= ZOMBIE_STATS.king.unlockRound && this.round % 5 === 0);
        this.waveState = 'spawning';
        this.lastSpawnTime = time - this.spawnInterval;
        this.showRoundBanner();
        this.updateHUD();
    }

    showRoundBanner() {
        const el = document.getElementById('round-banner');
        el.textContent = `Round ${this.round}`;
        el.classList.remove('show');
        void el.offsetWidth;
        el.classList.add('show');
    }

    pickZombieType() {
        const r = this.round;
        const pool = [];
        for (const [type, stats] of Object.entries(ZOMBIE_STATS)) {
            if (stats.weight > 0 && r >= stats.unlockRound) {
                pool.push([type, stats.weight]);
            }
        }
        let total = 0;
        for (const [, w] of pool) total += w;
        let roll = Math.random() * total;
        for (const [type, w] of pool) {
            if (roll < w) return type;
            roll -= w;
        }
        return 'normal';
    }

    spawnZombie() {
        // boss spawns as the last zombie of every 5th round (round 10, 15, ...)
        if (this.bossPending && this.zombiesToSpawn === 1) {
            this.bossPending = false;
            this.zombies.push(new Zombie(this.currentPath, this.round, 'king'));
            return 1;
        }
        const type = this.pickZombieType();

        // Voadores vêm em bando — tamanho escala com a rodada
        if (type === 'flying') {
            const groupSize = Math.min(8, 2 + Math.floor((this.round - 3) * 0.5));
            for (let i = 0; i < groupSize; i++) {
                const z = new Zombie(this.currentPath, this.round, 'flying');
                // espalhamento lateral para não ficarem empilhados
                z.screenY += (Math.random() - 0.5) * CONFIG.gridSize * 1.2;
                this.zombies.push(z);
            }
            return groupSize;
        }

        this.zombies.push(new Zombie(this.currentPath, this.round, type));
        return 1;
    }

    updateWaves(time) {
        if (this.waveState === 'spawning') {
            if (time - this.lastSpawnTime >= this.spawnInterval) {
                if (this.zombiesToSpawn > 0) {
                    const spawned = this.spawnZombie();
                    this.zombiesToSpawn -= spawned;
                    this.lastSpawnTime = time;
                } else {
                    this.waveState = 'active';
                }
            }
        } else if (this.waveState === 'active') {
            if (this.zombies.length === 0) {
                this.waveState = 'pause';
                this.waveTimer = time;
                this.money += CONFIG.roundBonus;
                this.flashFloating(this.end.x, 0, `+$${CONFIG.roundBonus} bônus!`, '#5a4010');
                this.updateHUD();
            }
        } else if (this.waveState === 'pause') {
            if (time - this.waveTimer >= CONFIG.pauseBetweenRounds) {
                this.startNextRound(time);
            }
        }
    }

    // ---------- helpers ----------
    flashFloating(gx, gy, text, color) {
        this.floatingTexts.push({
            x: gx * CONFIG.gridSize + CONFIG.gridSize / 2,
            y: gy * CONFIG.gridSize + CONFIG.gridSize / 2,
            text, color, life: 60
        });
    }

    handleZombieKilled(z) {
        const reward = Math.floor((4 + Math.floor(z.maxHealth / 14)) * 0.7);
        this.money += reward;
        this.score += z.maxHealth;
        this.floatingTexts.push({ x: z.screenX, y: z.screenY, text: `+$${reward}`, color: '#5a4010', life: 60 });
        this.updateHUD();
    }

    handleZombieReachedEnd(z) {
        const damage = ZOMBIE_STATS[z.type].isBoss ? 5 : 1;
        this.health -= damage;
        this.updateHUD();
        if (this.health <= 0) this.endGame();
    }

    endGame() {
        this.gameOver = true;
        this.hideTowerMenu();
        const el = document.getElementById('game-over');
        el.innerHTML = `
            <h1>Game Over</h1>
            <p>Round atingido: ${this.round}</p>
            <p>Pontuação: ${this.score}</p>
            <button onclick="location.reload()">Jogar Novamente</button>
        `;
        el.classList.add('show');
    }

    // ---------- main loop ----------
    loop(realTime) {
        const realDt = this.lastFrameTime ? Math.min(50, realTime - this.lastFrameTime) : 16;
        this.lastFrameTime = realTime;

        const dt = realDt * this.speedMultiplier;
        this.gameTime += dt;
        const time = this.gameTime;

        if (!this.gameOver && this.speedMultiplier > 0) this.updateWaves(time);

        if (this.speedMultiplier > 0) {
            for (const t of this.towers) t.update(time, dt, this.zombies, this.projectiles, this);

            for (let i = this.zombies.length - 1; i >= 0; i--) {
                const z = this.zombies[i];
                z.update(dt, this);
                if (z.reachedEnd) {
                    this.handleZombieReachedEnd(z);
                    this.zombies.splice(i, 1);
                } else if (z.health <= 0) {
                    this.handleZombieKilled(z);
                    this.zombies.splice(i, 1);
                }
            }

            for (let i = this.projectiles.length - 1; i >= 0; i--) {
                const p = this.projectiles[i];
                p.update(this.zombies, dt, this);
                if (p.dead) this.projectiles.splice(i, 1);
            }
        }

        this.drawBackground();
        this.drawGrid();
        this.drawHover();

        const sortedZombies = [...this.zombies].sort((a, b) => a.screenY - b.screenY);
        for (const z of sortedZombies) z.draw(this.ctx);
        for (const t of this.towers) t.draw(this.ctx);
        for (const p of this.projectiles) p.draw(this.ctx);

        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const f = this.floatingTexts[i];
            f.life--;
            f.y -= 0.6;
            this.ctx.globalAlpha = Math.max(0, f.life / 60);
            this.ctx.font = "bold 20px 'Bangers', cursive";
            this.ctx.fillStyle = f.color;
            this.ctx.strokeStyle = 'rgba(255,255,255,0.6)';
            this.ctx.lineWidth = 3;
            this.ctx.textAlign = 'center';
            this.ctx.strokeText(f.text, f.x, f.y);
            this.ctx.fillText(f.text, f.x, f.y);
            this.ctx.globalAlpha = 1;
            if (f.life <= 0) this.floatingTexts.splice(i, 1);
        }

        if (this.speedMultiplier === 0) {
            this.ctx.fillStyle = 'rgba(28, 14, 6, 0.35)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.font = "bold 64px 'Bangers', cursive";
            this.ctx.fillStyle = '#fff';
            this.ctx.strokeStyle = '#2c1810';
            this.ctx.lineWidth = 5;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.strokeText('PAUSADO', this.canvas.width/2, this.canvas.height/2);
            this.ctx.fillText('PAUSADO', this.canvas.width/2, this.canvas.height/2);
        } else if (this.speedMultiplier > 1) {
            this.ctx.font = "bold 32px 'Bangers', cursive";
            this.ctx.fillStyle = 'rgba(241, 196, 15, 0.85)';
            this.ctx.strokeStyle = '#2c1810';
            this.ctx.lineWidth = 3;
            this.ctx.textAlign = 'right';
            this.ctx.textBaseline = 'top';
            this.ctx.strokeText(`x${this.speedMultiplier}`, this.canvas.width - 10, 8);
            this.ctx.fillText(`x${this.speedMultiplier}`, this.canvas.width - 10, 8);
        }

        requestAnimationFrame(this.loop);
    }

    // ---------- drawing ----------
    drawBackground() {
        const ctx = this.ctx;
        ctx.fillStyle = COLORS.paperLight;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.fillStyle = 'rgba(91, 47, 18, 0.05)';
        for (let i = 0; i < 80; i++) {
            const x = (i * 137 + 41) % this.canvas.width;
            const y = (i * 311 + 17) % this.canvas.height;
            ctx.fillRect(x, y, 2, 2);
        }

        ctx.strokeStyle = 'rgba(91, 47, 18, 0.18)';
        ctx.lineWidth = 1.2;
        const blobs = [[80, 40], [180, 460], [620, 70], [720, 410], [380, 250]];
        for (const [bx, by] of blobs) {
            ctx.beginPath();
            for (let a = 0; a < Math.PI * 2; a += 0.4) {
                const rad = 14 + Math.sin(a * 3 + bx) * 4;
                const px = bx + Math.cos(a) * rad;
                const py = by + Math.sin(a) * rad * 0.5;
                if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.stroke();
        }

        const grad = ctx.createRadialGradient(
            this.canvas.width/2, this.canvas.height/2, this.canvas.height * 0.4,
            this.canvas.width/2, this.canvas.height/2, this.canvas.height * 0.95
        );
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(91, 47, 18, 0.28)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawGrid() {
        const ctx = this.ctx;
        ctx.strokeStyle = COLORS.grid;
        ctx.lineWidth = 1;
        for (let x = 0; x <= CONFIG.cols; x++) {
            ctx.beginPath();
            ctx.moveTo(x * CONFIG.gridSize, 0);
            ctx.lineTo(x * CONFIG.gridSize, this.canvas.height);
            ctx.stroke();
        }
        for (let y = 0; y <= CONFIG.rows; y++) {
            ctx.beginPath();
            ctx.moveTo(0, y * CONFIG.gridSize);
            ctx.lineTo(this.canvas.width, y * CONFIG.gridSize);
            ctx.stroke();
        }
    }

    drawHover() {
        if (!this.hoverCell) return;
        const { x, y } = this.hoverCell;
        if (x < 0 || x >= CONFIG.cols || y < 0 || y >= CONFIG.rows) return;
        const ctx = this.ctx;

        const existing = this.findTowerAt(x, y);
        if (existing) {
            // highlight tower cell + show its range as a hint
            ctx.fillStyle = 'rgba(241, 196, 15, 0.22)';
            ctx.fillRect(x * CONFIG.gridSize, y * CONFIG.gridSize, CONFIG.gridSize, CONFIG.gridSize);
            ctx.strokeStyle = 'rgba(241, 196, 15, 0.85)';
            ctx.setLineDash([6, 4]);
            ctx.lineWidth = 2;
            ctx.strokeRect(x * CONFIG.gridSize + 1, y * CONFIG.gridSize + 1, CONFIG.gridSize - 2, CONFIG.gridSize - 2);
            ctx.setLineDash([]);

            if (existing.range > 0) {
                const cx = x * CONFIG.gridSize + CONFIG.gridSize/2;
                const cy = y * CONFIG.gridSize + CONFIG.gridSize/2;
                ctx.beginPath();
                ctx.arc(cx, cy, existing.range, 0, Math.PI*2);
                ctx.strokeStyle = 'rgba(91, 47, 18, 0.45)';
                ctx.setLineDash([5, 5]);
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.setLineDash([]);
            }
            return;
        }

        if (!this.selectedTowerType) return;
        const can = this.canPlaceTower(x, y) && this.money >= TOWER_STATS[this.selectedTowerType].cost;
        ctx.fillStyle = can ? 'rgba(80, 160, 80, 0.30)' : 'rgba(192, 57, 43, 0.30)';
        ctx.fillRect(x * CONFIG.gridSize, y * CONFIG.gridSize, CONFIG.gridSize, CONFIG.gridSize);

        if (can) {
            const range = TOWER_STATS[this.selectedTowerType].range * CONFIG.gridSize;
            const cx = x * CONFIG.gridSize + CONFIG.gridSize/2;
            const cy = y * CONFIG.gridSize + CONFIG.gridSize/2;
            ctx.beginPath();
            ctx.arc(cx, cy, range, 0, Math.PI*2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.10)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(91, 47, 18, 0.5)';
            ctx.setLineDash([5, 5]);
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function inkStroke(ctx, w = 2) {
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = w;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
}

class Tower {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        const s = TOWER_STATS[type];
        this.baseDamage = s.damage;
        this.baseRange = s.range * CONFIG.gridSize;
        this.baseFireRate = s.fireRate;
        this.level = 0;
        this.totalInvested = s.cost;
        this.lastShot = 0;
        this.angle = 0;
        this.recoil = 0;
        this.spinAngle = 0;
        this.frozenUntil = 0;
        this.applyLevel();
    }

    applyLevel() {
        const dmgMult = 1 + this.level * 0.55;     // +55% damage per level
        const rangeMult = 1 + this.level * 0.12;   // +12% range per level
        const rateMult = Math.pow(0.82, this.level); // ~18% faster per level
        this.damage = this.baseDamage * dmgMult;
        this.range = this.baseRange * rangeMult;
        this.fireRate = this.baseFireRate * rateMult;
    }

    getUpgradeCost() {
        if (this.level >= CONFIG.maxLevel) return 0;
        const factor = CONFIG.upgradeCostFactors[this.level];
        return Math.max(1, Math.floor(TOWER_STATS[this.type].cost * factor));
    }

    upgrade(paidCost) {
        if (this.level >= CONFIG.maxLevel) return;
        this.level++;
        this.totalInvested += paidCost;
        this.applyLevel();
    }

    previewUpgrade() {
        if (this.level >= CONFIG.maxLevel) return null;
        const nextLevel = this.level + 1;
        const dmgMult = 1 + nextLevel * 0.55;
        const rangeMult = 1 + nextLevel * 0.12;
        const rateMult = Math.pow(0.82, nextLevel);
        return {
            damage: this.baseDamage * dmgMult,
            range: this.baseRange * rangeMult,
            fireRate: this.baseFireRate * rateMult
        };
    }

    update(time, dt, zombies, projectiles, game) {
        this.recoil = Math.max(0, this.recoil - 0.5);

        // se congelada, não atira
        if (this.frozenUntil > time) {
            return;
        }
        // descongelou — limpa o timer
        if (this.frozenUntil > 0) this.frozenUntil = 0;

        const target = this.findTarget(zombies);
        if (target) {
            const cx = this.x * CONFIG.gridSize + CONFIG.gridSize/2;
            const cy = this.y * CONFIG.gridSize + CONFIG.gridSize/2;
            this.angle = Math.atan2(target.screenY - cy, target.screenX - cx);
            if (time - this.lastShot > this.fireRate) {
                if (this.type === 'tesla') {
                    this.fireTesla(cx, cy, target, zombies, projectiles, game);
                } else {
                    projectiles.push(new Projectile(cx, cy, target, this.damage, this.type));
                }
                this.lastShot = time;
                this.recoil = 6;
            }
        }
    }

    fireTesla(cx, cy, target, zombies, projectiles, game) {
        const stats = TOWER_STATS.tesla;
        const chainRange = stats.chainRange * CONFIG.gridSize;
        const falloff = stats.chainFalloff;
        const damaged = new Set([target]);
        const points = [{ x: cx, y: cy }, { x: target.screenX, y: target.screenY }];

        target.applyDamage(this.damage, game);

        let last = target;
        for (let i = 0; i < stats.chains; i++) {
            const next = this.findChainTarget(zombies, last, damaged, chainRange);
            if (!next) break;
            const dmg = this.damage * Math.pow(falloff, i + 1);
            next.applyDamage(dmg, game);
            damaged.add(next);
            points.push({ x: next.screenX, y: next.screenY });
            last = next;
        }

        const bolt = new Projectile(cx, cy, target, this.damage, 'tesla');
        bolt.chainPoints = points;
        bolt.lifetimeMs = 220;
        bolt.dead = false;
        bolt.lifeMs = 0;
        projectiles.push(bolt);
    }

    findChainTarget(zombies, fromZ, exclude, range) {
        let best = null;
        let bestDist = Infinity;
        for (const z of zombies) {
            if (exclude.has(z) || z.health <= 0) continue;
            const dx = z.screenX - fromZ.screenX, dy = z.screenY - fromZ.screenY;
            const d = Math.hypot(dx, dy);
            if (d > range) continue;
            if (d < bestDist) { bestDist = d; best = z; }
        }
        return best;
    }

    findTarget(zombies) {
        const stats = TOWER_STATS[this.type];
        const cx = this.x * CONFIG.gridSize + CONFIG.gridSize/2;
        const cy = this.y * CONFIG.gridSize + CONFIG.gridSize/2;
        let best = null;
        let bestProgress = -1;
        for (const z of zombies) {
            if (z.health <= 0) continue;
            if (stats.ignoresFlying && ZOMBIE_STATS[z.type].flying) continue;
            const dx = cx - z.screenX, dy = cy - z.screenY;
            if (dx*dx + dy*dy > this.range*this.range) continue;
            if (z.pathIndex > bestProgress) { bestProgress = z.pathIndex; best = z; }
        }
        return best;
    }

    draw(ctx) {
        const cx = this.x * CONFIG.gridSize + CONFIG.gridSize/2;
        const cy = this.y * CONFIG.gridSize + CONFIG.gridSize/2;

        ctx.save();
        ctx.translate(cx, cy);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
        ctx.beginPath();
        ctx.ellipse(0, 17, 18, 5, 0, 0, Math.PI*2);
        ctx.fill();

        switch (this.type) {
            case 'spike':      this.drawSpike(ctx); break;
            case 'pistol':     this.drawPistol(ctx); break;
            case 'machinegun': this.drawMachinegun(ctx); break;
            case 'poison':     this.drawPoison(ctx); break;
            case 'radar':      this.drawRadar(ctx); break;
            case 'robot':      this.drawRobot(ctx); break;
            case 'rocket':     this.drawRocket(ctx); break;
            case 'tesla':      this.drawTesla(ctx); break;
        }

        // level stars above the tower
        if (this.level > 0) {
            const starY = -22;
            const spacing = 7;
            const totalW = (this.level - 1) * spacing;
            for (let i = 0; i < this.level; i++) {
                const sx = -totalW / 2 + i * spacing;
                ctx.fillStyle = '#f1c40f';
                ctx.strokeStyle = COLORS.ink;
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                for (let p = 0; p < 5; p++) {
                    const a = -Math.PI / 2 + (p * 2 * Math.PI) / 5;
                    const r = 3.2;
                    ctx.lineTo(sx + Math.cos(a) * r, starY + Math.sin(a) * r);
                    const a2 = a + Math.PI / 5;
                    ctx.lineTo(sx + Math.cos(a2) * r * 0.45, starY + Math.sin(a2) * r * 0.45);
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            }
        }

        // overlay de gelo se torre estiver congelada
        if (this.frozenUntil > 0) {
            ctx.fillStyle = 'rgba(135, 206, 250, 0.45)';
            ctx.beginPath();
            ctx.arc(0, 0, 22, 0, Math.PI * 2);
            ctx.fill();
            // cristais de gelo
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.beginPath();
            ctx.arc(-8, -6, 2, 0, Math.PI * 2);
            ctx.arc(6, 4, 1.5, 0, Math.PI * 2);
            ctx.arc(-4, 8, 1.2, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    drawSpike(ctx) {
        inkStroke(ctx, 2);
        // dirt mound
        ctx.fillStyle = '#8b5a2b';
        roundRect(ctx, -14, 6, 28, 12, 5);
        ctx.fill();
        ctx.stroke();
        // 4 spikes (gray, triangular)
        ctx.fillStyle = '#9ca3a8';
        for (let i = 0; i < 4; i++) {
            const sx = -10 + i * 7;
            ctx.beginPath();
            ctx.moveTo(sx - 3, 6);
            ctx.lineTo(sx, -12);
            ctx.lineTo(sx + 3, 6);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }
        // tips highlight
        ctx.fillStyle = '#dde1e3';
        for (let i = 0; i < 4; i++) {
            const sx = -10 + i * 7;
            ctx.beginPath();
            ctx.moveTo(sx - 1, -4);
            ctx.lineTo(sx, -12);
            ctx.lineTo(sx + 1, -4);
            ctx.closePath();
            ctx.fill();
        }
    }

    drawPistol(ctx) {
        inkStroke(ctx, 2);
        ctx.fillStyle = '#8b5a2b';
        roundRect(ctx, -13, 8, 26, 11, 3);
        ctx.fill(); ctx.stroke();

        // turret dome
        ctx.fillStyle = '#7f8c8d';
        ctx.beginPath();
        ctx.arc(0, -2, 10, 0, Math.PI*2);
        ctx.fill(); ctx.stroke();

        ctx.fillStyle = '#34495e';
        ctx.beginPath();
        ctx.arc(-5, -4, 1.3, 0, Math.PI*2);
        ctx.arc(5, -4, 1.3, 0, Math.PI*2);
        ctx.fill();

        // rotating barrel
        ctx.save();
        ctx.rotate(this.angle);
        ctx.translate(-this.recoil, 0);
        ctx.fillStyle = '#34495e';
        roundRect(ctx, 4, -2.5, 14, 5, 1.5);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#1c1c1c';
        ctx.beginPath();
        ctx.arc(18, 0, 1.5, 0, Math.PI*2);
        ctx.fill(); ctx.stroke();
        ctx.restore();
    }

    drawMachinegun(ctx) {
        inkStroke(ctx, 2);
        ctx.fillStyle = '#8b5a2b';
        roundRect(ctx, -14, 8, 28, 11, 3);
        ctx.fill(); ctx.stroke();

        // body
        ctx.fillStyle = '#5d6e7a';
        roundRect(ctx, -10, -8, 20, 16, 3);
        ctx.fill(); ctx.stroke();

        // ammo belt detail
        ctx.fillStyle = '#f1c40f';
        for (let i = -8; i < 9; i += 4) {
            ctx.beginPath();
            ctx.arc(i, 6, 1.2, 0, Math.PI*2);
            ctx.fill();
        }

        // double barrel rotated
        ctx.save();
        ctx.rotate(this.angle);
        ctx.translate(-this.recoil, 0);
        ctx.fillStyle = '#34495e';
        roundRect(ctx, 2, -5, 16, 3, 1);
        ctx.fill(); ctx.stroke();
        roundRect(ctx, 2, 2, 16, 3, 1);
        ctx.fill(); ctx.stroke();
        ctx.restore();
    }

    drawPoison(ctx) {
        inkStroke(ctx, 2);
        ctx.fillStyle = '#8b5a2b';
        roundRect(ctx, -13, 9, 26, 10, 3);
        ctx.fill(); ctx.stroke();

        // green chemical canister
        ctx.fillStyle = '#7ed321';
        roundRect(ctx, -10, -10, 20, 22, 4);
        ctx.fill(); ctx.stroke();

        // toxic stripe
        ctx.fillStyle = '#2c1810';
        roundRect(ctx, -10, -2, 20, 4, 1);
        ctx.fill();
        ctx.fillStyle = '#f1c40f';
        ctx.font = "bold 8px 'Bangers', cursive";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('☣', 0, 0);

        // bubbles
        const t = performance.now() * 0.003;
        ctx.fillStyle = 'rgba(126, 211, 33, 0.85)';
        ctx.beginPath();
        ctx.arc(-5, -10 - (Math.sin(t) * 3 + 3), 2, 0, Math.PI*2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(4, -10 - (Math.cos(t * 1.3) * 2 + 4), 1.5, 0, Math.PI*2);
        ctx.fill();

        // emitter
        ctx.save();
        ctx.rotate(this.angle);
        ctx.translate(-this.recoil, 0);
        ctx.fillStyle = '#5a8f1c';
        roundRect(ctx, 4, -2.5, 12, 5, 1);
        ctx.fill(); ctx.stroke();
        ctx.restore();
    }

    drawRadar(ctx) {
        inkStroke(ctx, 2);
        // base
        ctx.fillStyle = '#8b5a2b';
        roundRect(ctx, -12, 10, 24, 9, 3);
        ctx.fill(); ctx.stroke();

        // pole
        ctx.fillStyle = '#5d6e7a';
        roundRect(ctx, -2, -2, 4, 14, 1);
        ctx.fill(); ctx.stroke();

        // dish (rotates with angle)
        ctx.save();
        ctx.rotate(this.angle - Math.PI/2);
        ctx.translate(0, -10);
        ctx.fillStyle = '#ecf0f1';
        ctx.beginPath();
        ctx.arc(0, 0, 11, Math.PI, 0);
        ctx.lineTo(8, 2);
        ctx.lineTo(-8, 2);
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        // dish detail lines
        ctx.beginPath();
        ctx.moveTo(-6, -2); ctx.lineTo(6, -2);
        ctx.moveTo(-4, -6); ctx.lineTo(4, -6);
        ctx.stroke();

        // antenna feed
        ctx.fillStyle = '#c0392b';
        ctx.beginPath();
        ctx.arc(0, -1, 2.5, 0, Math.PI*2);
        ctx.fill(); ctx.stroke();
        ctx.restore();
    }

    drawRobot(ctx) {
        inkStroke(ctx, 2);
        ctx.fillStyle = '#8b5a2b';
        roundRect(ctx, -14, 11, 28, 8, 3);
        ctx.fill(); ctx.stroke();

        // body (humanoid robot)
        ctx.fillStyle = '#95a5a6';
        roundRect(ctx, -10, -4, 20, 16, 4);
        ctx.fill(); ctx.stroke();

        // head
        ctx.fillStyle = '#bdc3c7';
        roundRect(ctx, -7, -14, 14, 10, 3);
        ctx.fill(); ctx.stroke();

        // eyes (glowing red)
        ctx.fillStyle = '#c0392b';
        ctx.beginPath();
        ctx.arc(-3, -9, 1.6, 0, Math.PI*2);
        ctx.arc(3, -9, 1.6, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(-3, -9, 0.6, 0, Math.PI*2);
        ctx.arc(3, -9, 0.6, 0, Math.PI*2);
        ctx.fill();

        // antenna
        ctx.beginPath();
        ctx.moveTo(0, -14);
        ctx.lineTo(0, -19);
        ctx.stroke();
        ctx.fillStyle = '#f1c40f';
        ctx.beginPath();
        ctx.arc(0, -20, 1.8, 0, Math.PI*2);
        ctx.fill(); ctx.stroke();

        // chest light
        ctx.fillStyle = '#27ae60';
        ctx.beginPath();
        ctx.arc(0, 4, 2.5, 0, Math.PI*2);
        ctx.fill(); ctx.stroke();

        // arm/cannon (rotates)
        ctx.save();
        ctx.rotate(this.angle);
        ctx.translate(-this.recoil, 0);
        ctx.fillStyle = '#34495e';
        roundRect(ctx, 6, -3.5, 14, 7, 2);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#1c1c1c';
        ctx.beginPath();
        ctx.arc(20, 0, 2, 0, Math.PI*2);
        ctx.fill(); ctx.stroke();
        ctx.restore();
    }

    drawRocket(ctx) {
        inkStroke(ctx, 2);
        ctx.fillStyle = '#8b5a2b';
        roundRect(ctx, -14, 10, 28, 9, 3);
        ctx.fill(); ctx.stroke();

        // launcher tube (rotates)
        ctx.save();
        ctx.rotate(this.angle);
        ctx.translate(-this.recoil, 0);
        ctx.fillStyle = '#3a3a3a';
        roundRect(ctx, -8, -7, 24, 14, 4);
        ctx.fill(); ctx.stroke();

        // rocket inside (visible tip)
        ctx.fillStyle = '#c0392b';
        ctx.beginPath();
        ctx.moveTo(8, -4);
        ctx.lineTo(15, 0);
        ctx.lineTo(8, 4);
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        // grip handles
        ctx.fillStyle = '#2c1810';
        roundRect(ctx, -10, -3, 4, 6, 1);
        ctx.fill(); ctx.stroke();

        ctx.restore();

        // little rockets stack at base for flair
        ctx.fillStyle = '#c0392b';
        ctx.strokeStyle = COLORS.ink;
        ctx.lineWidth = 1;
        for (let i = 0; i < 2; i++) {
            const ry = 13 + i * 3;
            ctx.beginPath();
            ctx.moveTo(-9, ry);
            ctx.lineTo(-12, ry + 1.5);
            ctx.lineTo(-9, ry + 3);
            ctx.closePath();
            ctx.fill(); ctx.stroke();
        }
    }

    drawTesla(ctx) {
        inkStroke(ctx, 2);
        // wood base
        ctx.fillStyle = '#8b5a2b';
        roundRect(ctx, -13, 11, 26, 8, 3);
        ctx.fill(); ctx.stroke();

        // metal column with rivets
        ctx.fillStyle = '#5d6e7a';
        roundRect(ctx, -5, -3, 10, 14, 2);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#2c1810';
        ctx.beginPath();
        ctx.arc(-2.5, 1, 0.8, 0, Math.PI*2);
        ctx.arc(2.5, 1, 0.8, 0, Math.PI*2);
        ctx.arc(-2.5, 7, 0.8, 0, Math.PI*2);
        ctx.arc(2.5, 7, 0.8, 0, Math.PI*2);
        ctx.fill();

        // tesla coil sphere (electric blue + silver)
        const t = performance.now() * 0.012;
        // outer glow
        const glow = ctx.createRadialGradient(0, -10, 2, 0, -10, 16);
        glow.addColorStop(0, 'rgba(180, 230, 255, 0.85)');
        glow.addColorStop(0.5, 'rgba(126, 200, 255, 0.4)');
        glow.addColorStop(1, 'rgba(126, 200, 255, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, -10, 16, 0, Math.PI*2);
        ctx.fill();

        // sphere body
        ctx.fillStyle = '#bdc3c7';
        ctx.beginPath();
        ctx.arc(0, -10, 8, 0, Math.PI*2);
        ctx.fill(); ctx.stroke();

        // sphere highlight
        ctx.fillStyle = '#ecf0f1';
        ctx.beginPath();
        ctx.arc(-2.5, -12, 2.5, 0, Math.PI*2);
        ctx.fill();

        // crackling electric arcs around sphere (animated, jittery)
        ctx.strokeStyle = '#7ec8ff';
        ctx.lineWidth = 1.4;
        for (let i = 0; i < 4; i++) {
            const a = t + (i * Math.PI / 2);
            const sx = Math.cos(a) * 8;
            const sy = -10 + Math.sin(a) * 8;
            const ex = sx + Math.cos(a) * (5 + Math.sin(t * 3 + i) * 2);
            const ey = sy + Math.sin(a) * (5 + Math.sin(t * 3 + i) * 2);
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            // jagged path
            const mx = (sx + ex) / 2 + (Math.random() - 0.5) * 4;
            const my = (sy + ey) / 2 + (Math.random() - 0.5) * 4;
            ctx.lineTo(mx, my);
            ctx.lineTo(ex, ey);
            ctx.stroke();
        }

        // bright center dot
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(0, -10, 2, 0, Math.PI*2);
        ctx.fill();

        // small antennae prongs on top
        ctx.strokeStyle = COLORS.ink;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-3, -16); ctx.lineTo(-4, -19);
        ctx.moveTo(3, -16);  ctx.lineTo(4, -19);
        ctx.moveTo(0, -18);  ctx.lineTo(0, -21);
        ctx.stroke();
    }
}

class Zombie {
    constructor(path, round, type) {
        this.path = [...path];
        this.pathIndex = Math.min(1, this.path.length - 1);
        this.type = type;
        const stats = ZOMBIE_STATS[type];

        const baseHealth = 35;
        const scaling = Math.pow(1.16, round - 1);
        this.maxHealth = Math.max(1, Math.floor(baseHealth * scaling * stats.hpMult));
        this.health = this.maxHealth;

        const roundBoost = Math.min(CONFIG.maxRoundSpeedBonus, (round - 1) * CONFIG.speedPerRound);
        const baseSpeed = (CONFIG.baseSpeed + roundBoost) * stats.speedMult;
        this.baseSpeed = baseSpeed;
        this.speed = this.baseSpeed;

        this.slowTimer = 0;
        this.poisonTimer = 0;
        this.poisonDamagePerMs = 0;
        this.iceArmorBroken = false;
        this.reachedEnd = false;
        this.bobPhase = Math.random() * Math.PI * 2;
        this.facing = 1;
        this.deathBomb = false;

        const start = path[0] || { x: 0, y: 0 };
        this.screenX = start.x * CONFIG.gridSize + CONFIG.gridSize/2;
        this.screenY = start.y * CONFIG.gridSize + CONFIG.gridSize/2;
    }

    recalcPath(game) {
        if (ZOMBIE_STATS[this.type].flying) return; // flying ignores towers
        const gx = Math.floor(this.screenX / CONFIG.gridSize);
        const gy = Math.floor(this.screenY / CONFIG.gridSize);
        const newPath = game.findPath(gx, gy);
        if (newPath && newPath.length > 0) {
            this.path = newPath;
            this.pathIndex = Math.min(1, newPath.length - 1);
        }
    }

    applySlow(factor, durationMs) {
        if (ZOMBIE_STATS[this.type].slowImmune) return;
        this.slowTimer = Math.max(this.slowTimer, durationMs);
        this.speed = this.baseSpeed * factor;
    }

    applyPoison(damagePerMs, durationMs) {
        this.poisonTimer = Math.max(this.poisonTimer, durationMs);
        this.poisonDamagePerMs = Math.max(this.poisonDamagePerMs, damagePerMs);
    }

    applyDamage(amount, game) {
        const stats = ZOMBIE_STATS[this.type];
        // zumbi de gelo: imune enquanto armadura intacta
        if (stats.freezesTowers && !this.iceArmorBroken) {
            if (game) {
                game.floatingTexts.push({
                    x: this.screenX, y: this.screenY - 18,
                    text: 'bloqueado', color: '#85b3d4', life: 35
                });
            }
            return false;
        }
        if (stats.dodgeChance && Math.random() < stats.dodgeChance) {
            if (game) {
                game.floatingTexts.push({
                    x: this.screenX, y: this.screenY - 18,
                    text: 'miss', color: '#7f8c8d', life: 35
                });
            }
            return false;
        }
        this.health -= amount;
        return true;
    }

    update(dt, game) {
        if (this.slowTimer > 0) {
            this.slowTimer -= dt;
            if (this.slowTimer <= 0) this.speed = this.baseSpeed;
        }
        if (this.poisonTimer > 0) {
            this.poisonTimer -= dt;
            this.health -= this.poisonDamagePerMs * dt;
        }
        this.bobPhase += dt * 0.012;

        let tx, ty;
        const isFlying = ZOMBIE_STATS[this.type].flying;

        if (isFlying && game) {
            // Voadores vão em linha reta direto ao fim
            tx = game.end.x * CONFIG.gridSize + CONFIG.gridSize / 2;
            ty = game.end.y * CONFIG.gridSize + CONFIG.gridSize / 2;
        } else {
            if (!this.path || this.pathIndex >= this.path.length) {
                this.reachedEnd = true;
                return;
            }
            const target = this.path[this.pathIndex];
            tx = target.x * CONFIG.gridSize + CONFIG.gridSize/2;
            ty = target.y * CONFIG.gridSize + CONFIG.gridSize/2;
        }

        const dx = tx - this.screenX, dy = ty - this.screenY;
        const dist = Math.hypot(dx, dy);
        const move = this.speed * dt;
        if (Math.abs(dx) > 0.1) this.facing = dx > 0 ? 1 : -1;
        if (dist <= move) {
            if (isFlying) {
                this.reachedEnd = true;
            } else {
                this.screenX = tx;
                this.screenY = ty;
                this.pathIndex++;
            }
        } else {
            this.screenX += (dx / dist) * move;
            this.screenY += (dy / dist) * move;
        }

        // zumbi de gelo congela torres ao passar
        if (ZOMBIE_STATS[this.type].freezesTowers && game) {
            const freezeRange = CONFIG.gridSize * 1.2;
            for (const t of game.towers) {
                const tcx = t.x * CONFIG.gridSize + CONFIG.gridSize / 2;
                const tcy = t.y * CONFIG.gridSize + CONFIG.gridSize / 2;
                const d = Math.hypot(this.screenX - tcx, this.screenY - tcy);
                if (d < freezeRange) {
                    t.frozenUntil = Math.max(t.frozenUntil, game.gameTime + 3000);
                }
            }
        }
    }

    draw(ctx) {
        const stats = ZOMBIE_STATS[this.type];
        const baseScale = stats.size;
        const cx = this.screenX;
        const hoverOffset = stats.flying ? -6 + Math.sin(this.bobPhase * 1.5) * 2 : Math.sin(this.bobPhase) * 1.2;
        const cy = this.screenY + hoverOffset;
        const groundY = this.screenY + (stats.flying ? 14 : 16 * baseScale);

        // shadow (smaller and more transparent for flying)
        ctx.fillStyle = stats.flying ? 'rgba(0, 0, 0, 0.12)' : 'rgba(0, 0, 0, 0.22)';
        ctx.beginPath();
        ctx.ellipse(cx, groundY, 11 * baseScale, 3.5 * baseScale, 0, 0, Math.PI*2);
        ctx.fill();

        let bodyColor = stats.body;
        let headColor = stats.head;
        // gelo com armadura quebrada: tom mais escuro e avermelhado
        if (stats.freezesTowers && this.iceArmorBroken) {
            bodyColor = '#3a5a78';
            headColor = '#5a7a98';
        }
        if (this.slowTimer > 0) { bodyColor = '#5d96b3'; headColor = '#92c3df'; }
        if (this.poisonTimer > 0) { bodyColor = '#7a4f8a'; headColor = '#a578b3'; }

        const armSwing = Math.sin(this.bobPhase * 2) * 2.2;
        const legSwing = Math.sin(this.bobPhase * 2 + Math.PI) * 1.8;

        ctx.save();
        ctx.translate(cx, cy);
        if (this.facing < 0) ctx.scale(-1, 1);
        if (stats.ghost) ctx.globalAlpha = 0.65;

        inkStroke(ctx, 1.8);

        // wings (drawn first, behind body)
        if (stats.flying) {
            const wingFlap = Math.sin(this.bobPhase * 6) * 4;
            ctx.fillStyle = '#cfd8d0';
            // back wing
            ctx.beginPath();
            ctx.moveTo(0, -4 * baseScale);
            ctx.quadraticCurveTo(-12 * baseScale, -10 * baseScale - wingFlap, -14 * baseScale, -2 * baseScale - wingFlap);
            ctx.quadraticCurveTo(-8 * baseScale, -2 * baseScale, 0, 0);
            ctx.closePath();
            ctx.fill(); ctx.stroke();
            // front wing
            ctx.beginPath();
            ctx.moveTo(0, -4 * baseScale);
            ctx.quadraticCurveTo(12 * baseScale, -10 * baseScale - wingFlap, 14 * baseScale, -2 * baseScale - wingFlap);
            ctx.quadraticCurveTo(8 * baseScale, -2 * baseScale, 0, 0);
            ctx.closePath();
            ctx.fill(); ctx.stroke();
        }

        // legs
        if (!stats.flying) {
            ctx.fillStyle = stats.skeletal ? '#f0ebd8' : '#2c1810';
            roundRect(ctx, -5 * baseScale, 8 * baseScale - legSwing, 4 * baseScale, 7 * baseScale + legSwing, 1.5);
            ctx.fill(); ctx.stroke();
            roundRect(ctx, 1 * baseScale, 8 * baseScale + legSwing, 4 * baseScale, 7 * baseScale - legSwing, 1.5);
            ctx.fill(); ctx.stroke();
        }

        // torso
        ctx.fillStyle = bodyColor;
        const bw = 14 * baseScale;
        const bh = stats.bigHead ? 11 * baseScale : 14 * baseScale;
        const torsoTop = stats.bigHead ? -3 * baseScale : -5 * baseScale;
        roundRect(ctx, -bw/2, torsoTop, bw, bh, 4);
        ctx.fill(); ctx.stroke();

        // skeletal ribs
        if (stats.skeletal) {
            ctx.beginPath();
            for (let i = 0; i < 3; i++) {
                const yy = torsoTop + 3 + i * 3;
                ctx.moveTo(-bw/2 + 2, yy);
                ctx.lineTo(bw/2 - 2, yy);
            }
            ctx.stroke();
        }

        // rachaduras na armadura de gelo quebrada
        if (stats.freezesTowers && this.iceArmorBroken) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(-4 * baseScale, torsoTop + 2);
            ctx.lineTo(-1 * baseScale, torsoTop + 5);
            ctx.lineTo(-3 * baseScale, torsoTop + 9);
            ctx.lineTo(0, torsoTop + bh - 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(3 * baseScale, torsoTop + 3);
            ctx.lineTo(5 * baseScale, torsoTop + 7);
            ctx.lineTo(2 * baseScale, torsoTop + 11);
            ctx.stroke();
        }

        // bomber: TNT bandolier
        if (stats.bomb) {
            ctx.fillStyle = '#2c1810';
            ctx.beginPath();
            ctx.arc(0, torsoTop + bh/2, 3.5, 0, Math.PI*2);
            ctx.fill(); ctx.stroke();
            ctx.strokeStyle = COLORS.ink;
            ctx.beginPath();
            ctx.moveTo(0, torsoTop + bh/2 - 3.5);
            ctx.lineTo(2, torsoTop + bh/2 - 6);
            ctx.stroke();
            ctx.fillStyle = '#f1c40f';
            ctx.beginPath();
            ctx.arc(2, torsoTop + bh/2 - 6, 1.5, 0, Math.PI*2);
            ctx.fill();
        }

        // poisonous bubbles around body
        if (stats.poisonous) {
            const t = performance.now() * 0.003;
            ctx.fillStyle = 'rgba(126, 211, 33, 0.55)';
            for (let i = 0; i < 3; i++) {
                const a = t + i * 2;
                ctx.beginPath();
                ctx.arc(Math.cos(a) * 9 * baseScale, Math.sin(a) * 7 * baseScale - 4, 1.8, 0, Math.PI*2);
                ctx.fill();
            }
        }

        // ice frost flecks
        if (stats.frosty) {
            ctx.fillStyle = '#e0f4ff';
            ctx.beginPath();
            ctx.arc(-3, 2, 1.5, 0, Math.PI*2);
            ctx.arc(3, 4, 1.2, 0, Math.PI*2);
            ctx.arc(0, -1, 1, 0, Math.PI*2);
            ctx.fill();
        }

        // arms
        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.moveTo(-bw/2 + 1, -3 * baseScale);
        ctx.quadraticCurveTo(-bw/2 - 2 * baseScale, 1 + armSwing, -bw/2 - 1 * baseScale, 6 * baseScale + armSwing);
        ctx.lineTo(-bw/2 + 2 * baseScale, 5 * baseScale + armSwing);
        ctx.quadraticCurveTo(-bw/2 + 2 * baseScale, 1, -bw/2 + 3, -2 * baseScale);
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(bw/2 - 1, -3 * baseScale);
        ctx.quadraticCurveTo(bw/2 + 5 * baseScale, -1 - armSwing, bw/2 + 7 * baseScale, 2 * baseScale - armSwing);
        ctx.lineTo(bw/2 + 5 * baseScale, 5 * baseScale - armSwing);
        ctx.quadraticCurveTo(bw/2 + 2 * baseScale, 2, bw/2 - 3, -1 * baseScale);
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        // head
        ctx.fillStyle = headColor;
        const hr = (stats.bigHead ? 10 : 7) * baseScale;
        const hy = stats.bigHead ? -10 * baseScale : -11 * baseScale;
        ctx.beginPath();
        ctx.arc(0, hy, hr, 0, Math.PI*2);
        ctx.fill(); ctx.stroke();

        // crown (king)
        if (stats.crown) {
            ctx.fillStyle = '#f1c40f';
            ctx.beginPath();
            ctx.moveTo(-hr * 0.9, hy - hr * 0.6);
            ctx.lineTo(-hr * 0.6, hy - hr * 1.4);
            ctx.lineTo(-hr * 0.3, hy - hr * 0.9);
            ctx.lineTo(0, hy - hr * 1.5);
            ctx.lineTo(hr * 0.3, hy - hr * 0.9);
            ctx.lineTo(hr * 0.6, hy - hr * 1.4);
            ctx.lineTo(hr * 0.9, hy - hr * 0.6);
            ctx.closePath();
            ctx.fill(); ctx.stroke();
            // gem
            ctx.fillStyle = '#c0392b';
            ctx.beginPath();
            ctx.arc(0, hy - hr * 0.95, 1.5, 0, Math.PI*2);
            ctx.fill();
        }

        // horns (tank, king)
        if (stats.horns) {
            ctx.fillStyle = '#2c1810';
            ctx.beginPath();
            ctx.moveTo(-hr * 0.7, hy - hr * 0.5);
            ctx.lineTo(-hr * 0.55, hy - hr * 1.1);
            ctx.lineTo(-hr * 0.3, hy - hr * 0.65);
            ctx.closePath();
            ctx.fill(); ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(hr * 0.7, hy - hr * 0.5);
            ctx.lineTo(hr * 0.55, hy - hr * 1.1);
            ctx.lineTo(hr * 0.3, hy - hr * 0.65);
            ctx.closePath();
            ctx.fill(); ctx.stroke();
        }

        // hair scribble (normal/fast/poison/baby)
        if (!stats.crown && !stats.horns && !stats.skeletal) {
            ctx.beginPath();
            ctx.moveTo(-3 * baseScale, hy - hr + 1);
            ctx.lineTo(-2 * baseScale, hy - hr - 2);
            ctx.lineTo(-1 * baseScale, hy - hr + 1);
            ctx.lineTo(0,                hy - hr - 2);
            ctx.lineTo(1 * baseScale, hy - hr + 1);
            ctx.lineTo(2 * baseScale, hy - hr - 2);
            ctx.stroke();
        }

        // eyes
        if (stats.skeletal) {
            // hollow black eye sockets
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(-2.4 * baseScale, hy - hr * 0.15, 1.7 * baseScale, 0, Math.PI*2);
            ctx.arc( 2.4 * baseScale, hy - hr * 0.15, 1.7 * baseScale, 0, Math.PI*2);
            ctx.fill();
        } else if (stats.ghost) {
            // empty hollow eyes
            ctx.fillStyle = '#5a5a5a';
            ctx.beginPath();
            ctx.arc(-2.4 * baseScale, hy - hr * 0.15, 2 * baseScale, 0, Math.PI*2);
            ctx.arc( 2.4 * baseScale, hy - hr * 0.15, 2 * baseScale, 0, Math.PI*2);
            ctx.fill();
        } else {
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(-2.4 * baseScale, hy - hr * 0.15, 1.9 * baseScale, 0, Math.PI*2);
            ctx.arc( 2.4 * baseScale, hy - hr * 0.15, 1.9 * baseScale, 0, Math.PI*2);
            ctx.fill();
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(-2.4 * baseScale, hy - hr * 0.15, 1.0 * baseScale, 0, Math.PI*2);
            ctx.arc( 2.4 * baseScale, hy - hr * 0.15, 1.0 * baseScale, 0, Math.PI*2);
            ctx.fill();
        }

        // mouth (zigzag)
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = COLORS.ink;
        ctx.beginPath();
        const mY = hy + hr * 0.5;
        ctx.moveTo(-3 * baseScale, mY);
        ctx.lineTo(-1.5 * baseScale, mY - 1 * baseScale);
        ctx.lineTo( 0,               mY);
        ctx.lineTo( 1.5 * baseScale, mY - 1 * baseScale);
        ctx.lineTo( 3 * baseScale, mY);
        ctx.stroke();

        // tooth (not skeletons / ghosts)
        if (!stats.skeletal && !stats.ghost) {
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.moveTo(0.5 * baseScale, mY);
            ctx.lineTo(1.5 * baseScale, mY + 2 * baseScale);
            ctx.lineTo(2.0 * baseScale, mY);
            ctx.closePath();
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        ctx.restore();

        // hp bar
        const barW = 24 * baseScale;
        const barH = 4;
        const ratio = Math.max(0, this.health / this.maxHealth);
        const by = cy - 22 * baseScale;
        ctx.fillStyle = '#2c1810';
        ctx.fillRect(cx - barW/2, by, barW, barH);
        ctx.fillStyle = ratio > 0.5 ? '#5cb85c' : ratio > 0.25 ? '#f0ad4e' : '#d9534f';
        ctx.fillRect(cx - barW/2, by, barW * ratio, barH);
        ctx.strokeStyle = COLORS.ink;
        ctx.lineWidth = 1;
        ctx.strokeRect(cx - barW/2, by, barW, barH);

        // boss label
        if (stats.isBoss) {
            ctx.font = "bold 14px 'Bangers', cursive";
            ctx.fillStyle = '#c0392b';
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 3;
            ctx.textAlign = 'center';
            ctx.strokeText('REI ZUMBI', cx, by - 4);
            ctx.fillText('REI ZUMBI', cx, by - 4);
        }
    }
}

class Projectile {
    constructor(x, y, target, damage, type) {
        this.x = x; this.y = y;
        this.target = target;
        this.damage = damage;
        this.type = type;
        this.speed = (type === 'radar') ? 1.0 : (type === 'rocket') ? 0.55 : 0.7;
        this.dead = false;
        this.lifeMs = 0;
        this.explosion = null;
        this.chainPoints = null; // tesla
        this.lifetimeMs = null;  // tesla
    }

    update(zombies, dt, game) {
        // tesla bolt: instant damage already applied; just decay visually
        if (this.chainPoints) {
            this.lifeMs += dt;
            if (this.lifeMs >= this.lifetimeMs) this.dead = true;
            return;
        }
        if (this.explosion) {
            this.explosion.r += dt * 0.55;
            if (this.explosion.r >= this.explosion.max) this.dead = true;
            return;
        }
        this.lifeMs += dt;
        if (this.lifeMs > 3500) { this.dead = true; return; }
        if (!this.target || this.target.health <= 0) { this.dead = true; return; }

        const dx = this.target.screenX - this.x;
        const dy = this.target.screenY - this.y;
        const dist = Math.hypot(dx, dy);
        const move = this.speed * dt;
        if (dist <= move + 4) {
            this.onHit(zombies, game);
        } else {
            this.x += (dx / dist) * move;
            this.y += (dy / dist) * move;
        }
    }

    onHit(zombies, game) {
        if (this.type === 'rocket') {
            const radius = TOWER_STATS.rocket.splashRadius * CONFIG.gridSize;
            for (const z of zombies) {
                const ddx = z.screenX - this.x, ddy = z.screenY - this.y;
                if (ddx*ddx + ddy*ddy <= radius*radius) z.applyDamage(this.damage, game);
            }
            this.explosion = { r: 0, max: radius };
        } else if (this.type === 'poison') {
            // veneno quebra armadura de gelo (sem causar dano direto)
            if (ZOMBIE_STATS[this.target.type]?.freezesTowers && !this.target.iceArmorBroken) {
                this.target.iceArmorBroken = true;
                if (game) {
                    game.floatingTexts.push({
                        x: this.target.screenX, y: this.target.screenY - 18,
                        text: 'armadura quebrada!', color: '#7ed321', life: 50
                    });
                }
            }
            this.target.applyDamage(this.damage, game);
            this.target.applySlow(TOWER_STATS.poison.slowFactor, TOWER_STATS.poison.slowMs);
            this.target.applyPoison(this.damage * 0.0008, 2500);
            this.dead = true;
        } else {
            this.target.applyDamage(this.damage, game);
            this.dead = true;
        }
    }

    draw(ctx) {
        // tesla lightning chain
        if (this.chainPoints) {
            const a = 1 - (this.lifeMs / this.lifetimeMs);
            // outer glow
            ctx.strokeStyle = `rgba(126, 200, 255, ${a * 0.55})`;
            ctx.lineWidth = 8;
            ctx.lineCap = 'round';
            for (let i = 0; i < this.chainPoints.length - 1; i++) {
                drawLightning(ctx, this.chainPoints[i], this.chainPoints[i + 1]);
            }
            // mid arc
            ctx.strokeStyle = `rgba(170, 220, 255, ${a * 0.95})`;
            ctx.lineWidth = 3.5;
            for (let i = 0; i < this.chainPoints.length - 1; i++) {
                drawLightning(ctx, this.chainPoints[i], this.chainPoints[i + 1]);
            }
            // bright core
            ctx.strokeStyle = `rgba(255, 255, 255, ${a})`;
            ctx.lineWidth = 1.5;
            for (let i = 0; i < this.chainPoints.length - 1; i++) {
                drawLightning(ctx, this.chainPoints[i], this.chainPoints[i + 1]);
            }
            // sparks at hit points
            ctx.fillStyle = `rgba(255, 255, 255, ${a})`;
            for (let i = 1; i < this.chainPoints.length; i++) {
                const p = this.chainPoints[i];
                ctx.beginPath();
                ctx.arc(p.x, p.y, 4 * a, 0, Math.PI*2);
                ctx.fill();
            }
            return;
        }

        if (this.explosion) {
            const a = 1 - (this.explosion.r / this.explosion.max);
            ctx.globalAlpha = Math.max(0, a);
            ctx.fillStyle = '#e67e22';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.explosion.r, 0, Math.PI*2);
            ctx.fill();
            ctx.strokeStyle = '#92471a';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.globalAlpha = 1;
            return;
        }

        let color = '#34495e', r = 4;
        switch (this.type) {
            case 'spike':      color = '#9ca3a8'; r = 3; break;
            case 'pistol':     color = '#34495e'; r = 3; break;
            case 'machinegun': color = '#34495e'; r = 2.5; break;
            case 'poison':     color = '#7ed321'; r = 5; break;
            case 'radar':      color = '#c0392b'; r = 3; break;
            case 'robot':      color = '#27ae60'; r = 4; break;
            case 'rocket':     color = '#c0392b'; r = 5; break;
        }

        ctx.fillStyle = color;
        ctx.strokeStyle = COLORS.ink;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(this.x, this.y, r, 0, Math.PI*2);
        ctx.fill(); ctx.stroke();

        if (this.type === 'rocket') {
            ctx.fillStyle = 'rgba(241, 196, 15, 0.6)';
            ctx.beginPath();
            ctx.arc(this.x - 4, this.y, 3, 0, Math.PI*2);
            ctx.fill();
        }
    }
}

function drawLightning(ctx, p1, p2) {
    const dx = p2.x - p1.x, dy = p2.y - p1.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return;
    const segments = Math.max(3, Math.floor(dist / 14));
    const perpX = -dy / dist;
    const perpY = dx / dist;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    for (let i = 1; i < segments; i++) {
        const t = i / segments;
        const baseX = p1.x + dx * t;
        const baseY = p1.y + dy * t;
        const offset = (Math.random() - 0.5) * Math.min(14, dist * 0.18);
        ctx.lineTo(baseX + perpX * offset, baseY + perpY * offset);
    }
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
}

// Choose cols/rows so the canvas's aspect matches the available frame area.
// gridSize stays fixed at 50 (so all sprite art keeps its pixel size); CSS
// scaling via fitCanvas handles the final display size.
function configureLayout() {
    const container = document.getElementById('game-container');
    const hud = document.getElementById('hud');
    const shop = document.getElementById('shop');
    const hint = document.getElementById('hint');

    container.getBoundingClientRect(); // force layout

    const cW = container.clientWidth;
    const cH = container.clientHeight;
    const hintH = (hint && getComputedStyle(hint).display !== 'none') ? hint.offsetHeight : 0;
    const uiH = hud.offsetHeight + shop.offsetHeight + hintH;

    const frameW = cW;
    const frameH = Math.max(140, cH - uiH);
    const frameAspect = frameW / frameH;

    const rows = Math.max(8, Math.min(12, Math.round(frameH / 55)));
    const cols = Math.max(12, Math.min(28, Math.round(rows * frameAspect)));

    CONFIG.cols = cols;
    CONFIG.rows = rows;
    // CONFIG.gridSize stays at 50
}

// canvas-wrap fills canvas-frame responsively via CSS.
// The canvas element scales to fill its container.
function fitCanvas() {
    // No-op: CSS handles responsive sizing now.
}

function renderShopThumbnails() {
    document.querySelectorAll('.shop-item').forEach(el => {
        const type = el.dataset.type;
        const canvas = el.querySelector('canvas.icon');
        if (!canvas || !type || !TOWER_STATS[type]) return;
        const ctx = canvas.getContext('2d');
        const tower = new Tower(0, 0, type);
        tower.angle = -Math.PI / 7;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        tower.draw(ctx);
    });
}

configureLayout();
new Game();
renderShopThumbnails();
setInterval(renderShopThumbnails, 80);
fitCanvas();
window.addEventListener('resize', fitCanvas);
window.addEventListener('orientationchange', () => {
    fitCanvas();
    setTimeout(fitCanvas, 200);
});
setTimeout(fitCanvas, 80);
setTimeout(fitCanvas, 400);
setTimeout(fitCanvas, 400);
