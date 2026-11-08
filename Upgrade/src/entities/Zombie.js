/**
 * Zombie (versão 3D).
 * Lógica 100% idêntica ao Zombie.js 2D (constructor, recalcPath, applySlow,
 * applyPoison, applyDamage, update). A única mudança: em vez de desenhar no
 * canvas, montamos um modelo 3D e atualizamos posição/rotação/animação e a
 * barra de vida (billboard) a cada frame.
 */
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
        this.speed = baseSpeed;

        this.slowTimer = 0;
        this.poisonTimer = 0;
        this.poisonDamagePerMs = 0;
        this.iceArmorBroken = false;
        this.reachedEnd = false;
        this.carried = false;
        this.abductions = 0;
        this.bobPhase = Math.random() * Math.PI * 2;
        this.facing = 1;
        this.deathBomb = false;

        const start = path[0] || { x: 0, y: 0 };
        this.screenX = start.x * CONFIG.gridSize + CONFIG.gridSize / 2;
        this.screenY = start.y * CONFIG.gridSize + CONFIG.gridSize / 2;

        this._buildModel();
    }

    _world() { return window.World; }

    _buildModel() {
        const built = ZombieModels.create(this.type);
        this.model = built.group;
        this.parts = built.parts;
        this.stats = ZOMBIE_STATS[this.type];
        this.hoverBase = this.stats.flying ? 0.35 : 0;
        this._world().add(this.model);
        this._buildHpBar();
        this._updateModel();
    }

    _buildHpBar() {
        const s = this.stats.size;
        const g = new THREE.Group();
        const w = 0.34 * s, h = 0.05;
        const bg = mesh(GeomFactory.plane(w, h), MatFactory.glow('#2c1810', 0.9));
        const fill = mesh(GeomFactory.plane(w, h), MatFactory.glow('#5cb85c', 1));
        fill.position.z = 0.001;
        g.add(bg); g.add(fill);
        g.position.y = (0.62 * s + (this.stats.bigHead ? 0.17 : 0.13) * s + 0.22);
        this.model.add(g);
        this.hpBar = g; this.hpFill = fill; this.hpW = w;
    }

    recalcPath(game) {
        if (ZOMBIE_STATS[this.type].flying) return;
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
        if (this.carried) {
            this.bobPhase += dt * 0.012;
            this._updateModel();
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
            tx = game.end.x * CONFIG.gridSize + CONFIG.gridSize / 2;
            ty = game.end.y * CONFIG.gridSize + CONFIG.gridSize / 2;
        } else {
            if (!this.path || this.pathIndex >= this.path.length) {
                this.reachedEnd = true;
                return;
            }
            const target = this.path[this.pathIndex];
            tx = target.x * CONFIG.gridSize + CONFIG.gridSize / 2;
            ty = target.y * CONFIG.gridSize + CONFIG.gridSize / 2;
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

        if (ZOMBIE_STATS[this.type].freezesTowers && game) {
            const freezeRange = CONFIG.gridSize * 1.2;
            for (const t of game.towers) {
                if (t.mobile) continue;
                if (t.type === 'laser') continue;
                if (t.type === 'mago') continue;
                const tcx = t.x * CONFIG.gridSize + CONFIG.gridSize / 2;
                const tcy = t.y * CONFIG.gridSize + CONFIG.gridSize / 2;
                const d = Math.hypot(this.screenX - tcx, this.screenY - tcy);
                if (d < freezeRange) {
                    t.frozenUntil = Math.max(t.frozenUntil, game.gameTime + 3000);
                }
            }
        }

        this._lastMove = dist > 0.001;
        this._updateModel();
    }

    _updateModel() {
        const m = this.model;
        if (!m) return;
        const wx = Coords.px(this.screenX);
        const wz = Coords.py(this.screenY);

        // voo: paira mais alto
        const fly = this.stats.flying;
        const flyY = fly ? 0.55 + Math.sin(this.bobPhase * 1.5) * 0.08 : 0;
        m.position.set(wx, flyY, wz);

        // rotação para o sentido do movimento. No 2D, facing é -1/1; no 3D
        // calculamos o yaw pela direção atual (diferença para o próximo nó).
        const dir = this._facingAngle();
        if (dir != null) m.rotation.y = dir;

        // animação de caminhada
        const p = this.parts;
        const walk = this.speed > 0.0001 && !this.carried ? 1 : 0;
        const sw = Math.sin(this.bobPhase * 2) * 0.5 * walk;
        if (p.legL) { p.legL.rotation.x = sw; p.legR.rotation.x = -sw; }
        if (p.armL) { p.armL.rotation.x = -sw * 0.8; p.armR.rotation.x = sw * 0.8; }
        // balanço vertical leve
        m.position.y = flyY + (fly ? 0 : Math.abs(Math.sin(this.bobPhase * 2)) * 0.03);

        // asas do voador
        if (p.wingL) {
            const flap = Math.sin(this.bobPhase * 6) * 0.6;
            p.wingL.rotation.z = 0.2 + flap; p.wingR.rotation.z = -0.2 - flap;
        }
        // bolhas do venenoso
        if (p.bubbles) {
            p.bubbles.children.forEach((b, i) => {
                const a = this.bobPhase * 0.05 * 60 * 0.0001 + b.userData.phase;
                const t = performance.now() * 0.003 + b.userData.phase;
                b.position.set(Math.cos(t) * 0.22 * this.stats.size, 0.36 * this.stats.size + Math.sin(t * 1.3) * 0.06, Math.sin(t) * 0.18 * this.stats.size);
            });
        }

        // cor de status (slow/poison/gelo quebrado)
        this._updateTint();

        // hp bar billboard + escala de preenchimento
        if (this.hpBar) {
            this.hpBar.quaternion.copy(this._world().camera.quaternion);
            const ratio = Math.max(0, this.health / this.maxHealth);
            const w = this.hpW;
            this.hpFill.scale.x = ratio;
            this.hpFill.position.x = -w / 2 * (1 - ratio);
            let col = ratio > 0.5 ? '#5cb85c' : ratio > 0.25 ? '#f0ad4e' : '#d9534f';
            this.hpFill.material = MatFactory.glow(col, 1);
        }
    }

    // ângulo (yaw) olhando para o próximo destino no plano XZ
    _facingAngle() {
        let dx, dy;
        if (this.stats.flying) {
            const g = window.game;
            if (!g) return 0;
            dx = g.end.x * CONFIG.gridSize + CONFIG.gridSize / 2 - this.screenX;
            dy = g.end.y * CONFIG.gridSize + CONFIG.gridSize / 2 - this.screenY;
        } else {
            if (!this.path || this.pathIndex >= this.path.length) return null;
            const t = this.path[this.pathIndex];
            dx = t.x * CONFIG.gridSize + CONFIG.gridSize / 2 - this.screenX;
            dy = t.y * CONFIG.gridSize + CONFIG.gridSize / 2 - this.screenY;
        }
        if (dx === 0 && dy === 0) return null;
        // mundo: X = grade x, Z = grade y. yaw que aponta +Z local para (dx,dy)
        return Math.atan2(dx, dy);
    }

    _updateTint() {
        const bm = this.model.userData.bodyMat, hm = this.model.userData.headMat;
        if (!bm) return;
        let body = ZOMBIE_STATS[this.type].body, head = ZOMBIE_STATS[this.type].head;
        if (this.stats.freezesTowers && this.iceArmorBroken) { body = '#3a5a78'; head = '#5a7a98'; }
        if (this.slowTimer > 0) { body = '#5d96b3'; head = '#92c3df'; }
        else if (this.poisonTimer > 0) { body = '#7a4f8a'; head = '#a578b3'; }
        bm.color.set(body); hm.color.set(head);
    }

    dispose() {
        if (this.model) this._world().remove(this.model);
    }
}
