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
            const stats = TOWER_STATS[item.dataset.type];
            if (stats.unlockRound && this.round < stats.unlockRound) {
                item.style.display = 'none';
                return;
            }
            item.style.display = '';
            item.classList.toggle('disabled', this.money < stats.cost);
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
