/**
 * Game (versão 3D) — orquestrador.
 *
 * Toda a lógica de jogo é IDÊNTICA ao Game.js 2D: grid, A*, waves, economia,
 * upgrades/hyper/golden, recordes, música, velocidade, pause. Mudanças:
 *  - renderização via World3D (three.js) em vez de canvas 2D;
 *  - input de mouse/toque faz raycast no plano do chão para descobrir a célula;
 *  - textos flutuantes viram DOM sobreposto (projetado do 3D para a tela).
 * Os números e regras não mudam.
 */
class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.world = new World3D(this.canvas);
        this.camera3d = new Camera3D(this.world.camera, this.canvas);
        FX.init(this.world.fxLayer);
        window.game = this;

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
        this.end = { x: CONFIG.cols - 1, y: Math.floor(CONFIG.rows / 2) };

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

        this._groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        this._raycaster = new THREE.Raycaster();
        this._ndc = new THREE.Vector2();
        this._hit = new THREE.Vector3();

        this.initGrid();
        this.initEventListeners();
        this.initHamburgerMenu();
        this.initAudio();
        this.updatePath();
        this.updateHUD();
        this.buildHoverFx();

        // enquadra o tabuleiro na câmera (ajusta aspect/raio para a tela atual)
        this.world.resize();
        this.camera3d.fit(this.world.boardW, this.world.boardH);

        this.loop = this.loop.bind(this);
        this.initStartScreen();
    }

    // ---------- layout ----------
    layout() {
        configureLayout();
        this.start = { x: 0, y: Math.floor(CONFIG.rows / 2) };
        this.end = { x: CONFIG.cols - 1, y: Math.floor(CONFIG.rows / 2) };
        this.initGrid();
        this.world.layout();
        this.updatePath();
    }

    relayout() {
        if (this.started) { this.world.resize(); this.camera3d.fit(this.world.boardW, this.world.boardH); return; }
        const prevCols = CONFIG.cols, prevRows = CONFIG.rows;
        configureLayout();
        if (CONFIG.cols !== prevCols || CONFIG.rows !== prevRows) {
            this.start = { x: 0, y: Math.floor(CONFIG.rows / 2) };
            this.end = { x: CONFIG.cols - 1, y: Math.floor(CONFIG.rows / 2) };
            this.initGrid();
            this.world.layout();
            this.updatePath();
        } else {
            this.world.resize();
            this.camera3d.fit(this.world.boardW, this.world.boardH);
        }
    }

    // ---------- FX de hover ----------
    buildHoverFx() {
        this.hoverQuad = mesh(GeomFactory.plane(1, 1), new THREE.MeshBasicMaterial({ color: 0x50a050, transparent: true, opacity: 0.3, depthWrite: false }));
        this.hoverQuad.rotation.x = -Math.PI / 2;
        this.hoverQuad.position.y = 0.03;
        this.hoverQuad.visible = false;
        this.hoverQuad.renderOrder = 4;
        this.world.fxLayer.add(this.hoverQuad);

        this.rangeRing = mesh(GeomFactory.tor(1, 0.02, 40, 8), new THREE.MeshBasicMaterial({ color: 0x5b2f12, transparent: true, opacity: 0.5, depthWrite: false }));
        this.rangeRing.rotation.x = -Math.PI / 2;
        this.rangeRing.position.y = 0.04;
        this.rangeRing.visible = false;
        this.rangeRing.renderOrder = 4;
        this.world.fxLayer.add(this.rangeRing);
    }

    // ---------- audio (idêntico ao 2D) ----------
    initAudio() {
        this.bgMusic = document.getElementById('bg-music');
        this.bossMusic = document.getElementById('boss-music');
        this.bgMusic.volume = 0.4;
        this.bossMusic.volume = 0.5;
        this.muted = localStorage.getItem('zombieDefenderMuted') === '1';
        this.bgMusic.muted = this.muted;
        this.bossMusic.muted = this.muted;
        if (window.SFX) SFX.setMuted(this.muted);
        this.musicEnabled = false;
        this.currentTrack = null;
        const muteBtn = document.getElementById('mute-btn');
        const refreshMuteBtn = () => {
            muteBtn.textContent = this.muted ? '🔇' : '🔊';
            muteBtn.classList.toggle('muted', this.muted);
        };
        refreshMuteBtn();
        muteBtn.addEventListener('click', () => {
            this.muted = !this.muted;
            this.bgMusic.muted = this.muted;
            this.bossMusic.muted = this.muted;
            if (window.SFX) SFX.setMuted(this.muted);
            localStorage.setItem('zombieDefenderMuted', this.muted ? '1' : '0');
            refreshMuteBtn();
        });

        const fsBtn = document.getElementById('fullscreen-btn');
        let _simFS = false;
        const _isFS = () => !!(document.fullscreenElement || document.webkitFullscreenElement || _simFS);
        const _updateFsBtn = () => {
            const on = _isFS();
            fsBtn.textContent = on ? '✕' : '⛶';
            fsBtn.title = on ? 'Sair da tela cheia' : 'Tela cheia';
        };
        const _activateSim = () => {
            _simFS = true;
            document.getElementById('game-container').classList.add('fake-fullscreen');
            _updateFsBtn();
            setTimeout(() => this.relayout(), 60);
        };
        const _deactivateSim = () => {
            _simFS = false;
            document.getElementById('game-container').classList.remove('fake-fullscreen');
            _updateFsBtn();
            setTimeout(() => this.relayout(), 60);
        };
        const _enterFS = () => {
            const el = document.documentElement;
            const fn = el.requestFullscreen || el.webkitRequestFullscreen;
            if (fn) fn.call(el).catch(_activateSim); else _activateSim();
        };
        const _exitFS = () => {
            if (document.fullscreenElement || document.webkitFullscreenElement) {
                const fn = document.exitFullscreen || document.webkitExitFullscreen;
                if (fn) fn.call(document).catch(() => {});
            }
            if (_simFS) _deactivateSim();
        };
        fsBtn.addEventListener('click', () => _isFS() ? _exitFS() : _enterFS());
        document.addEventListener('fullscreenchange', () => { _updateFsBtn(); setTimeout(() => this.relayout(), 80); });
        document.addEventListener('webkitfullscreenchange', () => { _updateFsBtn(); setTimeout(() => this.relayout(), 80); });
        _updateFsBtn();
    }

    primeAudio() {
        if (window.SFX) SFX.unlock();
        if (this._audioPrimed) return;
        this._audioPrimed = true;
        const prime = (a) => {
            if (!a) return;
            const wasMuted = a.muted;
            a.muted = true;
            const p = a.play();
            if (p && typeof p.then === 'function') {
                p.then(() => { a.pause(); a.currentTime = 0; a.muted = wasMuted; })
                 .catch(() => { a.muted = wasMuted; this._audioPrimed = false; });
            }
        };
        prime(this.bgMusic);
        prime(this.bossMusic);
    }
    playMusic() { this.musicEnabled = true; this.updateMusicTrack(); }
    stopMusic() {
        this.musicEnabled = false;
        if (this.bgMusic) { this.bgMusic.pause(); this.bgMusic.currentTime = 0; }
        if (this.bossMusic) { this.bossMusic.pause(); this.bossMusic.currentTime = 0; }
        this.currentTrack = null;
    }
    setSpeed(speed) { this.speedMultiplier = speed; this.updateMusicTrack(); }
    armAudioUnlockListener() {
        if (this._audioUnlockArmed) return;
        this._audioUnlockArmed = true;
        const handler = () => {
            this._audioUnlockArmed = false;
            this._audioPrimed = false;
            this.primeAudio();
            this.updateMusicTrack();
            document.removeEventListener('pointerdown', handler);
            document.removeEventListener('keydown', handler);
            document.removeEventListener('touchstart', handler);
        };
        document.addEventListener('pointerdown', handler, { once: true });
        document.addEventListener('keydown', handler, { once: true });
        document.addEventListener('touchstart', handler, { once: true });
    }
    tryPlay(audio) {
        const p = audio.play();
        if (p && typeof p.catch === 'function') p.catch(() => this.armAudioUnlockListener());
    }
    updateMusicTrack() {
        if (!this.bgMusic || !this.bossMusic) return;
        if (!this.musicEnabled || this.gameOver || this.speedMultiplier === 0) {
            if (!this.bgMusic.paused) this.bgMusic.pause();
            if (!this.bossMusic.paused) this.bossMusic.pause();
            return;
        }
        let bossAlive = false;
        for (const z of this.zombies) {
            if (z.health > 0 && ZOMBIE_STATS[z.type]?.isBoss) { bossAlive = true; break; }
        }
        const desired = bossAlive ? 'boss' : 'normal';
        if (desired !== this.currentTrack) {
            if (desired === 'boss') {
                this.bgMusic.pause();
                this.bossMusic.currentTime = 0;
                this.tryPlay(this.bossMusic);
            } else {
                this.bossMusic.pause();
                this.tryPlay(this.bgMusic);
            }
            this.currentTrack = desired;
        } else if (this.currentTrack) {
            const track = this.currentTrack === 'boss' ? this.bossMusic : this.bgMusic;
            if (track.paused) this.tryPlay(track);
        }
    }

    initGrid() {
        this.grid = [];
        for (let x = 0; x < CONFIG.cols; x++) {
            this.grid[x] = [];
            for (let y = 0; y < CONFIG.rows; y++) this.grid[x][y] = 0;
        }
    }

    // ---------- input ----------
    // Pega a célula da grade a partir de um evento de ponteiro (mouse/toque),
    // fazendo raycast do ponto da tela até o plano do chão (y=0).
    cellFromEvent(e) {
        const rect = this.canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;
        this._ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this._ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        this._raycaster.setFromCamera(this._ndc, this.world.camera);
        const hit = this._raycaster.ray.intersectPlane(this._groundPlane, this._hit);
        if (!hit) return null;
        // mundo -> px lógico
        const px = (this._hit.x + Coords.offX) / CONFIG.worldScale;
        const py = (this._hit.z + Coords.offZ) / CONFIG.worldScale;
        const x = Math.floor(px / CONFIG.gridSize);
        const y = Math.floor(py / CONFIG.gridSize);
        return { x, y };
    }

    inRange(c) { return c && c.x >= 0 && c.x < CONFIG.cols && c.y >= 0 && c.y < CONFIG.rows; }

    initEventListeners() {
        // --- loja (seleção) ---
        document.querySelectorAll('.shop-item').forEach(item => {
            item.addEventListener('click', () => {
                const type = item.dataset.type;
                if (this.money < TOWER_STATS[type].cost) return;
                const wasSelected = (this.selectedTowerType === type);
                document.querySelectorAll('.shop-item').forEach(i => i.classList.remove('selected'));
                if (wasSelected) this.selectedTowerType = null;
                else { item.classList.add('selected'); this.selectedTowerType = type; }
            });
        });

        document.querySelectorAll('#speed-control button').forEach(btn => {
            btn.addEventListener('click', () => {
                const speed = parseInt(btn.dataset.speed, 10);
                this.setSpeed(speed);
                document.querySelectorAll('#speed-control button').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // --- canvas: hover + clique/tap ---
        let draggingFromShop = false;
        this.canvas.addEventListener('pointermove', (e) => {
            if (e.pointerType === 'mouse') {
                this.hoverCell = this.cellFromEvent(e);
            }
        });
        this.canvas.addEventListener('pointerleave', () => { if (!draggingFromShop) this.hoverCell = null; });

        const commit = (cell) => {
            this.hoverCell = cell;
            this.commitTouchPlacement();
            this.hoverCell = null;
        };

        this.canvas.addEventListener('pointerdown', (e) => {
            if (e.button === 2 || e.altKey) return;      // orbit camera, não posicionar
            this.hoverCell = this.cellFromEvent(e);
        });
        this.canvas.addEventListener('pointerup', (e) => {
            if (e.button === 2 || e.altKey) return;
            if (this.gameOver) return;
            const cell = this.cellFromEvent(e);
            commit(cell);
            this.hoverCell = (e.pointerType === 'mouse') ? this.hoverCell : null;
        });

        // --- arrastar da loja para o campo (mobile/desktop) ---
        const overCanvas = (clientX, clientY) => {
            const r = this.canvas.getBoundingClientRect();
            return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
        };
        document.querySelectorAll('.shop-item').forEach(item => {
            let dragArmed = false, dragging = false, dragType = null;
            item.addEventListener('pointerdown', (e) => {
                dragging = false; dragArmed = false;
                const type = item.dataset.type;
                if (this.money < TOWER_STATS[type].cost) return;
                dragArmed = true; dragType = type;
            }, { passive: true });
            item.addEventListener('pointermove', (e) => {
                if (!dragArmed) return;
                if (overCanvas(e.clientX, e.clientY)) {
                    if (!dragging) {
                        dragging = true; draggingFromShop = true;
                        this.selectedTowerType = dragType;
                        document.querySelectorAll('.shop-item').forEach(i => i.classList.remove('selected'));
                        item.classList.add('selected');
                        this.hideTowerMenu();
                    }
                    this.hoverCell = this.cellFromEvent(e);
                } else if (dragging) {
                    this.hoverCell = null;
                }
            }, { passive: false });
            const endDrag = (e) => {
                dragArmed = false;
                if (!dragging) return;
                dragging = false; draggingFromShop = false;
                const cell = overCanvas(e.clientX, e.clientY) ? this.cellFromEvent(e) : null;
                commit(cell);
            };
            item.addEventListener('pointerup', endDrag);
            item.addEventListener('pointercancel', () => {
                dragArmed = false;
                if (dragging) { dragging = false; draggingFromShop = false; this.hoverCell = null; }
            });
        });

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.selectedTowerType = null;
                document.querySelectorAll('.shop-item').forEach(i => i.classList.remove('selected'));
                this.hideTowerMenu();
            }
            if (e.key >= '0' && e.key <= '4') {
                const speed = parseInt(e.key, 10);
                this.setSpeed(speed);
                document.querySelectorAll('#speed-control button').forEach(b => {
                    b.classList.toggle('active', parseInt(b.dataset.speed, 10) === speed);
                });
            }
        });
    }

    commitTouchPlacement() {
        const cell = this.hoverCell;
        if (this.gameOver || !cell || !this.inRange(cell)) { this.hoverCell = null; return; }
        const { x, y } = cell;
        const existing = this.findTowerAt(x, y);
        if (existing) {
            if (this.selectedTowerType && this.selectedTowerType === existing.type
                && existing.goldenStacks < 2
                && this.money >= TOWER_STATS[this.selectedTowerType].cost) {
                this.mergeTower(existing, this.selectedTowerType);
            } else {
                this.toggleTowerMenu(existing);
            }
            return;
        }
        this.hideTowerMenu();
        if (!this.selectedTowerType) return;
        const cost = TOWER_STATS[this.selectedTowerType].cost;
        if (this.money < cost) { this.flashFloating(x, y, 'Sem $!', '#c0392b'); return; }
        if (!this.canPlaceTower(x, y)) { this.flashFloating(x, y, 'X', '#c0392b'); return; }
        this.placeTower(x, y, this.selectedTowerType);
    }

    // ---------- start screen ----------
    initStartScreen() {
        const startScreen = document.getElementById('start-screen');
        document.getElementById('btn-start').addEventListener('click', () => {
            this.primeAudio();
            this.relayout();
            this.started = true;
            startScreen.classList.add('fade-out');
            setTimeout(() => { startScreen.style.display = 'none'; }, 800);
            this.doCountdown();
        });
        document.getElementById('btn-scores').addEventListener('click', () => this.showHighScores());
        document.getElementById('btn-help').addEventListener('click', () => document.getElementById('help-overlay').classList.add('show'));
        document.getElementById('help-close').addEventListener('click', () => document.getElementById('help-overlay').classList.remove('show'));
        document.getElementById('upgrade-all-btn').addEventListener('click', () => this.upgradeAllTowers());
    }

    doCountdown() {
        const overlay = document.getElementById('countdown-overlay');
        const countEl = document.getElementById('countdown');
        let count = 3;
        countEl.textContent = count;
        overlay.classList.add('show');
        const tick = () => {
            count--;
            if (count > 0) { countEl.textContent = count; setTimeout(tick, 1000); }
            else {
                countEl.textContent = 'GO!';
                setTimeout(() => {
                    overlay.classList.remove('show');
                    this.startNextRound(this.gameTime);
                    this.playMusic();
                    requestAnimationFrame(this.loop);
                }, 600);
            }
        };
        setTimeout(tick, 1000);
    }

    // ---------- hamburger + recordes ----------
    initHamburgerMenu() {
        const btn = document.getElementById('hamburger-btn');
        const menu = document.getElementById('hamburger-menu');
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.classList.toggle('show', !menu.classList.contains('show'));
        });
        document.getElementById('hm-restart').addEventListener('click', () => { this.closeHamburgerMenu(); location.reload(); });
        document.getElementById('hm-scores').addEventListener('click', () => this.showHighScores());
        document.getElementById('hm-help').addEventListener('click', () => {
            document.getElementById('help-overlay').classList.add('show');
            this.closeHamburgerMenu();
        });
        document.addEventListener('click', (e) => {
            if (!menu.contains(e.target) && e.target !== btn) this.closeHamburgerMenu();
        });
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { this.closeHamburgerMenu(); this.hideHighScores(); }
        });
        document.getElementById('hs-close').addEventListener('click', () => this.hideHighScores());
        document.getElementById('hs-clear').addEventListener('click', () => { this.clearHighScores(); this.renderHighScores(); });
    }
    closeHamburgerMenu() { document.getElementById('hamburger-menu').classList.remove('show'); }

    findTowerAt(x, y) { return this.towers.find(t => t.x === x && t.y === y) || null; }

    canPlaceTower(x, y, type) {
        const towerType = type || this.selectedTowerType;
        if (x < 0 || x >= CONFIG.cols || y < 0 || y >= CONFIG.rows) return false;
        if (x === this.start.x && y === this.start.y) return false;
        if (x === this.end.x && y === this.end.y) return false;
        if (this.grid[x][y] !== 0) return false;
        if (towerType === 'laser') return true;
        this.grid[x][y] = 1;
        const path = this.findPath();
        let zombiesOk = true;
        if (path) {
            for (const z of this.zombies) {
                if (ZOMBIE_STATS[z.type].flying) continue;
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
        this.grid[x][y] = type === 'laser' ? 2 : 1;
        const t = new Tower(x, y, type);
        this.towers.push(t);
        this.updatePath();
        for (const z of this.zombies) z.recalcPath(this);
        this.updateHUD();
        if (window.SFX) SFX.play('build');
    }

    mergeTower(tower, type) {
        if (tower.goldenStacks >= 2) { this.flashFloating(tower.x, tower.y, 'MAX ⭐', '#f1c40f'); return; }
        const cost = TOWER_STATS[type].cost;
        if (this.money < cost) { this.flashFloating(tower.x, tower.y, 'Sem $!', '#c0392b'); return; }
        this.money -= cost;
        tower.golden = true;
        tower.goldenMult *= 2;
        tower.goldenStacks++;
        tower.totalInvested += cost;
        tower.applyLevel();
        tower.refreshIndicators();
        this.floatingTexts.push({
            x: tower.x * CONFIG.gridSize + CONFIG.gridSize / 2,
            y: tower.y * CONFIG.gridSize + CONFIG.gridSize / 2,
            text: 'DOURADA! x2 ⭐', color: '#f1c40f', life: 90
        });
        this.showTowerMenu(tower);
        this.updateHUD();
    }

    sellTower(tower) {
        const refund = Math.floor(tower.totalInvested * CONFIG.sellRefundFactor);
        this.money += refund;
        this.grid[tower.x][tower.y] = 0;
        tower.dispose();
        this.towers = this.towers.filter(t => t !== tower);
        this.updatePath();
        for (const z of this.zombies) z.recalcPath(this);
        this.floatingTexts.push({
            x: tower.x * CONFIG.gridSize + CONFIG.gridSize / 2,
            y: tower.y * CONFIG.gridSize + CONFIG.gridSize / 2,
            text: `+$${refund}`, color: '#5a4010', life: 70
        });
        this.hideTowerMenu();
        this.updateHUD();
        if (window.SFX) SFX.play('sell');
    }

    upgradeTower(tower) {
        const maxLevel = getMaxLevel(this.round);
        if (tower.level >= maxLevel) return;
        const cost = tower.getUpgradeCost(maxLevel);
        if (this.money < cost) { this.flashFloating(tower.x, tower.y, 'Sem $!', '#c0392b'); return; }
        this.money -= cost;
        tower.upgrade(cost, maxLevel);
        tower.refreshIndicators();
        this.floatingTexts.push({
            x: tower.x * CONFIG.gridSize + CONFIG.gridSize / 2,
            y: tower.y * CONFIG.gridSize + CONFIG.gridSize / 2,
            text: `Nível ${tower.level + 1}!`, color: '#27ae60', life: 70
        });
        this.renderTowerMenu();
        this.updateHUD();
        if (window.SFX) SFX.play('upgrade');
    }

    hyperTower(tower) {
        const maxLevel = getMaxLevel(this.round);
        if (tower.level < maxLevel || tower.hyper) return;
        if (this.money < CONFIG.hyperCost) { this.flashFloating(tower.x, tower.y, 'Sem $!', '#c0392b'); return; }
        this.money -= CONFIG.hyperCost;
        tower.hyper = true;
        tower.applyLevel();
        tower.refreshIndicators();
        this.floatingTexts.push({
            x: tower.x * CONFIG.gridSize + CONFIG.gridSize / 2,
            y: tower.y * CONFIG.gridSize + CONFIG.gridSize / 2,
            text: 'HYPER! ⚡', color: '#8e44ad', life: 90
        });
        this.renderTowerMenu();
        this.updateHUD();
        if (window.SFX) SFX.play('upgrade');
    }

    upgradeAllTowers() {
        if (!this.towers.length) return;
        const maxLevel = getMaxLevel(this.round);
        const upgraded = new Set();
        let anyUpgraded = true;
        while (anyUpgraded) {
            anyUpgraded = false;
            for (const tower of this.towers) {
                if (tower.level >= maxLevel) continue;
                const cost = tower.getUpgradeCost(maxLevel);
                if (Number.isFinite(cost) && this.money >= cost) {
                    this.money -= cost;
                    tower.upgrade(cost, maxLevel);
                    tower.refreshIndicators();
                    upgraded.add(tower);
                    anyUpgraded = true;
                }
            }
        }
        if (upgraded.size) {
            for (const tower of upgraded) {
                this.floatingTexts.push({
                    x: tower.x * CONFIG.gridSize + CONFIG.gridSize / 2,
                    y: tower.y * CONFIG.gridSize + CONFIG.gridSize / 2,
                    text: `Nível ${tower.level + 1}!`, color: '#27ae60', life: 70
                });
            }
        } else {
            const allMax = this.towers.every(t => t.level >= maxLevel);
            this.flashFloating(this.end.x, 0, allMax ? 'Tudo no máximo!' : 'Sem $!', '#c0392b');
        }
        this.renderTowerMenu();
        this.updateHUD();
    }

    toggleTowerMenu(tower) {
        if (this.selectedTower === tower) this.hideTowerMenu();
        else this.showTowerMenu(tower);
    }

    showTowerMenu(tower) {
        this.selectedTower = tower;
        this.selectedTowerType = null;
        document.querySelectorAll('.shop-item').forEach(i => i.classList.remove('selected'));
        const menu = document.getElementById('tower-menu');
        this.renderTowerMenu();
        menu.style.left = '50%';
        menu.style.top = '50%';
        menu.classList.add('show');
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
        const maxLevel = getMaxLevel(this.round);
        const isMax = t.level >= maxLevel;
        const upgradeCost = isMax ? 0 : t.getUpgradeCost(maxLevel);
        const refund = Math.floor(t.totalInvested * CONFIG.sellRefundFactor);

        const stars = [];
        for (let i = 0; i < maxLevel + 1; i++) stars.push(`<span class="${i <= t.level ? '' : 'empty'}">★</span>`);

        const next = isMax ? null : t.previewUpgrade(maxLevel);
        const dmg = Math.round(t.damage);
        const isMobile = !!stats.mobile;
        const range = isMobile ? '∞' : (t.range / CONFIG.gridSize).toFixed(1);
        const nextRange = next ? (isMobile ? '∞' : (next.range / CONFIG.gridSize).toFixed(1)) : undefined;
        const dps = (t.damage / (t.fireRate / 1000)).toFixed(1);

        const stat = (label, cur, nxt) => {
            const same = nxt === undefined || nxt === cur;
            return `${label}: <strong>${cur}</strong>` + (same ? '' : ` <span class="arrow">→ ${nxt}</span>`);
        };

        const statsHtml = t.isDrone
            ? `Não causa dano<br>Captura voadores 1 por vez<br>Leva o voador de volta ao início`
            : `${stat('Dano', dmg, next ? Math.round(next.damage) : undefined)}<br>` +
              `${stat('Alcance', range, nextRange)}<br>` +
              `${stat('DPS', dps, next ? (next.damage / (next.fireRate / 1000)).toFixed(1) : undefined)}`;

        let rightSlice;
        if (isMax) {
            rightSlice = t.hyper
                ? `<div class="tm-slice tm-hyper" data-disabled="1">HYPER<br><strong>⚡ ATIVO ⚡</strong></div>`
                : `<div class="tm-slice tm-hyper" data-action="hyper" ${this.money < CONFIG.hyperCost ? 'data-disabled="1"' : ''}>HYPER ⚡x10<br><strong>$${CONFIG.hyperCost}</strong></div>`;
        } else {
            rightSlice = `<div class="tm-slice tm-upgrade" data-action="upgrade" ${this.money < upgradeCost ? 'data-disabled="1"' : ''}>Melhorar<br><strong>$${upgradeCost}</strong></div>`;
        }

        menu.innerHTML = `
            <div class="tm-top-slice">
                <div class="tm-header">${stats.label}${t.goldenStacks ? ' ' + '⭐'.repeat(t.goldenStacks) : ''}${t.hyper ? ' ⚡' : ''}</div>
                <div class="tm-level">Nível ${t.level + 1}/${maxLevel + 1}<span class="tm-stars">${stars.join('')}</span></div>
                <div class="tm-stats">${statsHtml}</div>
            </div>
            <div class="tm-bottom-slices">
                <div class="tm-slice tm-sell" data-action="sell">Vender<br><strong>+$${refund}</strong></div>
                ${rightSlice}
            </div>`;

        const sellSlice = menu.querySelector('[data-action="sell"]');
        const upgradeSlice = menu.querySelector('[data-action="upgrade"]');
        const hyperSlice = menu.querySelector('[data-action="hyper"]');
        if (sellSlice) sellSlice.addEventListener('click', (e) => { e.stopPropagation(); if (sellSlice.dataset.disabled) return; this.sellTower(t); });
        if (upgradeSlice) upgradeSlice.addEventListener('click', (e) => { e.stopPropagation(); if (upgradeSlice.dataset.disabled) return; this.upgradeTower(t); });
        if (hyperSlice) hyperSlice.addEventListener('click', (e) => { e.stopPropagation(); if (hyperSlice.dataset.disabled) return; this.hyperTower(t); });
        menu.querySelector('.tm-top-slice').addEventListener('click', (e) => { e.stopPropagation(); this.hideTowerMenu(); });
    }

    updateHUD() {
        if (!Number.isFinite(this.money)) this.money = 0;
        document.getElementById('money').innerText = this.money;
        document.getElementById('health').innerText = Math.max(0, this.health);
        document.getElementById('score').innerText = this.score;
        document.getElementById('round').innerText = this.round;
        document.querySelectorAll('.shop-item').forEach(item => {
            const stats = TOWER_STATS[item.dataset.type];
            if (stats.unlockRound && this.round < stats.unlockRound) { item.style.display = 'none'; return; }
            item.style.display = '';
            item.classList.toggle('disabled', this.money < stats.cost);
        });
    }

    // ---------- A* (idêntico) ----------
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
        const dirs = [{ x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 0 }, { x: -1, y: 0 }];
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
    updatePath() { this.currentPath = this.findPath() || []; }

    // ---------- waves (idêntico) ----------
    startNextRound(time) {
        this.round++;
        this.zombiesToSpawn = 4 + Math.floor(this.round * 0.8);
        this.spawnInterval = Math.max(360, 1100 - this.round * 28);
        this.bossPending = (this.round >= ZOMBIE_STATS.king.unlockRound && this.round % 5 === 0);
        this.waveState = 'spawning';
        if (this.round === 1) this.lastSpawnTime = time - this.spawnInterval + 3000;
        else this.lastSpawnTime = time - this.spawnInterval;
        this.showRoundBanner();
        this.updateHUD();
        if (window.SFX) SFX.play('round');
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
            if (stats.weight > 0 && r >= stats.unlockRound) pool.push([type, stats.weight]);
        }
        let total = 0;
        for (const [, w] of pool) total += w;
        let roll = Math.random() * total;
        for (const [type, w] of pool) { if (roll < w) return type; roll -= w; }
        return 'normal';
    }
    spawnZombie() {
        if (this.bossPending && this.zombiesToSpawn === 1) {
            this.bossPending = false;
            const z = new Zombie(this.currentPath, this.round, 'king');
            this.zombies.push(z);
            return 1;
        }
        const type = this.pickZombieType();
        if (type === 'flying') {
            const groupSize = Math.min(8, 2 + Math.floor((this.round - 3) * 0.5));
            for (let i = 0; i < groupSize; i++) {
                const z = new Zombie(this.currentPath, this.round, 'flying');
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
            if (time - this.waveTimer >= CONFIG.pauseBetweenRounds) this.startNextRound(time);
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
        const mh = z.maxHealth || 0;
        const reward = Math.max(0, Math.floor((4 + Math.floor(mh / 14)) * 0.7));
        this.money += reward;
        this.score += mh;
        this.floatingTexts.push({ x: z.screenX, y: z.screenY, text: `+$${reward}`, color: '#5a4010', life: 60 });
        this.updateHUD();
        if (window.SFX) SFX.play('coin');
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
        this.stopMusic();
        this.saveHighScore();
        const el = document.getElementById('game-over');
        el.innerHTML = `<h1>Game Over</h1><p>Round atingido: ${this.round}</p><p>Pontuação: ${this.score}</p><button onclick="location.reload()">Jogar Novamente</button>`;
        el.classList.add('show');
    }

    saveHighScore() {
        const scores = this.getHighScores();
        const entry = { round: this.round, score: this.score, date: new Date().toLocaleDateString('pt-BR') };
        scores.push(entry);
        scores.sort((a, b) => b.score - a.score);
        localStorage.setItem('zombieDefenderScores', JSON.stringify(scores.slice(0, 10)));
    }
    getHighScores() {
        try { return JSON.parse(localStorage.getItem('zombieDefenderScores')) || []; } catch { return []; }
    }
    clearHighScores() { localStorage.removeItem('zombieDefenderScores'); }
    renderHighScores() {
        const scores = this.getHighScores();
        const listEl = document.getElementById('hs-list');
        if (scores.length === 0) { listEl.innerHTML = '<div class="hs-empty">Nenhum recorde ainda!</div>'; return; }
        listEl.innerHTML = scores.map((s, i) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
            return `<div class="hs-entry"><span class="hs-rank">${medal}</span><span class="hs-score">${s.score}</span><span class="hs-detail">R${s.round} · ${s.date}</span></div>`;
        }).join('');
    }
    showHighScores() { this.renderHighScores(); document.getElementById('high-scores-overlay').classList.add('show'); this.closeHamburgerMenu(); }
    hideHighScores() { document.getElementById('high-scores-overlay').classList.remove('show'); }

    // ---------- loop ----------
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
                if (z.reachedEnd) { this.handleZombieReachedEnd(z); z.dispose(); this.zombies.splice(i, 1); }
                else if (z.health <= 0 && !z.dying) { this.handleZombieKilled(z); z.die(); }
                else if (z.dying && z.deathTimer >= 450) { z.dispose(); this.zombies.splice(i, 1); }
            }

            for (let i = this.projectiles.length - 1; i >= 0; i--) {
                const p = this.projectiles[i];
                p.update(this.zombies, dt, this);
                if (p.dead) { p.dispose(); this.projectiles.splice(i, 1); }
            }

            this.updateMusicTrack();
        }

        this.drawHover();
        this.drawFloating();
        this.updatePauseOverlay();
        FX.update(realDt);

        this.world.render();
        requestAnimationFrame(this.loop);
    }

    // ---------- hover 3D ----------
    drawHover() {
        const hq = this.hoverQuad, rr = this.rangeRing;
        const cell = this.hoverCell;
        if (!cell || !this.inRange(cell)) { hq.visible = false; rr.visible = false; return; }
        const wx = Coords.cellCX(cell.x), wz = Coords.cellCY(cell.y);
        hq.position.set(wx, 0.03, wz);

        const existing = this.findTowerAt(cell.x, cell.y);
        if (existing) {
            hq.material.color.set(0xf1c40f);
            hq.visible = true;
            if (existing.range > 0 && !existing.mobile) {
                rr.visible = true;
                rr.position.set(wx, 0.04, wz);
                rr.scale.setScalar(Coords.len(existing.range));
            } else rr.visible = false;
            return;
        }
        if (!this.selectedTowerType) { hq.visible = false; rr.visible = false; return; }
        const can = this.canPlaceTower(cell.x, cell.y) && this.money >= TOWER_STATS[this.selectedTowerType].cost;
        hq.material.color.set(can ? 0x50a050 : 0xc0392b);
        hq.visible = true;
        if (can && !TOWER_STATS[this.selectedTowerType].mobile) {
            rr.visible = true;
            rr.position.set(wx, 0.04, wz);
            rr.scale.setScalar(Coords.len(TOWER_STATS[this.selectedTowerType].range * CONFIG.gridSize));
        } else rr.visible = false;
    }

    // ---------- textos flutuantes (DOM projetado) ----------
    drawFloating() {
        const layer = this.floatLayer || document.getElementById('float-layer');
        if (!layer) return;
        this.floatLayer = layer;
        const rect = this.canvas.getBoundingClientRect();
        // reaproveita/recria pool
        if (!this._floatPool) this._floatPool = [];
        const v = new THREE.Vector3();
        const used = [];
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const f = this.floatingTexts[i];
            f.life--;
            f.wx = Coords.px(f.x); f.wz = Coords.py(f.y); f.wy = (f.wy == null ? 1.1 : f.wy);
            f.wy += 0.0025;
            if (f.life <= 0) { this.floatingTexts.splice(i, 1); continue; }
            v.set(f.wx, f.wy, f.wz).project(this.world.camera);
            if (v.z > 1) continue; // atrás da câmera
            const sx = (v.x * 0.5 + 0.5) * rect.width;
            const sy = (-v.y * 0.5 + 0.5) * rect.height;
            const el = this._floatPool[used.length] || this._makeFloatEl(layer);
            el.textContent = f.text;
            el.style.color = f.color;
            el.style.opacity = Math.max(0, f.life / 60);
            el.style.transform = `translate(-50%,-50%) translate(${sx}px,${sy}px)`;
            el.style.display = 'block';
            used.push(el);
        }
        // esconde o resto do pool
        for (let i = used.length; i < this._floatPool.length; i++) this._floatPool[i].style.display = 'none';
    }
    _makeFloatEl(layer) {
        const el = document.createElement('div');
        el.className = 'float-text';
        layer.appendChild(el);
        this._floatPool.push(el);
        return el;
    }

    updatePauseOverlay() {
        const ov = document.getElementById('pause-overlay');
        if (!ov) return;
        if (this.speedMultiplier === 0) {
            ov.classList.add('show');
            ov.textContent = 'PAUSADO';
        } else {
            ov.classList.remove('show');
            const sp = document.getElementById('speed-badge');
            if (sp) {
                if (this.speedMultiplier > 1) { sp.textContent = `x${this.speedMultiplier}`; sp.style.display = ''; }
                else sp.style.display = 'none';
            }
        }
    }
}
