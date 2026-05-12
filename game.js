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
    upgradeCostFactors: [0.7, 1.0, 1.5, 2.0, 2.8, 3.8],
    hyperCost: 10000,
    droneMaxAbductions: 12        // quantas vezes um drone pode recapturar o MESMO zumbi (evita travar a rodada)
};

function getMaxLevel(round) {
    if (round <= 10) return 3;
    if (round <= 20) return 4;
    if (round <= 30) return 5;
    return 6;
}

const COLORS = {
    paperLight: '#e8d5a8',
    paperDark: '#c9a87a',
    grid: 'rgba(91, 47, 18, 0.07)',
    ink: '#2c1810'
};

const TOWER_STATS = {
    spike:      { range: 1.5, damage: 6,  fireRate: 1300, cost: 5,   ignoresFlying: true, damageType: 'physical', label: 'Espinhos' },
    pistol:     { range: 2.5, damage: 9,  fireRate: 800,  cost: 10,  damageType: 'physical', label: 'Pistola' },
    machinegun: { range: 3.0, damage: 11, fireRate: 380,  cost: 30,  damageType: 'physical', label: 'Metralhadora' },
    poison:     { range: 2.5, damage: 4,  fireRate: 700,  cost: 40,  slowFactor: 0.55, slowMs: 1400, damageType: 'poison', label: 'Veneno' },
    radar:      { range: 7.0, damage: 60, fireRate: 1500, cost: 100, damageType: 'energy', label: 'Radar' },
    robot:      { range: 3.5, damage: 22, fireRate: 550,  cost: 120, damageType: 'physical', label: 'Robô' },
    rocket:     { range: 4.0, damage: 30, fireRate: 1300, cost: 150, splashRadius: 1.3, damageType: 'explosive', label: 'Foguete' },
    tesla:       { range: 4.0, damage: 80,  fireRate: 1100, cost: 200, chains: 3, chainRange: 2.5, chainFalloff: 0.65, damageType: 'energy', label: 'Tesla' },
    radioactive: { range: 2.5, damage: 100, fireRate: 2500, cost: 250, damageType: 'energy', label: 'Radioativa' },
    knight:      { range: 99,  damage: 100, fireRate: 500,  cost: 500,  damageType: 'holy', label: 'Cavaleiro', mobile: true, moveSpeed: 0.13, cleaveFactor: 0.5, cleaveRange: 0.9 },
    drone:       { range: 99,  damage: 0,   fireRate: 0,    cost: 750,  damageType: 'none', label: 'Drone', mobile: true, isDrone: true, moveSpeed: 0.22 },
    laser:       { range: 0.6, damage: 200, fireRate: 800,  cost: 180,  damageType: 'energy', label: 'Parede Laser' }
};

const ZOMBIE_STATS = {
    normal:   { hpMult: 1.0,  speedMult: 1.0, body: '#6b8e3a', head: '#94b54a', size: 1.0,  unlockRound: 1,  weight: 100, label: 'Normal' },
    tank:     { hpMult: 2.6,  speedMult: 0.7, body: '#3a5d20', head: '#5b8a35', size: 1.3,  unlockRound: 2,  weight: 22,  horns: true, label: 'Tanque' },
    fast:     { hpMult: 0.55, speedMult: 1.7, body: '#a3cf52', head: '#c5e578', size: 0.78, unlockRound: 3,  weight: 28,  label: 'Rápido' },
    flying:   { hpMult: 0.85, speedMult: 1.2, body: '#7fa850', head: '#a3cf52', size: 0.95, unlockRound: 4,  weight: 16,  flying: true, label: 'Voador' },
    skeleton: { hpMult: 0.75, speedMult: 1.05, body: '#d8d2c0', head: '#f0ebd8', size: 0.95, unlockRound: 5,  weight: 22,  skeletal: true, slowImmune: true, immuneTo: ['physical'], label: 'Esqueleto' },
    ghost:    { hpMult: 0.5,  speedMult: 1.0, body: '#e3e8e1', head: '#f6f8f3', size: 1.0,  unlockRound: 6,  weight: 18,  ghost: true, dodgeChance: 0.45, immuneTo: ['physical'], label: 'Fantasma' },
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

        // pré-render do fundo estático (textura + grid) para um canvas offscreen,
        // evitando ~280 ops de canvas por frame
        this.bgCanvas = document.createElement('canvas');
        this.bgCanvas.width = this.canvas.width;
        this.bgCanvas.height = this.canvas.height;
        this.bgCtx = this.bgCanvas.getContext('2d');

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
        this.initHamburgerMenu();
        this.initAudio();
        this.renderStaticBackground();
        this.updatePath();
        this.updateHUD();

        this.loop = this.loop.bind(this);
        this.initStartScreen();
    }

    // ---------- audio ----------
    initAudio() {
        this.bgMusic = document.getElementById('bg-music');
        this.bossMusic = document.getElementById('boss-music');
        this.bgMusic.volume = 0.4;
        this.bossMusic.volume = 0.5;
        this.muted = localStorage.getItem('zombieDefenderMuted') === '1';
        this.bgMusic.muted = this.muted;
        this.bossMusic.muted = this.muted;
        this.musicEnabled = false;
        this.currentTrack = null; // 'normal' | 'boss' | null
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
            localStorage.setItem('zombieDefenderMuted', this.muted ? '1' : '0');
            refreshMuteBtn();
        });

        const fsBtn = document.getElementById('fullscreen-btn');
        let _simFS = false;

        const _isFS = () =>
            !!(document.fullscreenElement || document.webkitFullscreenElement || _simFS);

        const _updateFsBtn = () => {
            const on = _isFS();
            fsBtn.textContent = on ? '✕' : '⛶';
            fsBtn.title = on ? 'Sair da tela cheia' : 'Tela cheia';
        };

        const _activateSim = () => {
            _simFS = true;
            document.getElementById('game-container').classList.add('fake-fullscreen');
            _updateFsBtn();
            setTimeout(fitCanvas, 60);
        };

        const _deactivateSim = () => {
            _simFS = false;
            document.getElementById('game-container').classList.remove('fake-fullscreen');
            _updateFsBtn();
            setTimeout(fitCanvas, 60);
        };

        const _enterFS = () => {
            const el = document.documentElement;
            const fn = el.requestFullscreen || el.webkitRequestFullscreen;
            if (fn) {
                fn.call(el).catch(_activateSim);
            } else {
                _activateSim();
            }
        };

        const _exitFS = () => {
            if (document.fullscreenElement || document.webkitFullscreenElement) {
                const fn = document.exitFullscreen || document.webkitExitFullscreen;
                if (fn) fn.call(document).catch(() => {});
            }
            if (_simFS) _deactivateSim();
        };

        fsBtn.addEventListener('click', () => _isFS() ? _exitFS() : _enterFS());

        document.addEventListener('fullscreenchange', () => { _updateFsBtn(); setTimeout(fitCanvas, 80); });
        document.addEventListener('webkitfullscreenchange', () => { _updateFsBtn(); setTimeout(fitCanvas, 80); });

        _updateFsBtn();
    }

    // Chamada dentro do gesto do usuário (clique no botão Play) para destravar
    // o autoplay das duas faixas — sem isso, o navegador bloqueia o .play()
    // posterior (especialmente o da boss-music, que dispara muito depois).
    primeAudio() {
        if (this._audioPrimed) return;
        this._audioPrimed = true;
        const prime = (a) => {
            if (!a) return;
            const wasMuted = a.muted;
            a.muted = true;
            const p = a.play();
            if (p && typeof p.then === 'function') {
                p.then(() => {
                    a.pause();
                    a.currentTime = 0;
                    a.muted = wasMuted;
                }).catch(() => {
                    a.muted = wasMuted;
                    this._audioPrimed = false; // permite nova tentativa em próximo gesto
                });
            }
        };
        prime(this.bgMusic);
        prime(this.bossMusic);
    }

    playMusic() {
        this.musicEnabled = true;
        this.updateMusicTrack();
    }

    stopMusic() {
        this.musicEnabled = false;
        if (this.bgMusic)   { this.bgMusic.pause();   this.bgMusic.currentTime = 0; }
        if (this.bossMusic) { this.bossMusic.pause(); this.bossMusic.currentTime = 0; }
        this.currentTrack = null;
    }

    setSpeed(speed) {
        this.speedMultiplier = speed;
        this.updateMusicTrack();
    }

    // Se um .play() for rejeitado pelo navegador (autoplay bloqueado),
    // registra um listener único no documento; o próximo gesto do usuário
    // (clique/tecla/toque) re-tenta tocar a faixa correta.
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
        if (p && typeof p.catch === 'function') {
            p.catch(() => this.armAudioUnlockListener());
        }
    }

    // Alterna entre a faixa normal e a do mestre; pausa tudo se jogo pausado/encerrado.
    // Idempotente: pode ser chamada todo frame sem custo perceptível.
    updateMusicTrack() {
        if (!this.bgMusic || !this.bossMusic) return;
        if (!this.musicEnabled || this.gameOver || this.speedMultiplier === 0) {
            if (!this.bgMusic.paused)   this.bgMusic.pause();
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
                this.setSpeed(speed);
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

        const cellFromTouch = (touch) => {
            const rect = this.canvas.getBoundingClientRect();
            const sx = this.canvas.width / rect.width;
            const sy = this.canvas.height / rect.height;
            const x = Math.floor((touch.clientX - rect.left) * sx / CONFIG.gridSize);
            const y = Math.floor((touch.clientY - rect.top)  * sy / CONFIG.gridSize);
            return { x, y };
        };

        this.canvas.addEventListener('mousemove', (e) => {
            this.hoverCell = cellFromEvent(e);
        });
        this.canvas.addEventListener('mouseleave', () => { this.hoverCell = null; });

        // --- Touch: drag-and-drop placement on mobile ---
        // The preview (hoverCell) follows the finger; releasing commits the action.
        this.canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                this.hoverCell = cellFromTouch(e.touches[0]);
            }
        }, { passive: true });

        this.canvas.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1) {
                this.hoverCell = cellFromTouch(e.touches[0]);
            }
        }, { passive: true });

        this.canvas.addEventListener('touchend', (e) => {
            if (this.gameOver || !this.hoverCell) return;
            // Prevent the synthetic click that fires after touchend
            e.preventDefault();
            this.commitTouchPlacement();
        });

        // Drag a tower straight from the shop onto the map (typical mobile UX).
        // Starting the gesture on a shop item still scrolls the shop bar; only
        // once the finger reaches the map do we "pick up" the tower.
        const overCanvas = (clientX, clientY) => {
            const r = this.canvas.getBoundingClientRect();
            return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
        };
        document.querySelectorAll('.shop-item').forEach(item => {
            let dragging = false;
            item.addEventListener('touchstart', (e) => {
                dragging = false;
                item._dragArmed = false;
                if (e.touches.length !== 1) return;
                const type = item.dataset.type;
                if (this.money < TOWER_STATS[type].cost) return; // can't afford → behave like a normal tap
                item._dragArmed = true;
                item._dragType = type;
            }, { passive: true });

            item.addEventListener('touchmove', (e) => {
                if (!item._dragArmed || e.touches.length !== 1) return;
                const t = e.touches[0];
                if (overCanvas(t.clientX, t.clientY)) {
                    if (!dragging) {
                        dragging = true;
                        this.selectedTowerType = item._dragType;
                        document.querySelectorAll('.shop-item').forEach(i => i.classList.remove('selected'));
                        item.classList.add('selected');
                        this.hideTowerMenu();
                    }
                    this.hoverCell = cellFromTouch(t);
                    e.preventDefault(); // stop the shop bar from scrolling while placing
                } else if (dragging) {
                    this.hoverCell = null;
                    e.preventDefault();
                }
            }, { passive: false });

            const endDrag = (e) => {
                item._dragArmed = false;
                if (!dragging) return; // a plain tap → let the click handler toggle the selection
                dragging = false;
                if (e.cancelable) e.preventDefault(); // swallow the synthetic click after this touch
                const t = e.changedTouches && e.changedTouches[0];
                this.hoverCell = (t && overCanvas(t.clientX, t.clientY)) ? cellFromTouch(t) : null;
                this.commitTouchPlacement();
            };
            item.addEventListener('touchend', endDrag, { passive: false });
            item.addEventListener('touchcancel', () => {
                item._dragArmed = false;
                if (dragging) { dragging = false; this.hoverCell = null; }
            });
        });

        this.canvas.addEventListener('click', (e) => {
            if (this.gameOver) return;
            // A touch just resolved this spot; ignore the synthetic click it spawns.
            const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
            if (this._lastTouchAction && now - this._lastTouchAction < 500) return;
            const { x, y } = cellFromEvent(e);
            if (x < 0 || x >= CONFIG.cols || y < 0 || y >= CONFIG.rows) return;

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
                this.setSpeed(speed);
                document.querySelectorAll('#speed-control button').forEach(b => {
                    b.classList.toggle('active', parseInt(b.dataset.speed, 10) === speed);
                });
            }
        });
    }

    // Resolve a pending touch (canvas tap or shop drag-and-drop) into an action,
    // mirroring the desktop click handler. `hoverCell` holds the target cell.
    commitTouchPlacement() {
        const cell = this.hoverCell;
        this.hoverCell = null;
        if (this.gameOver || !cell) return;
        this._lastTouchAction = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        const { x, y } = cell;
        if (x < 0 || x >= CONFIG.cols || y < 0 || y >= CONFIG.rows) return;

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
        const self = this;
        const startScreen = document.getElementById('start-screen');
        const countdownOverlay = document.getElementById('countdown-overlay');
        const helpOverlay = document.getElementById('help-overlay');

        // ▶ Start button → countdown → game
        document.getElementById('btn-start').addEventListener('click', () => {
            this.primeAudio();
            startScreen.classList.add('fade-out');
            setTimeout(() => { startScreen.style.display = 'none'; }, 800);
            this.doCountdown();
        });

        // 🏆 Scores button on start screen
        document.getElementById('btn-scores').addEventListener('click', () => {
            this.showHighScores();
        });

        // ? Help button
        document.getElementById('btn-help').addEventListener('click', () => {
            helpOverlay.classList.add('show');
        });
        document.getElementById('help-close').addEventListener('click', () => {
            helpOverlay.classList.remove('show');
        });

        // ⚡ Upgrade All button
        document.getElementById('upgrade-all-btn').addEventListener('click', () => {
            this.upgradeAllTowers();
        });
    }

    doCountdown() {
        const self = this;
        const overlay = document.getElementById('countdown-overlay');
        const countEl = document.getElementById('countdown');
        let count = 3;
        countEl.textContent = count;
        overlay.classList.add('show');

        const tick = () => {
            count--;
            if (count > 0) {
                countEl.textContent = count;
                setTimeout(tick, 1000);
            } else {
                countEl.textContent = 'GO!';
                setTimeout(() => {
                    overlay.classList.remove('show');
                    self.startNextRound(self.gameTime);
                    self.playMusic();
                    requestAnimationFrame(self.loop);
                }, 600);
            }
        };
        setTimeout(tick, 1000);
    }

    // ---------- hamburger menu ----------
    initHamburgerMenu() {
        const btn = document.getElementById('hamburger-btn');
        const menu = document.getElementById('hamburger-menu');

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = menu.classList.contains('show');
            menu.classList.toggle('show', !isOpen);
        });

        document.getElementById('hm-restart').addEventListener('click', () => {
            this.closeHamburgerMenu();
            location.reload();
        });

        document.getElementById('hm-scores').addEventListener('click', () => {
            this.showHighScores();
        });

        document.getElementById('hm-help').addEventListener('click', () => {
            document.getElementById('help-overlay').classList.add('show');
            this.closeHamburgerMenu();
        });

        // close when clicking outside
        document.addEventListener('click', (e) => {
            if (!menu.contains(e.target) && e.target !== btn) {
                this.closeHamburgerMenu();
            }
        });

        // close on ESC
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeHamburgerMenu();
                this.hideHighScores();
            }
        });

        // high scores overlay buttons
        document.getElementById('hs-close').addEventListener('click', () => {
            this.hideHighScores();
        });
        document.getElementById('hs-clear').addEventListener('click', () => {
            this.clearHighScores();
            this.renderHighScores();
        });
    }

    closeHamburgerMenu() {
        document.getElementById('hamburger-menu').classList.remove('show');
    }

    findTowerAt(x, y) {
        return this.towers.find(t => t.x === x && t.y === y) || null;
    }

    canPlaceTower(x, y, type) {
        const towerType = type || this.selectedTowerType;
        if (x < 0 || x >= CONFIG.cols || y < 0 || y >= CONFIG.rows) return false;
        if (x === this.start.x && y === this.start.y) return false;
        if (x === this.end.x && y === this.end.y) return false;
        if (this.grid[x][y] !== 0) return false; // célula ocupada por qualquer torre

        // Parede Laser não bloqueia o caminho — pode ser colocada em qualquer célula livre
        if (towerType === 'laser') return true;

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
        // Parede Laser usa grid=2 (ocupada mas caminhável pelo pathfinding)
        this.grid[x][y] = type === 'laser' ? 2 : 1;
        this.towers.push(new Tower(x, y, type));
        this.updatePath();
        for (const z of this.zombies) z.recalcPath(this);
        this.updateHUD();
    }

    mergeTower(tower, type) {
        if (tower.goldenStacks >= 2) {
            this.flashFloating(tower.x, tower.y, 'MAX ⭐', '#f1c40f');
            return;
        }
        const cost = TOWER_STATS[type].cost;
        if (this.money < cost) {
            this.flashFloating(tower.x, tower.y, 'Sem $!', '#c0392b');
            return;
        }
        this.money -= cost;
        tower.golden = true;
        tower.goldenMult *= 2;
        tower.goldenStacks++;
        tower.totalInvested += cost;
        tower.applyLevel();
        this.floatingTexts.push({
            x: tower.x * CONFIG.gridSize + CONFIG.gridSize / 2,
            y: tower.y * CONFIG.gridSize + CONFIG.gridSize / 2,
            text: 'DOURADA! x2 ⭐',
            color: '#f1c40f',
            life: 90
        });
        // mostra o menu da torre (também limpa a seleção da loja)
        this.showTowerMenu(tower);
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
        const maxLevel = getMaxLevel(this.round);
        if (tower.level >= maxLevel) return;
        const cost = tower.getUpgradeCost(maxLevel);
        if (this.money < cost) {
            this.flashFloating(tower.x, tower.y, 'Sem $!', '#c0392b');
            return;
        }
        this.money -= cost;
        tower.upgrade(cost, maxLevel);
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

    hyperTower(tower) {
        const maxLevel = getMaxLevel(this.round);
        if (tower.level < maxLevel || tower.hyper) return;
        if (this.money < CONFIG.hyperCost) {
            this.flashFloating(tower.x, tower.y, 'Sem $!', '#c0392b');
            return;
        }
        this.money -= CONFIG.hyperCost;
        tower.hyper = true;
        tower.applyLevel();
        this.floatingTexts.push({
            x: tower.x * CONFIG.gridSize + CONFIG.gridSize / 2,
            y: tower.y * CONFIG.gridSize + CONFIG.gridSize / 2,
            text: 'HYPER! ⚡',
            color: '#8e44ad',
            life: 90
        });
        this.renderTowerMenu();
        this.updateHUD();
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
                    upgraded.add(tower);
                    anyUpgraded = true;
                }
            }
        }
        if (upgraded.size) {
            // um texto por torre melhorada (não um por nível) — evita poluir a tela
            for (const tower of upgraded) {
                this.floatingTexts.push({
                    x: tower.x * CONFIG.gridSize + CONFIG.gridSize / 2,
                    y: tower.y * CONFIG.gridSize + CONFIG.gridSize / 2,
                    text: `Nível ${tower.level + 1}!`,
                    color: '#27ae60',
                    life: 70
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
        // Modal circular sempre centralizada — sem posicionamento complexo
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
        for (let i = 0; i < maxLevel + 1; i++) {
            stars.push(`<span class="${i <= t.level ? '' : 'empty'}">★</span>`);
        }

        const next = isMax ? null : t.previewUpgrade(maxLevel);
        const dmg = Math.round(t.damage);
        const isMobile = !!stats.mobile;
        const range = isMobile ? '∞' : (t.range / CONFIG.gridSize).toFixed(1);
        const nextRange = next ? (isMobile ? '∞' : (next.range / CONFIG.gridSize).toFixed(1)) : undefined;
        const dps = (t.damage / (t.fireRate / 1000)).toFixed(1);

        const stat = (label, cur, nxt) => {
            const same = nxt === undefined || nxt === cur;
            return `${label}: <strong>${cur}</strong>` +
                   (same ? '' : ` <span class="arrow">→ ${nxt}</span>`);
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
            <!-- Fatia superior (maior) — informações da torre -->
            <div class="tm-top-slice">
                <div class="tm-header">${stats.label}${t.goldenStacks ? ' ' + '⭐'.repeat(t.goldenStacks) : ''}${t.hyper ? ' ⚡' : ''}</div>
                <div class="tm-level">
                    Nível ${t.level + 1}/${maxLevel + 1}
                    <span class="tm-stars">${stars.join('')}</span>
                </div>
                <div class="tm-stats">
                    ${statsHtml}
                </div>
            </div>
            <!-- Fatias inferiores — vender (esquerda) e melhorar/hyper (direita) -->
            <div class="tm-bottom-slices">
                <div class="tm-slice tm-sell" data-action="sell">Vender<br><strong>+$${refund}</strong></div>
				${rightSlice}
            </div>
        `;

        // Event listeners nas fatias clicáveis
        const sellSlice = menu.querySelector('[data-action="sell"]');
        const upgradeSlice = menu.querySelector('[data-action="upgrade"]');
        const hyperSlice = menu.querySelector('[data-action="hyper"]');

        if (sellSlice) {
            sellSlice.addEventListener('click', (e) => {
                e.stopPropagation();
                if (sellSlice.dataset.disabled) return;
                this.sellTower(t);
            });
        }
        if (upgradeSlice) {
            upgradeSlice.addEventListener('click', (e) => {
                e.stopPropagation();
                if (upgradeSlice.dataset.disabled) return;
                this.upgradeTower(t);
            });
        }
        if (hyperSlice) {
            hyperSlice.addEventListener('click', (e) => {
                e.stopPropagation();
                if (hyperSlice.dataset.disabled) return;
                this.hyperTower(t);
            });
        }

        // Clicar na área de info (fora dos botões) fecha o modal
        menu.querySelector('.tm-top-slice').addEventListener('click', (e) => {
            e.stopPropagation();
            this.hideTowerMenu();
        });
    }

    updateHUD() {
        if (!Number.isFinite(this.money)) this.money = 0;
        document.getElementById('money').innerText = this.money;
        document.getElementById('health').innerText = Math.max(0, this.health);
        document.getElementById('score').innerText = this.score;
        document.getElementById('round').innerText = this.round;

        document.querySelectorAll('.shop-item').forEach(item => {
            const cost = TOWER_STATS[item.dataset.type].cost;
            item.classList.toggle('disabled', this.money < cost);
        });

        const upgradeAllBtn = document.getElementById('upgrade-all-btn');
        if (upgradeAllBtn) {
            upgradeAllBtn.style.display = '';
        }
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
        this.zombiesToSpawn = 4 + Math.floor(this.round * 0.8);
        this.spawnInterval = Math.max(360, 1100 - this.round * 28);
        this.bossPending = (this.round >= ZOMBIE_STATS.king.unlockRound && this.round % 5 === 0);
        this.waveState = 'spawning';
        // round 1: delay de 3s antes dos primeiros monstros
        if (this.round === 1) {
            this.lastSpawnTime = time - this.spawnInterval + 3000;
        } else {
            this.lastSpawnTime = time - this.spawnInterval;
        }
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
        const mh = z.maxHealth || 0;
        const reward = Math.max(0, Math.floor((4 + Math.floor(mh / 14)) * 0.7));
        this.money += reward;
        this.score += mh;
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
        this.stopMusic();
        this.saveHighScore();
        const el = document.getElementById('game-over');
        el.innerHTML = `
            <h1>Game Over</h1>
            <p>Round atingido: ${this.round}</p>
            <p>Pontuação: ${this.score}</p>
            <button onclick="location.reload()">Jogar Novamente</button>
        `;
        el.classList.add('show');
    }

    // ---------- high scores ----------
    saveHighScore() {
        const scores = this.getHighScores();
        const entry = { round: this.round, score: this.score, date: new Date().toLocaleDateString('pt-BR') };
        scores.push(entry);
        scores.sort((a, b) => b.score - a.score);
        const top10 = scores.slice(0, 10);
        localStorage.setItem('zombieDefenderScores', JSON.stringify(top10));
    }

    getHighScores() {
        try {
            return JSON.parse(localStorage.getItem('zombieDefenderScores')) || [];
        } catch { return []; }
    }

    clearHighScores() {
        localStorage.removeItem('zombieDefenderScores');
    }

    renderHighScores() {
        const scores = this.getHighScores();
        const listEl = document.getElementById('hs-list');
        if (scores.length === 0) {
            listEl.innerHTML = '<div class="hs-empty">Nenhum recorde ainda!</div>';
            return;
        }
        listEl.innerHTML = scores.map((s, i) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
            return `<div class="hs-entry">
                <span class="hs-rank">${medal}</span>
                <span class="hs-score">${s.score}</span>
                <span class="hs-detail">R${s.round} · ${s.date}</span>
            </div>`;
        }).join('');
    }

    showHighScores() {
        this.renderHighScores();
        document.getElementById('high-scores-overlay').classList.add('show');
        this.closeHamburgerMenu();
    }

    hideHighScores() {
        document.getElementById('high-scores-overlay').classList.remove('show');
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

            // alterna música normal/boss conforme presença do mestre
            this.updateMusicTrack();
        }

        this.drawBackground();
        this.drawHover();

        // separa terrestres/aéreos sem alocar arrays novos: usa buffers reciclados
        const ground = this._groundBuf || (this._groundBuf = []);
        const air = this._airBuf || (this._airBuf = []);
        ground.length = 0;
        air.length = 0;
        for (const z of this.zombies) {
            if (ZOMBIE_STATS[z.type]?.flying) air.push(z);
            else ground.push(z);
        }
        ground.sort((a, b) => a.screenY - b.screenY);
        air.sort((a, b) => a.screenY - b.screenY);
        for (const z of ground) z.draw(this.ctx);
        for (const t of this.towers) t.draw(this.ctx);
        for (const z of air) z.draw(this.ctx);
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
    // Renderiza fundo + grid (estáticos) em canvas offscreen uma única vez.
    renderStaticBackground() {
        const ctx = this.bgCtx;
        const w = this.bgCanvas.width;
        const h = this.bgCanvas.height;

        ctx.fillStyle = COLORS.paperLight;
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = 'rgba(91, 47, 18, 0.05)';
        for (let i = 0; i < 80; i++) {
            const x = (i * 137 + 41) % w;
            const y = (i * 311 + 17) % h;
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
            w / 2, h / 2, h * 0.4,
            w / 2, h / 2, h * 0.95
        );
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(91, 47, 18, 0.28)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // grid: um único path em vez de N beginPath/stroke
        ctx.strokeStyle = COLORS.grid;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x <= CONFIG.cols; x++) {
            ctx.moveTo(x * CONFIG.gridSize, 0);
            ctx.lineTo(x * CONFIG.gridSize, h);
        }
        for (let y = 0; y <= CONFIG.rows; y++) {
            ctx.moveTo(0, y * CONFIG.gridSize);
            ctx.lineTo(w, y * CONFIG.gridSize);
        }
        ctx.stroke();
    }

    drawBackground() {
        this.ctx.drawImage(this.bgCanvas, 0, 0);
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

            if (existing.range > 0 && !existing.mobile) {
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

        if (can && !TOWER_STATS[this.selectedTowerType].mobile) {
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
        this.hyper = false;
        this.golden = false;
        this.goldenMult = 1;
        this.goldenStacks = 0;
        this.totalInvested = s.cost;
        this.lastShot = 0;
        this.angle = 0;
        this.recoil = 0;
        this.spinAngle = 0;
        this.frozenUntil = 0;
        this.mobile = !!s.mobile;
        this.isDrone = !!s.isDrone;
        if (this.mobile) {
            this.screenX = x * CONFIG.gridSize + CONFIG.gridSize / 2;
            this.screenY = y * CONFIG.gridSize + CONFIG.gridSize / 2;
            this.gallopPhase = 0;
            this.swingTime = 0;
            this.targetZombie = null;
            this.carrying = null;     // drone: zumbi sendo carregado
            this.dropCooldown = 0;    // drone: pausa após soltar
            this.rotorSpin = 0;       // drone: ângulo das hélices
        }
        this.applyLevel();
    }

    applyLevel() {
        const dmgMult = 1 + this.level * 0.55;     // +55% damage per level
        const rangeMult = 1 + this.level * 0.12;   // +12% range per level
        const rateMult = Math.pow(0.82, this.level); // ~18% faster per level
        this.damage = this.baseDamage * dmgMult * (this.hyper ? 10 : 1) * this.goldenMult;
        this.range = this.baseRange * rangeMult;
        this.fireRate = this.baseFireRate * rateMult;
    }

    getUpgradeCost(maxLevel) {
        if (this.level >= maxLevel) return 0;
        const factors = CONFIG.upgradeCostFactors;
        // se o nível passar do tamanho da tabela, extrapola a partir do último fator
        const lastFactor = factors[factors.length - 1] || 1;
        const factor = (this.level < factors.length && Number.isFinite(factors[this.level]))
            ? factors[this.level]
            : lastFactor * Math.pow(1.4, this.level - factors.length + 1);
        const cost = Math.floor(TOWER_STATS[this.type].cost * factor);
        return Number.isFinite(cost) ? Math.max(1, cost) : 1;
    }

    upgrade(paidCost, maxLevel) {
        if (this.level >= maxLevel) return;
        this.level++;
        this.totalInvested += paidCost;
        this.applyLevel();
    }

    previewUpgrade(maxLevel) {
        if (this.level >= maxLevel) return null;
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

        if (this.isDrone) {
            this.updateDrone(time, dt, zombies, game);
            return;
        }

        if (this.mobile) {
            this.updateMobile(time, dt, zombies, game);
            return;
        }

        if (this.type === 'laser') {
            this.updateLaserWall(time, zombies, game);
            return;
        }

        const target = this.findTarget(zombies);
        if (target) {
            const cx = this.x * CONFIG.gridSize + CONFIG.gridSize/2;
            const cy = this.y * CONFIG.gridSize + CONFIG.gridSize/2;
            this.angle = Math.atan2(target.screenY - cy, target.screenX - cx);
            if (time - this.lastShot > this.fireRate) {
                if (this.type === 'tesla') {
                    this.fireTesla(cx, cy, target, zombies, projectiles, game);
                } else if (this.type === 'radioactive') {
                    this.fireRadioactive(cx, cy, zombies, projectiles, game);
                } else {
                    projectiles.push(new Projectile(cx, cy, target, this.damage, this.type));
                }
                this.lastShot = time;
                this.recoil = 6;
            }
        }
    }

    updateDrone(time, dt, zombies, game) {
        const stats = TOWER_STATS[this.type];
        const speed = stats.moveSpeed * (1 + this.level * 0.12) * dt;
        const homeX = this.x * CONFIG.gridSize + CONFIG.gridSize / 2;
        const homeY = this.y * CONFIG.gridSize + CONFIG.gridSize / 2;
        const startX = (game ? game.start.x : 0) * CONFIG.gridSize + CONFIG.gridSize / 2;
        const startY = (game ? game.start.y : 0) * CONFIG.gridSize + CONFIG.gridSize / 2;
        const endX = (game ? game.end.x : 0) * CONFIG.gridSize + CONFIG.gridSize / 2;
        const endY = (game ? game.end.y : 0) * CONFIG.gridSize + CONFIG.gridSize / 2;

        this.rotorSpin = (this.rotorSpin + dt * 0.06) % (Math.PI * 2);
        if (this.dropCooldown > 0) this.dropCooldown -= dt;

        const moveToward = (tx, ty) => {
            const dx = tx - this.screenX, dy = ty - this.screenY;
            const d = Math.hypot(dx, dy);
            if (d <= speed) { this.screenX = tx; this.screenY = ty; return true; }
            this.screenX += (dx / d) * speed;
            this.screenY += (dy / d) * speed;
            return false;
        };

        // o alvo carregado deixou de ser válido?
        if (this.carrying && (this.carrying.health <= 0 || this.carrying.reachedEnd || !zombies.includes(this.carrying))) {
            if (this.carrying) this.carrying.carried = false;
            this.carrying = null;
        }

        if (this.carrying) {
            // levando o zumbi de volta ao início
            const arrived = moveToward(startX, startY);
            this.carrying.screenX = this.screenX;
            this.carrying.screenY = this.screenY + 14;
            if (arrived) {
                const z = this.carrying;
                z.carried = false;
                z.abductions++;
                z.screenX = startX;
                z.screenY = startY;
                if (game) {
                    z.path = [...game.currentPath];
                    z.pathIndex = Math.min(1, z.path.length - 1);
                    z.recalcPath(game);
                    game.floatingTexts.push({ x: startX, y: startY - 18, text: '↩ voltou!', color: '#2980b9', life: 55 });
                }
                this.carrying = null;
                this.dropCooldown = 500;
            }
            return;
        }

        // procurar um zumbi para pegar — o mais avançado (mais perto do fim)
        let best = null, bestDist = Infinity;
        if (this.dropCooldown <= 0) {
            for (const z of zombies) {
                if (z.health <= 0 || z.carried || z.reachedEnd) continue;
                if (!ZOMBIE_STATS[z.type]?.flying) continue;                     // drone só pega voadores
                if (z.abductions >= CONFIG.droneMaxAbductions) continue;        // limite por zumbi
                // ignora zumbis colados no spawn (recém-soltos) — senão o drone fica num loop
                if (Math.hypot(z.screenX - startX, z.screenY - startY) < CONFIG.gridSize * 1.5) continue;
                const d = Math.hypot(z.screenX - endX, z.screenY - endY);
                if (d < bestDist) { bestDist = d; best = z; }
            }
        }

        if (best) {
            const grabbed = moveToward(best.screenX, best.screenY);
            const close = Math.hypot(best.screenX - this.screenX, best.screenY - this.screenY) < 16;
            if (grabbed || close) {
                if (!best.carried && best.health > 0) {
                    best.carried = true;
                    this.carrying = best;
                }
            }
        } else {
            // sem alvo: volta para a base e paira
            moveToward(homeX, homeY);
        }
    }

    updateMobile(time, dt, zombies, game) {
        const stats = TOWER_STATS[this.type];
        const homeX = this.x * CONFIG.gridSize + CONFIG.gridSize / 2;
        const homeY = this.y * CONFIG.gridSize + CONFIG.gridSize / 2;

        // limpa alvo morto OU que escapou (atravessou o mapa);
        // sem o reachedEnd, o cavaleiro persegue um zumbi removido para sempre
        if (this.targetZombie && (this.targetZombie.health <= 0 || this.targetZombie.reachedEnd)) {
            this.targetZombie = null;
        }

        // alvos reservados por outros cavaleiros (vivos)
        const taken = new Set();
        if (game && game.towers) {
            for (const t of game.towers) {
                if (t !== this && t.mobile && t.targetZombie && t.targetZombie.health > 0) {
                    taken.add(t.targetZombie);
                }
            }
        }

        const alive = zombies.filter(z => z.health > 0);

        // se meu alvo já está sendo atacado por outro cavaleiro e existe alvo livre,
        // troca para distribuir e maximizar zumbis abatidos
        const overlapping = this.targetZombie && taken.has(this.targetZombie);
        const hasFree = alive.some(z => !taken.has(z));
        if (!this.targetZombie || (overlapping && hasFree)) {
            if (alive.length > 0) {
                const free = alive.filter(z => !taken.has(z));
                const pool = free.length > 0 ? free : alive;
                // escolhe o mais próximo para reduzir tempo de viagem
                let best = null;
                let bestDist = Infinity;
                for (const z of pool) {
                    const ddx = z.screenX - this.screenX;
                    const ddy = z.screenY - this.screenY;
                    const d = ddx * ddx + ddy * ddy;
                    if (d < bestDist) {
                        bestDist = d;
                        best = z;
                    }
                }
                this.targetZombie = best;
            }
        }
        const target = this.targetZombie;

        let tx, ty;
        if (target) {
            tx = target.screenX;
            ty = target.screenY;
        } else {
            tx = homeX;
            ty = homeY;
        }

        const dx = tx - this.screenX;
        const dy = ty - this.screenY;
        const dist = Math.hypot(dx, dy);
        const meleeRange = CONFIG.gridSize * 0.7;

        if (target && dist <= meleeRange) {
            this.angle = Math.atan2(dy, dx);
            if (time - this.lastShot > this.fireRate) {
                const damageType = stats.damageType;
                const tStats = ZOMBIE_STATS[target.type];
                if (!tStats?.immuneTo?.includes(damageType)) {
                    target.applyDamage(this.damage, game);
                } else if (game) {
                    game.floatingTexts.push({ x: target.screenX, y: target.screenY - 18, text: 'imune!', color: '#aaa', life: 40 });
                }

                // cleave: dano em zumbis adjacentes
                const cleaveR = (stats.cleaveRange || 0.9) * CONFIG.gridSize;
                const cleaveD = this.damage * (stats.cleaveFactor || 0.5);
                for (const z of zombies) {
                    if (z === target || z.health <= 0) continue;
                    const ddx = z.screenX - this.screenX;
                    const ddy = z.screenY - this.screenY;
                    if (ddx * ddx + ddy * ddy <= cleaveR * cleaveR) {
                        const zS = ZOMBIE_STATS[z.type];
                        if (!zS?.immuneTo?.includes(damageType)) {
                            z.applyDamage(cleaveD, game);
                        }
                    }
                }

                this.lastShot = time;
                this.swingTime = 220;
                this.recoil = 6;
            }
        } else if (dist > 1) {
            this.angle = Math.atan2(dy, dx);
            const move = (stats.moveSpeed || 0.13) * dt;
            const m = Math.min(move, dist);
            this.screenX += (dx / dist) * m;
            this.screenY += (dy / dist) * m;
        }

        if (this.swingTime > 0) this.swingTime -= dt;
        this.gallopPhase = (this.gallopPhase || 0) + dt * 0.018;
    }

    fireTesla(cx, cy, target, zombies, projectiles, game) {
        const stats = TOWER_STATS.tesla;
        const chainRange = stats.chainRange * CONFIG.gridSize;
        const falloff = stats.chainFalloff;
        const damaged = new Set([target]);
        const points = [{ x: cx, y: cy }, { x: target.screenX, y: target.screenY }];
        const damageType = stats.damageType;

        const tStats = ZOMBIE_STATS[target.type];
        if (!tStats?.immuneTo?.includes(damageType)) {
            target.applyDamage(this.damage, game);
        } else if (game) {
            game.floatingTexts.push({ x: target.screenX, y: target.screenY - 18, text: 'imune!', color: '#aaa', life: 40 });
        }

        let last = target;
        for (let i = 0; i < stats.chains; i++) {
            const next = this.findChainTarget(zombies, last, damaged, chainRange);
            if (!next) break;
            const dmg = this.damage * Math.pow(falloff, i + 1);
            const nStats = ZOMBIE_STATS[next.type];
            if (!nStats?.immuneTo?.includes(damageType)) {
                next.applyDamage(dmg, game);
            }
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

    fireRadioactive(cx, cy, zombies, projectiles, game) {
        const radius = this.range;
        const damageType = TOWER_STATS.radioactive.damageType;
        // dano a TODOS zumbis dentro do raio — não unidirecional
        for (const z of zombies) {
            if (z.health <= 0) continue;
            const dx = z.screenX - cx, dy = z.screenY - cy;
            if (dx*dx + dy*dy <= radius*radius) {
                const zStats = ZOMBIE_STATS[z.type];
                if (zStats?.immuneTo?.includes(damageType)) {
                    if (game) game.floatingTexts.push({ x: z.screenX, y: z.screenY - 18, text: 'imune!', color: '#aaa', life: 40 });
                } else {
                    z.applyDamage(this.damage, game);
                }
            }
        }
        // projétil visual: disco radioativo giratório com fade
        const bolt = new Projectile(cx, cy, null, 0, 'radioactive');
        bolt.dead = false;
        bolt.lifeMs = 0;
        bolt.radioactiveDisk = { r: radius, maxLife: 900 }; // ms visível
        projectiles.push(bolt);
    }

    updateLaserWall(time, zombies, game) {
        if (!this.laserHits) this.laserHits = new Map();

        const cx = this.x * CONFIG.gridSize + CONFIG.gridSize / 2;
        const cy = this.y * CONFIG.gridSize + CONFIG.gridSize / 2;
        const r2 = this.range * this.range;
        const damageType = TOWER_STATS.laser.damageType;
        // cooldown por zumbi: menor que o tempo de travessia do zumbi mais rápido
        const hitCooldown = 300;

        let hitAny = false;
        for (const z of zombies) {
            if (z.health <= 0) continue;
            const dx = z.screenX - cx, dy = z.screenY - cy;
            if (dx * dx + dy * dy > r2) continue;

            const lastHit = this.laserHits.get(z) || 0;
            if (time - lastHit < hitCooldown) continue;

            const zStats = ZOMBIE_STATS[z.type];
            if (zStats?.immuneTo?.includes(damageType)) {
                if (game) game.floatingTexts.push({ x: z.screenX, y: z.screenY - 18, text: 'imune!', color: '#aaa', life: 40 });
            } else {
                z.applyDamage(this.damage, game);
                hitAny = true;
            }
            this.laserHits.set(z, time);
        }

        if (hitAny) this.recoil = 6;

        // limpa zumbis mortos ou fora do jogo do mapa
        for (const z of this.laserHits.keys()) {
            if (z.health <= 0 || !zombies.includes(z)) this.laserHits.delete(z);
        }
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
        if (this.mobile) {
            this.drawMobileUnit(ctx);
            return;
        }
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
            case 'radioactive': this.drawRadioactive(ctx); break;
            case 'laser':      this.drawLaserWall(ctx); break;
        }

        // brilho dourado se a torre foi fundida com outra igual
        if (this.golden) {
            ctx.fillStyle = 'rgba(241, 196, 15, 0.4)';
            ctx.beginPath();
            ctx.arc(0, 0, 19, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(243, 156, 18, 0.95)';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(0, 0, 20.5, 0, Math.PI * 2);
            ctx.stroke();
        }

        // aura roxa se a torre for HYPER
        if (this.hyper) {
            ctx.fillStyle = 'rgba(155, 89, 182, 0.45)';
            ctx.beginPath();
            ctx.arc(0, 0, 19, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(106, 27, 154, 0.95)';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(0, 0, 20, 0, Math.PI * 2);
            ctx.stroke();
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

    drawMobileUnit(ctx) {
        const homeX = this.x * CONFIG.gridSize + CONFIG.gridSize / 2;
        const homeY = this.y * CONFIG.gridSize + CONFIG.gridSize / 2;
        const distFromHome = Math.hypot(this.screenX - homeX, this.screenY - homeY);

        // bandeira/estandarte na "casa" — só aparece quando o cavaleiro saiu
        if (this.type === 'knight' && distFromHome > 14) {
            this.drawKnightHome(ctx, homeX, homeY);
        }

        // sombra
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.ellipse(this.screenX, this.screenY + (this.isDrone ? 20 : 14), this.isDrone ? 13 : 18, this.isDrone ? 4 : 5, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.translate(this.screenX, this.screenY);
        const facing = Math.cos(this.angle || 0) >= 0 ? 1 : -1;
        if (facing < 0 && !this.isDrone) ctx.scale(-1, 1);

        if (this.type === 'knight') this.drawKnight(ctx);
        else if (this.type === 'drone') this.drawDrone(ctx);

        // brilho dourado se a unidade foi fundida com outra igual
        if (this.golden) {
            ctx.fillStyle = 'rgba(241, 196, 15, 0.35)';
            ctx.beginPath();
            ctx.arc(0, -4, 22, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(243, 156, 18, 0.95)';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(0, -4, 23.5, 0, Math.PI * 2);
            ctx.stroke();
        }

        // aura roxa se a unidade for HYPER
        if (this.hyper) {
            ctx.fillStyle = 'rgba(155, 89, 182, 0.4)';
            ctx.beginPath();
            ctx.arc(0, -4, 22, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(106, 27, 154, 0.95)';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(0, -4, 23, 0, Math.PI * 2);
            ctx.stroke();
        }

        // estrelas de nível
        if (this.level > 0) {
            const starY = -32;
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

        if (this.frozenUntil > 0) {
            ctx.fillStyle = 'rgba(135, 206, 250, 0.45)';
            ctx.beginPath();
            ctx.arc(0, 0, 22, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.beginPath();
            ctx.arc(-8, -6, 2, 0, Math.PI * 2);
            ctx.arc(6, 4, 1.5, 0, Math.PI * 2);
            ctx.arc(-4, 8, 1.2, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    drawDrone(ctx) {
        const spin = this.rotorSpin || 0;
        const bob = Math.sin(spin * 5) * 1.2;
        ctx.save();
        ctx.translate(0, bob);

        // feixe de captura quando carregando um zumbi
        if (this.carrying) {
            ctx.fillStyle = 'rgba(46, 204, 113, 0.20)';
            ctx.beginPath();
            ctx.moveTo(-4, 6); ctx.lineTo(4, 6); ctx.lineTo(12, 28); ctx.lineTo(-12, 28); ctx.closePath();
            ctx.fill();
        }

        const arm = 14;
        const rotors = [[1, 1], [-1, 1], [1, -1], [-1, -1]];

        // braços em X
        ctx.strokeStyle = '#34495e';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        for (const [sx, sy] of rotors) {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(sx * arm, sy * arm * 0.7);
            ctx.stroke();
        }

        // hélices girando
        for (const [sx, sy] of rotors) {
            const hx = sx * arm, hy = sy * arm * 0.7;
            ctx.fillStyle = 'rgba(120, 144, 156, 0.28)';
            ctx.beginPath(); ctx.arc(hx, hy, 7, 0, Math.PI * 2); ctx.fill();
            inkStroke(ctx, 1.3);
            ctx.fillStyle = '#5d6d7e';
            ctx.beginPath(); ctx.arc(hx, hy, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.save();
            ctx.translate(hx, hy);
            ctx.rotate(spin * (sx * sy > 0 ? 1 : -1));
            ctx.strokeStyle = 'rgba(44, 24, 16, 0.45)';
            ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(7, 0); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(0, 7); ctx.stroke();
            ctx.restore();
        }

        // corpo central
        inkStroke(ctx, 1.8);
        ctx.fillStyle = '#2c3e50';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(-8, -6.5, 16, 13, 3);
        else ctx.rect(-8, -6.5, 16, 13);
        ctx.fill(); ctx.stroke();

        // sensor / "olho"
        ctx.fillStyle = this.carrying ? '#2ecc71' : '#3498db';
        ctx.beginPath(); ctx.arc(0, 0, 3.2, 0, Math.PI * 2); ctx.fill();
        inkStroke(ctx, 1); ctx.stroke();

        // garra embaixo
        ctx.strokeStyle = '#5d6d7e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 6); ctx.lineTo(0, 10);
        ctx.moveTo(-3.5, 13); ctx.quadraticCurveTo(0, 9, 3.5, 13);
        ctx.stroke();

        ctx.restore();
    }

    drawKnightHome(ctx, hx, hy) {
        ctx.save();
        ctx.translate(hx, hy);
        inkStroke(ctx, 1.5);
        // base de terra
        ctx.fillStyle = '#8b5a2b';
        ctx.beginPath();
        ctx.ellipse(0, 8, 7, 2.5, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        // mastro
        ctx.fillStyle = '#5a4010';
        roundRect(ctx, -1, -18, 2, 26, 1);
        ctx.fill(); ctx.stroke();
        // bandeira vermelha (galhardete)
        ctx.fillStyle = '#c0392b';
        ctx.beginPath();
        ctx.moveTo(1, -18);
        ctx.lineTo(13, -15);
        ctx.lineTo(9, -11);
        ctx.lineTo(13, -7);
        ctx.lineTo(1, -4);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        // cruz dourada na bandeira
        ctx.strokeStyle = '#f1c40f';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(6, -14); ctx.lineTo(6, -8);
        ctx.moveTo(3, -11); ctx.lineTo(9, -11);
        ctx.stroke();
        ctx.restore();
    }

    drawKnight(ctx) {
        inkStroke(ctx, 1.7);
        const gallop = Math.sin(this.gallopPhase * 8) * 1.8;
        const gallop2 = Math.cos(this.gallopPhase * 8) * 1.8;

        // pernas traseiras
        ctx.fillStyle = '#5a3819';
        roundRect(ctx, -11, 8, 3, 7 - gallop, 1);
        ctx.fill(); ctx.stroke();
        roundRect(ctx, -7, 8, 3, 7 + gallop, 1);
        ctx.fill(); ctx.stroke();
        // pernas dianteiras
        roundRect(ctx, 5, 8, 3, 7 + gallop2, 1);
        ctx.fill(); ctx.stroke();
        roundRect(ctx, 9, 8, 3, 7 - gallop2, 1);
        ctx.fill(); ctx.stroke();

        // cauda
        ctx.strokeStyle = COLORS.ink;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-13, -1);
        ctx.quadraticCurveTo(-19, 1, -18, 7);
        ctx.stroke();

        // corpo do cavalo
        ctx.fillStyle = '#6b4423';
        ctx.strokeStyle = COLORS.ink;
        ctx.lineWidth = 1.7;
        roundRect(ctx, -13, -3, 26, 12, 5);
        ctx.fill(); ctx.stroke();

        // pescoço/cabeça do cavalo
        ctx.fillStyle = '#6b4423';
        ctx.beginPath();
        ctx.moveTo(10, -3);
        ctx.lineTo(17, -9);
        ctx.lineTo(21, -8);
        ctx.lineTo(21, -3);
        ctx.lineTo(19, 1);
        ctx.lineTo(13, 3);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        // crina
        ctx.fillStyle = '#3a2510';
        ctx.beginPath();
        ctx.moveTo(10, -3);
        ctx.lineTo(12, -6);
        ctx.lineTo(14, -4);
        ctx.lineTo(16, -7);
        ctx.lineTo(18, -4);
        ctx.lineTo(19, -7);
        ctx.lineTo(20, -4);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        // olho do cavalo
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(19, -5, 0.8, 0, Math.PI * 2);
        ctx.fill();

        // sela vermelha
        ctx.fillStyle = '#a52a2a';
        roundRect(ctx, -8, -6, 14, 4, 1);
        ctx.fill(); ctx.stroke();

        // armadura do cavaleiro (torso)
        ctx.fillStyle = '#bdc3c7';
        roundRect(ctx, -5, -15, 12, 11, 2.5);
        ctx.fill(); ctx.stroke();
        // detalhe das placas
        ctx.strokeStyle = '#7f8c8d';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-5, -10); ctx.lineTo(7, -10);
        ctx.stroke();
        // emblema dourado no peito
        ctx.fillStyle = '#f1c40f';
        ctx.strokeStyle = COLORS.ink;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(1, -13);
        ctx.lineTo(3, -10);
        ctx.lineTo(1, -6);
        ctx.lineTo(-1, -10);
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        // capacete
        ctx.fillStyle = '#95a5a6';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(1, -19, 5, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        // viseira (fenda)
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(-2, -20, 6, 1.6);
        // pluma vermelha no topo
        ctx.fillStyle = '#c0392b';
        ctx.beginPath();
        ctx.moveTo(1, -23);
        ctx.quadraticCurveTo(5, -29, 7, -25);
        ctx.quadraticCurveTo(4, -22, 1, -23);
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        // escudo (lado esquerdo do cavaleiro)
        ctx.fillStyle = '#2980b9';
        ctx.beginPath();
        ctx.moveTo(-4, -8);
        ctx.lineTo(-10, -6);
        ctx.lineTo(-10, 1);
        ctx.lineTo(-5, 5);
        ctx.lineTo(-4, -8);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        // cruz dourada no escudo
        ctx.strokeStyle = '#f1c40f';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-7, -6); ctx.lineTo(-7, 3);
        ctx.moveTo(-10, -2); ctx.lineTo(-4, -2);
        ctx.stroke();

        // espada (lado direito, balança ao atacar)
        const swingProgress = this.swingTime > 0 ? this.swingTime / 220 : 0;
        const swingAngle = swingProgress > 0 ? Math.sin((1 - swingProgress) * Math.PI) * 1.1 : 0;
        ctx.save();
        ctx.translate(7, -10);
        ctx.rotate(-Math.PI / 4 - swingAngle);
        // lâmina
        ctx.fillStyle = '#ecf0f1';
        ctx.strokeStyle = COLORS.ink;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(0, -2);
        ctx.lineTo(2, -4);
        ctx.lineTo(2, -18);
        ctx.lineTo(0, -20);
        ctx.lineTo(-2, -18);
        ctx.lineTo(-2, -4);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        // brilho da lâmina
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(0.5, -17); ctx.lineTo(0.5, -6);
        ctx.stroke();
        // guarda
        ctx.fillStyle = '#f1c40f';
        ctx.strokeStyle = COLORS.ink;
        ctx.lineWidth = 1.2;
        roundRect(ctx, -4, -3, 8, 2, 0.5);
        ctx.fill(); ctx.stroke();
        // cabo
        ctx.fillStyle = '#5a4010';
        ctx.fillRect(-1, -1, 2, 4);
        ctx.strokeRect(-1, -1, 2, 4);
        // pomo
        ctx.fillStyle = '#f1c40f';
        ctx.beginPath();
        ctx.arc(0, 4, 1.6, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.restore();

        // brilho de impacto durante o golpe
        if (this.swingTime > 80) {
            ctx.strokeStyle = `rgba(255, 230, 100, ${(this.swingTime - 80) / 140})`;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(14, -4, 6, -0.8, 0.8);
            ctx.stroke();
        }
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

    drawRadioactive(ctx) {
        inkStroke(ctx, 2);
        const t = performance.now() * 0.003;

        // wood base
        ctx.fillStyle = '#8b5a2b';
        roundRect(ctx, -13, 11, 26, 8, 3);
        ctx.fill(); ctx.stroke();

        // radiation symbol disc — amarelo com borda preta, girando
        ctx.save();
        ctx.translate(0, 0);
        ctx.rotate(t);

        // disco amarelo com textura desgastada
        const discR = 16;
        const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, discR);
        grad.addColorStop(0, '#f5d900');
        grad.addColorStop(0.7, '#e8c400');
        grad.addColorStop(1, '#c9a800');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, discR, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // trefoil preto (3 lâminas + centro)
        const bladeColor = '#1a1a1a';
        ctx.fillStyle = bladeColor;
        for (let i = 0; i < 3; i++) {
            const ang = (i * Math.PI * 2) / 3 - Math.PI / 2;
            ctx.save();
            ctx.rotate(ang);
            // lâmina: setor arredondado apontando para fora
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, discR * 0.72, -0.52, 0.52);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
        // círculo central preto
        ctx.beginPath();
        ctx.arc(0, 0, discR * 0.2, 0, Math.PI * 2);
        ctx.fill();
        // anel fino branco no centro (buraco)
        ctx.strokeStyle = '#f5d900';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(0, 0, discR * 0.12, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore(); // fim do girar

        // pulso de alerta ao atirar
        if (this.recoil > 2) {
            const pulseR = discR + (6 - this.recoil) * 4;
            ctx.strokeStyle = `rgba(245, 217, 0, ${this.recoil / 6 * 0.6})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, pulseR, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    drawLaserWall(ctx) {
        const t = performance.now() * 0.002;
        inkStroke(ctx, 2);

        if (this.level >= 6) {
            // ---- PLASMA STYLE (último upgrade) ----
            ctx.fillStyle = '#12082e';
            roundRect(ctx, -18, -22, 36, 7, 3);
            ctx.fill(); ctx.stroke();
            roundRect(ctx, -18, 12, 36, 7, 3);
            ctx.fill(); ctx.stroke();

            // Campo de plasma
            const pGrad = ctx.createLinearGradient(0, -15, 0, 12);
            pGrad.addColorStop(0,   'rgba(100, 0, 220, 0.7)');
            pGrad.addColorStop(0.5, 'rgba(200, 50, 255, 0.9)');
            pGrad.addColorStop(1,   'rgba(100, 0, 220, 0.7)');
            ctx.fillStyle = pGrad;
            ctx.fillRect(-18, -15, 36, 27);

            // Arcos elétricos animados
            for (let i = 0; i < 4; i++) {
                const xp = -12 + i * 8;
                const bend = Math.sin(t * 5 + i * 1.3) * 6;
                ctx.strokeStyle = `rgba(230, 190, 255, ${0.6 + Math.sin(t * 7 + i) * 0.4})`;
                ctx.lineWidth = 1.8;
                ctx.beginPath();
                ctx.moveTo(xp, -15);
                ctx.quadraticCurveTo(xp + bend, -1, xp - bend, 12);
                ctx.stroke();
            }

            // Borda brilhante
            ctx.strokeStyle = `rgba(180, 80, 255, ${0.6 + Math.sin(t * 4) * 0.3})`;
            ctx.lineWidth = 2.5;
            ctx.strokeRect(-18, -15, 36, 27);

            // Nós de energia nos emissores
            ctx.fillStyle = `rgba(220, 160, 255, ${0.8 + Math.sin(t * 6) * 0.2})`;
            for (const xn of [-12, -4, 4, 12]) {
                ctx.beginPath(); ctx.arc(xn, -18, 2.5, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(xn, 15, 2.5, 0, Math.PI * 2); ctx.fill();
            }

            // Flash ao acertar
            if (this.recoil > 0) {
                ctx.fillStyle = `rgba(220, 100, 255, ${this.recoil / 6 * 0.5})`;
                ctx.fillRect(-18, -15, 36, 27);
            }

        } else {
            // ---- ESTILO NORMAL (raios laser vermelhos) ----
            ctx.fillStyle = '#5a3a1a';
            roundRect(ctx, -16, -22, 32, 7, 3);
            ctx.fill(); ctx.stroke();
            roundRect(ctx, -16, 12, 32, 7, 3);
            ctx.fill(); ctx.stroke();

            // Nós emissores vermelhos
            ctx.fillStyle = '#ff4444';
            for (const xn of [-10, -3, 4, 11]) {
                ctx.beginPath(); ctx.arc(xn, -18, 2, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(xn, 15, 2, 0, Math.PI * 2); ctx.fill();
            }

            // Raios laser animados
            const flicker = 0.7 + 0.3 * Math.sin(t * 5);
            const hitBoost = this.recoil > 0 ? this.recoil / 6 : 0;
            const alpha = Math.min(1, flicker + hitBoost * 0.5);

            for (const xb of [-10, -3, 4, 11]) {
                // Brilho externo
                ctx.strokeStyle = `rgba(255, 60, 60, ${alpha * 0.4})`;
                ctx.lineWidth = 6;
                ctx.beginPath();
                ctx.moveTo(xb, -15); ctx.lineTo(xb, 12);
                ctx.stroke();
                // Núcleo do raio
                ctx.strokeStyle = `rgba(255, 230, 230, ${alpha})`;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(xb, -15); ctx.lineTo(xb, 12);
                ctx.stroke();
            }
        }
    }
}

class Zombie {
    constructor(path, round, type) {
        this.path = [...path];
        this.pathIndex = Math.min(1, this.path.length - 1);
        this.type = type;
        const stats = ZOMBIE_STATS[type];

        const baseHealth = 35;
        const scaling = Math.pow(1.09, round - 1);
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
        this.carried = false;
        this.abductions = 0;        // quantas vezes um drone já o levou ao início
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
        // sendo carregado por um drone — não se move sozinho
        if (this.carried) {
            this.bobPhase += dt * 0.012;
            return;
        }
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

        // zumbi de gelo congela torres ao passar (cavaleiros são imunes)
        if (ZOMBIE_STATS[this.type].freezesTowers && game) {
            const freezeRange = CONFIG.gridSize * 1.2;
            for (const t of game.towers) {
                if (t.mobile) continue;
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
        this.radioactiveDisk = null; // radioactive
    }

    update(zombies, dt, game) {
        // tesla bolt: instant damage already applied; just decay visually
        if (this.chainPoints) {
            this.lifeMs += dt;
            if (this.lifeMs >= this.lifetimeMs) this.dead = true;
            return;
        }
        // radioactive disk: fixed radius, spinning, fades out
        if (this.radioactiveDisk) {
            this.lifeMs += dt;
            if (this.lifeMs >= this.radioactiveDisk.maxLife) this.dead = true;
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
        const damageType = TOWER_STATS[this.type]?.damageType;
        if (this.type === 'rocket') {
            const radius = TOWER_STATS.rocket.splashRadius * CONFIG.gridSize;
            for (const z of zombies) {
                const ddx = z.screenX - this.x, ddy = z.screenY - this.y;
                if (ddx*ddx + ddy*ddy <= radius*radius) {
                    const zStats = ZOMBIE_STATS[z.type];
                    if (zStats?.immuneTo?.includes(damageType)) {
                        if (game) game.floatingTexts.push({ x: z.screenX, y: z.screenY - 18, text: 'imune!', color: '#aaa', life: 40 });
                    } else {
                        z.applyDamage(this.damage, game);
                    }
                }
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
            const zStats = ZOMBIE_STATS[this.target.type];
            if (zStats?.immuneTo?.includes(damageType)) {
                if (game) game.floatingTexts.push({ x: this.target.screenX, y: this.target.screenY - 18, text: 'imune!', color: '#aaa', life: 40 });
            } else {
                this.target.applyDamage(this.damage, game);
            }
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

        // radioactive disk: disco amarelo giratório com fade
        if (this.radioactiveDisk) {
            const a = 1 - (this.lifeMs / this.radioactiveDisk.maxLife);
            const r = this.radioactiveDisk.r;
            const spinAngle = performance.now() * 0.004;
            ctx.save();
            ctx.globalAlpha = Math.max(0, a);
            ctx.translate(this.x, this.y);

            // disco amarelo semitransparente
            const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, r);
            grad.addColorStop(0, 'rgba(245, 217, 0, 0.35)');
            grad.addColorStop(0.7, 'rgba(232, 196, 0, 0.25)');
            grad.addColorStop(1, 'rgba(201, 168, 0, 0.15)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = `rgba(26, 26, 26, ${a * 0.7})`;
            ctx.lineWidth = 2.5;
            ctx.stroke();

            // símbolo trefoil girando
            ctx.rotate(spinAngle);
            const symR = r * 0.6;
            ctx.fillStyle = `rgba(26, 26, 26, ${a * 0.6})`;
            for (let i = 0; i < 3; i++) {
                const ang = (i * Math.PI * 2) / 3 - Math.PI / 2;
                ctx.save();
                ctx.rotate(ang);
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.arc(0, 0, symR, -0.52, 0.52);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }
            // círculo central
            ctx.beginPath();
            ctx.arc(0, 0, symR * 0.28, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
            ctx.globalAlpha = 1;
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

function fitCanvas() {
    const frame = document.querySelector('.canvas-frame');
    const canvas = document.getElementById('gameCanvas');
    if (!frame || !canvas || !canvas.width || !canvas.height) return;

    const frameW = frame.clientWidth;
    const frameH = frame.clientHeight;
    if (!frameW || !frameH) return;

    const canvasAspect = canvas.width / canvas.height;
    const frameAspect = frameW / frameH;

    let cssW, cssH;
    if (canvasAspect > frameAspect) {
        cssW = frameW;
        cssH = Math.round(frameW / canvasAspect);
    } else {
        cssH = frameH;
        cssW = Math.round(frameH * canvasAspect);
    }

    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
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

// ========== HELP OVERLAY CONTENT ========== 
function renderHelpContent() {
    renderMonstersTab();
    renderWeaponsTab();
    renderStrategyTab();
    setupHelpTabs();
}

function renderMonstersTab() {
    const grid = document.getElementById('help-monsters-grid');
    if (!grid) return;

    const entries = Object.entries(ZOMBIE_STATS).filter(([_, s]) => s.weight > 0 || s.isBoss);
    grid.innerHTML = entries.map(([type, stats]) => {
        const badges = [];
        if (stats.immuneTo) {
            stats.immuneTo.forEach(dmg => {
                badges.push(`<span class="card-badge immune">Imune: ${dmg}</span>`);
            });
        }
        if (stats.slowImmune) badges.push(`<span class="card-badge immune">Imune: Slow</span>`);
        if (stats.flying) badges.push(`<span class="card-badge special">Voador</span>`);
        if (stats.isBoss) badges.push(`<span class="card-badge boss">BOSS</span>`);
        if (stats.freezesTowers) badges.push(`<span class="card-badge special">Congela Torres</span>`);
        if (stats.poisonous) badges.push(`<span class="card-badge special">Venenoso</span>`);
        if (stats.bomb) badges.push(`<span class="card-badge special">Explosivo</span>`);

        return `
            <div class="help-card">
                <canvas width="80" height="80" data-monster="${type}"></canvas>
                <h3>${stats.label}</h3>
                <div class="card-stats">
                    <div class="stat-row"><span>HP</span> <strong>${stats.hpMult}x</strong></div>
                    <div class="stat-row"><span>Vel.</span> <strong>${stats.speedMult}x</strong></div>
                    <div class="stat-row"><span>Round</span> <strong>${stats.unlockRound}+</strong></div>
                </div>
                <div class="card-badges">${badges.join('')}</div>
            </div>
        `;
    }).join('');

    // Draw monsters
    grid.querySelectorAll('canvas').forEach(canvas => {
        const type = canvas.dataset.monster;
        const ctx = canvas.getContext('2d');
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const zombie = new Zombie([{x:0,y:0},{x:1,y:0}], 1, type);
        zombie.screenX = cx;
        zombie.screenY = cy;
        zombie.draw(ctx);
    });
}

function renderWeaponsTab() {
    const grid = document.getElementById('help-weapons-grid');
    if (!grid) return;

    const entries = Object.entries(TOWER_STATS);
    grid.innerHTML = entries.map(([type, stats]) => {
        const dps = stats.isDrone ? '—' : (stats.damage / (stats.fireRate / 1000)).toFixed(1);
        const rangeGrid = stats.mobile ? '∞' : (stats.range).toFixed(1);

        let specialText = '';
        if (stats.ignoresFlying) specialText = 'Ignora voadores';
        if (stats.splashRadius) specialText = `Área: ${stats.splashRadius.toFixed(1)}`;
        if (stats.chains) specialText = `Cadeia: ${stats.chains}`;
        if (stats.damageType === 'poison') specialText = 'Slow + Dano contínuo';
        if (stats.mobile) specialText = 'Persegue zumbis · Cleave · Holy';
        if (stats.isDrone) specialText = 'Captura voadores e leva ao início';
        if (type === 'laser') specialText = 'Queima tudo que atravessa · Lv6: Plasma';

        return `
            <div class="help-card">
                <canvas width="80" height="80" data-tower="${type}"></canvas>
                <h3>${stats.label}</h3>
                <div class="card-stats">
                    <div class="stat-row"><span>Dano</span> <strong>${stats.damage}</strong></div>
                    <div class="stat-row"><span>DPS</span> <strong>${dps}</strong></div>
                    <div class="stat-row"><span>Alcance</span> <strong>${rangeGrid}</strong></div>
                    <div class="stat-row"><span>Custo</span> <strong>$${stats.cost}</strong></div>
                </div>
                ${specialText ? `<div class="card-special">${specialText}</div>` : ''}
            </div>
        `;
    }).join('');

    // Draw towers
    grid.querySelectorAll('canvas').forEach(canvas => {
        const type = canvas.dataset.tower;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Center tower in 80x80 canvas: x * gridSize + gridSize/2 = 40 → x = 0.3
        const tower = new Tower(0.3, 0.3, type);
        tower.angle = -Math.PI / 6;
        tower.draw(ctx);
    });
}

function renderStrategyTab() {
    const container = document.getElementById('help-strategy-content');
    if (!container) return;

    const monsters = Object.entries(ZOMBIE_STATS).filter(([_, s]) => s.weight > 0 || s.isBoss);
    const weapons = Object.keys(TOWER_STATS);

    // Build cards HTML
    let cardsHtml = '';
    monsters.forEach(([mType, mStats]) => {
        // Rate all weapons and sort: best (3) → good (2) → regular (1) → bad (≤0)
        const rated = weapons.map(wType => ({
            type: wType,
            rating: rateWeaponVsMonster(wType, mType)
        }));
        rated.sort((a, b) => b.rating - a.rating);

        let rowsHtml = '';
        rated.forEach(({ type: wType, rating }) => {
            let cls = 'regular';
            if (rating === 3) cls = 'best';
            else if (rating === 2) cls = 'good';
            else if (rating <= 0) cls = 'bad';

            const tip = getStrategyTip(wType, mType);
            const showTip = (rating === 3 || rating <= 0) && tip;

            rowsHtml += `
                <div class="weapon-row ${cls}">
                    <canvas class="weapon-icon" data-type="${wType}" width="28" height="28"></canvas>
                    <span>${TOWER_STATS[wType].label}</span>
                    ${showTip ? `<span class="tip">${tip}</span>` : ''}
                </div>`;
        });

        cardsHtml += `
            <div class="strategy-card" data-monster="${mType}">
                <div class="strategy-card-header">
                    <canvas class="monster-preview" width="64" height="64"></canvas>
                    <span class="monster-label">${mStats.label}</span>
                </div>
                <div class="strategy-card-body">
                    ${rowsHtml}
                </div>
            </div>`;
    });

    container.innerHTML = `<div class="strategy-cards-grid">${cardsHtml}</div>`;

    // Draw monster previews
    container.querySelectorAll('.strategy-card').forEach(card => {
        const mType = card.dataset.monster;
        const canvas = card.querySelector('.monster-preview');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const zombie = new Zombie([{x:0,y:0},{x:1,y:0}], 1, mType);
        zombie.screenX = canvas.width / 2;
        zombie.screenY = canvas.height / 2;
        zombie.draw(ctx);
    });

    // Draw weapon icons
    container.querySelectorAll('.weapon-icon').forEach(canvas => {
        const type = canvas.dataset.type;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const tower = new Tower(-0.22, -0.22, type);
        tower.angle = -Math.PI / 6;
        tower.draw(ctx);
    });
}

function rateWeaponVsMonster(weaponType, monsterType) {
    const wStats = TOWER_STATS[weaponType];
    const mStats = ZOMBIE_STATS[monsterType];
    const dmgType = wStats.damageType;

    // Imune = muito ruim
    if (mStats.immuneTo && mStats.immuneTo.includes(dmgType)) return -1;

    // Cavaleiro: dano holy ignora todas as imunidades + cleave + persegue
    if (weaponType === 'knight') return 3;

    // Drone: captura apenas voadores
    if (weaponType === 'drone') return mStats.flying ? 3 : 0;

    let rating = 2; // bom por padrão

    // Voadores: espinhos inúteis
    if (mStats.flying && weaponType === 'spike') return 0;

    // Zumbi de gelo: veneno é excelente (quebra armadura)
    if (mStats.freezesTowers && weaponType === 'poison') return 3;

    // Tesla é excelente contra grupos (e voadores vêm em bando)
    if (weaponType === 'tesla' && mStats.flying) return 3;

    // Radar alto dano bom contra tanques
    if (mStats.hpMult >= 2 && weaponType === 'radar') return 3;

    // Foguete área bom contra voadores em bando
    if (mStats.flying && weaponType === 'rocket') return 3;

    // Radioativa área circular excelente contra aglomerações
    if (weaponType === 'radioactive') rating = 3;

    // Metralhadora boa contra rápidos (dps alto)
    if (mStats.speedMult >= 1.5 && weaponType === 'machinegun') rating = 3;

    return rating;
}

function getStrategyTip(weaponType, monsterType) {
    const mStats = ZOMBIE_STATS[monsterType];
    const wStats = TOWER_STATS[weaponType];

    if (mStats.immuneTo && mStats.immuneTo.includes(wStats.damageType)) {
        return `Imune a ${wStats.damageType}!`;
    }
    if (mStats.flying && weaponType === 'spike') {
        return 'Espinhos não atingem voadores!';
    }
    if (mStats.freezesTowers && weaponType === 'poison') {
        return 'Veneno quebra a armadura de gelo!';
    }
    if (weaponType === 'tesla' && mStats.flying) {
        return 'Tesla atinge múltiplos voadores de uma vez!';
    }
    if (mStats.hpMult >= 2 && weaponType === 'radar') {
        return 'Alto dano do Radar derrete tanques!';
    }
    if (weaponType === 'knight') {
        return 'Cavaleiro persegue e ignora imunidades!';
    }
    return '';
}

function setupHelpTabs() {
    const tabs = document.querySelectorAll('.help-tab');
    const contents = document.querySelectorAll('.help-tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            contents.forEach(c => {
                c.classList.toggle('active', c.dataset.content === targetTab);
            });
        });
    });
}

configureLayout();
new Game();
renderShopThumbnails();
renderHelpContent();
setInterval(renderShopThumbnails, 80);

// Fit immediately, then again after layout settles (fonts may still be loading)
requestAnimationFrame(() => {
    fitCanvas();
    requestAnimationFrame(fitCanvas);
});
document.fonts.ready.then(fitCanvas);

window.addEventListener('resize', fitCanvas);
window.addEventListener('orientationchange', () => {
    fitCanvas();
    setTimeout(fitCanvas, 200);
});

// Watch for container size changes (e.g. virtual keyboard, font reflow)
const _ro = new ResizeObserver(fitCanvas);
_ro.observe(document.querySelector('.canvas-frame'));

// iOS PWA (atalho na tela inicial): o viewport real só se estabiliza
// alguns frames depois do load. visualViewport é mais confiável que
// window resize nesse contexto.
if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', fitCanvas);
}

// pageshow dispara quando o app abre do atalho iOS (inclusive via cache).
// A cascata de timeouts garante que ao menos uma chamada aconteça depois
// que o iOS terminar de calcular as safe-area insets e o layout final.
window.addEventListener('pageshow', () => {
    fitCanvas();
    [150, 400, 900, 1800].forEach(ms => setTimeout(fitCanvas, ms));
});
