/**
 * Tower (versão 3D).
 *
 * Toda a LÓGICA é idêntica ao Tower.js 2D: applyLevel, getUpgradeCost,
 * upgrade, previewUpgrade, update (drone/mobile/tesla/radioactive/laser/mago),
 * findTarget, findChainTarget. O que muda: em vez de desenhar no canvas,
 * construímos um modelo 3D e o atualizamos (posição na grade, rotação do
 * cano, hélices, pulso) a cada frame.
 *
 * Convenção de coordenadas:
 *  - this.x / this.y : coluna/linha da grade (inteiros), como no original
 *  - this.screenX / this.screenY : posição lógica em px (usado p/ unidades
 *    móveis), EXATAMENTE como no original
 *  - a posição 3D é derivada disso via Coords
 */
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
            this.carrying = null;
            this.dropCooldown = 0;
            this.rotorSpin = 0;
        }
        this.applyLevel();
        this._buildModel();
    }

    // ---------- modelo 3D ----------
    _buildModel() {
        const built = TowerModels.create(this.type);
        this.model = built.group;
        this.parts = built.parts;
        this._world().add(this.model);
        this._updateModelTransform(true);
    }

    _world() { return window.World; }

    // posição 3D atual (fixa na grade, ou screenX/Y se móvel)
    _worldPos() {
        if (this.mobile) {
            return [Coords.px(this.screenX), Coords.py(this.screenY)];
        }
        return [Coords.cellCX(this.x), Coords.cellCY(this.y)];
    }

    _updateModelTransform(initial) {
        const m = this.model;
        if (!m) return;
        const [wx, wz] = this._worldPos();
        m.position.set(wx, 0, wz);

        // escala por nível (leve, para "crescer" com upgrade)
        const sc = 1 + Math.min(this.level, 8) * 0.05;
        m.scale.setScalar(sc);

        // rotação: virar o cano para o alvo. No 2D usa-se angle (atan2 dy,dx).
        // No 3D o "ângulo" é no plano XZ. Convertemos com -angle no Z de rotação
        // (o modelo aponta o cano para +X local; rotacionamos em Y).
        const t = this.parts.turret;
        if (t) {
            // ângulo 2D (dx,dy) -> rotação em Y no 3D (eixo Y = para baixo no
            // plano XZ): rotação = -angle (inverte porque y cresce para baixo)
            t.rotation.y = -this.angle;
            if (this.parts.turretCan) this.parts.turretCan.position.x = -this.recoil * CONFIG.worldScale * 2;
        }
        if (this.type === 'robot' && this.parts.turret) this.parts.turret.rotation.y = -this.angle;
        if (this.type === 'radar' && this.parts.turret) this.parts.turret.rotation.y = -this.angle + Math.PI / 2;
    }

    // animações contínuas (hélices, pulso, rotação de disco) — por frame
    _animate(dt, time) {
        const p = this.parts;
        if (!p) return;
        // clarão de disparo
        if (p.flash) {
            const on = this.flashTimer > 0;
            p.flash.visible = on;
            if (on) {
                const k = 0.7 + Math.random() * 0.7;
                p.flash.scale.set(0.42 * k, 0.42 * k, 1);
            }
        }
        // cavaleiro: trote (pernas alternando) + bob do corpo
        if (this.type === 'knight') {
            const gp = this.gallopPhase || 0;
            if (p._legs) {
                for (let i = 0; i < p._legs.length; i++) {
                    const l = p._legs[i];
                    const off = (i % 2) * Math.PI;
                    l.rotation.x = Math.sin(gp * 30 + off) * 0.55;
                }
            }
            this.model.position.y = Math.abs(Math.sin(gp * 30)) * 0.045;
        }
        if (p.disc) p.disc.rotation.y += dt * 0.003;
        if (p.orbs && p._orbList) {
            const t = time * 0.0016;
            p._orbList.forEach((o, i) => {
                const a = t + (i / p._orbList.length) * Math.PI * 2;
                o.position.set(Math.cos(a) * 0.42, Math.sin(a * 2) * 0.12, Math.sin(a) * 0.42);
            });
        }
        if (p.orb) {
            const pulse = 0.6 + Math.sin(time * 0.01) * 0.25;
            if (p.glow) p.glow.scale.setScalar(0.85 + pulse * 0.4);
        }
        if (p.glow && this.type === 'radioactive') {
            p.glow.scale.setScalar(0.7 + Math.sin(time * 0.004) * 0.15);
        }
        if (this.type === 'laser' && p.field) {
            const flick = 0.28 + 0.12 * Math.sin(time * 0.005) + (this.recoil > 0 ? 0.25 : 0);
            p.field.material = MatFactory.glow('#ff3c3c', Math.min(0.7, flick));
        }
        if (this.isDrone && p._blades) {
            for (const b of p._blades) b.rotation.y += b.userData.spin * dt * 0.06;
        }
        if (this.type === 'knight' && p.sword) {
            const prog = this.swingTime > 0 ? this.swingTime / 220 : 0;
            const sw = prog > 0 ? Math.sin((1 - prog) * Math.PI) * 1.1 : 0;
            p.sword.rotation.x = -sw;
        }
        // frozen visual
        const frozen = this.frozenUntil > 0;
        if (p.torsoMat) {}
    }

    // ---------- níveis (idêntico ao 2D) ----------
    applyLevel() {
        const dmgMult = 1 + this.level * 0.55;
        const rangeMult = 1 + this.level * 0.12;
        const rateMult = Math.pow(0.82, this.level);
        this.damage = this.baseDamage * dmgMult * (this.hyper ? 10 : 1) * this.goldenMult;
        this.range = this.baseRange * rangeMult;
        this.fireRate = this.baseFireRate * rateMult;
    }

    getUpgradeCost(maxLevel) {
        if (this.level >= maxLevel) return 0;
        const factors = CONFIG.upgradeCostFactors;
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

    // ---------- update (lógica idêntica; no fim atualiza o modelo) ----------
    update(time, dt, zombies, projectiles, game) {
        this.recoil = Math.max(0, this.recoil - 0.5);
        if (this.flashTimer > 0) this.flashTimer -= dt * 0.06;

        if (this.frozenUntil > time) {
            if (!this._frozenVis) this.setFrozenVisual(true);
            this._updateModelTransform();
            this._animate(dt, time);
            return;
        }
        if (this.frozenUntil > 0) this.frozenUntil = 0;
        if (this._frozenVis) this.setFrozenVisual(false);

        if (this.isDrone) {
            this.updateDrone(time, dt, zombies, game);
            this._updateModelTransform();
            this._animate(dt, time);
            return;
        }
        if (this.mobile) {
            this.updateMobile(time, dt, zombies, game);
            this._updateModelTransform();
            this._animate(dt, time);
            return;
        }
        if (this.type === 'laser') {
            this.updateLaserWall(time, zombies, game);
            this._updateModelTransform();
            this._animate(dt, time);
            return;
        }
        if (this.type === 'mago') {
            this.updateMago(time, dt, zombies, game);
            this._updateModelTransform();
            this._animate(dt, time);
            return;
        }

        const target = this.findTarget(zombies);
        if (target) {
            const cx = this.x * CONFIG.gridSize + CONFIG.gridSize / 2;
            const cy = this.y * CONFIG.gridSize + CONFIG.gridSize / 2;
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
                this.flashTimer = 90;
                if (window.SFX) SFX.play(this.type === 'rocket' || this.type === 'radar' ? 'bigshot' : 'shot');
            }
        }
        this._updateModelTransform();
        this._animate(dt, time);
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

        if (this.carrying && (this.carrying.health <= 0 || this.carrying.reachedEnd || !zombies.includes(this.carrying))) {
            if (this.carrying) this.carrying.carried = false;
            this.carrying = null;
        }

        if (this.carrying) {
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

        let best = null, bestDist = Infinity;
        if (this.dropCooldown <= 0) {
            for (const z of zombies) {
                if (z.health <= 0 || z.carried || z.reachedEnd) continue;
                if (!ZOMBIE_STATS[z.type]?.flying) continue;
                if (z.abductions >= CONFIG.droneMaxAbductions) continue;
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
            moveToward(homeX, homeY);
        }
    }

    updateMobile(time, dt, zombies, game) {
        const stats = TOWER_STATS[this.type];
        const homeX = this.x * CONFIG.gridSize + CONFIG.gridSize / 2;
        const homeY = this.y * CONFIG.gridSize + CONFIG.gridSize / 2;

        if (this.targetZombie && (this.targetZombie.health <= 0 || this.targetZombie.reachedEnd)) {
            this.targetZombie = null;
        }

        const taken = new Set();
        if (game && game.towers) {
            for (const t of game.towers) {
                if (t !== this && t.mobile && t.targetZombie && t.targetZombie.health > 0) {
                    taken.add(t.targetZombie);
                }
            }
        }

        const alive = zombies.filter(z => z.health > 0);
        const overlapping = this.targetZombie && taken.has(this.targetZombie);
        const hasFree = alive.some(z => !taken.has(z));
        if (!this.targetZombie || (overlapping && hasFree)) {
            if (alive.length > 0) {
                const free = alive.filter(z => !taken.has(z));
                const pool = free.length > 0 ? free : alive;
                let best = null;
                let bestDist = Infinity;
                for (const z of pool) {
                    const ddx = z.screenX - this.screenX;
                    const ddy = z.screenY - this.screenY;
                    const d = ddx * ddx + ddy * ddy;
                    if (d < bestDist) { bestDist = d; best = z; }
                }
                this.targetZombie = best;
            }
        }
        const target = this.targetZombie;

        let tx, ty;
        if (target) { tx = target.screenX; ty = target.screenY; }
        else { tx = homeX; ty = homeY; }

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
                const cleaveR = (stats.cleaveRange || 0.9) * CONFIG.gridSize;
                const cleaveD = this.damage * (stats.cleaveFactor || 0.5);
                for (const z of zombies) {
                    if (z === target || z.health <= 0) continue;
                    const ddx = z.screenX - this.screenX;
                    const ddy = z.screenY - this.screenY;
                    if (ddx * ddx + ddy * ddy <= cleaveR * cleaveR) {
                        const zS = ZOMBIE_STATS[z.type];
                        if (!zS?.immuneTo?.includes(damageType)) z.applyDamage(cleaveD, game);
                    }
                }
                this.lastShot = time;
                this.swingTime = 220;
                this.recoil = 6;
                if (window.SFX) SFX.play('splat');
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
            if (!nStats?.immuneTo?.includes(damageType)) next.applyDamage(dmg, game);
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
        if (window.SFX) SFX.play('zap');
    }

    fireRadioactive(cx, cy, zombies, projectiles, game) {
        const radius = this.range;
        const damageType = TOWER_STATS.radioactive.damageType;
        for (const z of zombies) {
            if (z.health <= 0) continue;
            const dx = z.screenX - cx, dy = z.screenY - cy;
            if (dx * dx + dy * dy <= radius * radius) {
                const zStats = ZOMBIE_STATS[z.type];
                if (zStats?.immuneTo?.includes(damageType)) {
                    if (game) game.floatingTexts.push({ x: z.screenX, y: z.screenY - 18, text: 'imune!', color: '#aaa', life: 40 });
                } else {
                    z.applyDamage(this.damage, game);
                }
            }
        }
        const bolt = new Projectile(cx, cy, null, 0, 'radioactive');
        bolt.dead = false;
        bolt.lifeMs = 0;
        bolt.radioactiveDisk = { r: radius, maxLife: 900 };
        projectiles.push(bolt);
        if (window.SFX) SFX.play('zap');
        if (window.FX && FX._layer) FX.ring(Coords.px(cx), 0.1, Coords.py(cy), '#f5d900', Coords.len(radius) * 1.05, 450);
    }

    updateLaserWall(time, zombies, game) {
        if (!this.laserHits) this.laserHits = new Map();
        const cx = this.x * CONFIG.gridSize + CONFIG.gridSize / 2;
        const cy = this.y * CONFIG.gridSize + CONFIG.gridSize / 2;
        const r2 = this.range * this.range;
        const damageType = TOWER_STATS.laser.damageType;
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
        if (hitAny) {
            this.recoil = 6;
            if (window.SFX) SFX.play('laser');
        }
        for (const z of this.laserHits.keys()) {
            if (z.health <= 0 || !zombies.includes(z)) this.laserHits.delete(z);
        }
    }

    updateMago(time, dt, zombies, game) {
        if (this._moveTimer === undefined) this._moveTimer = 10000;
        this._moveTimer -= dt;
        if (this._moveTimer <= 0 && game) {
            this._moveTimer = 10000;
            game.grid[this.x][this.y] = 0;
            let moved = false;
            for (let attempt = 0; attempt < 30; attempt++) {
                const nx = Math.floor(Math.random() * CONFIG.cols);
                const ny = Math.floor(Math.random() * CONFIG.rows);
                if (game.grid[nx][ny] !== 0) continue;
                if (nx === game.start.x && ny === game.start.y) continue;
                if (nx === game.end.x && ny === game.end.y) continue;
                game.grid[nx][ny] = 1;
                const path = game.findPath();
                let ok = !!path;
                if (ok) {
                    for (const z of zombies) {
                        if (ZOMBIE_STATS[z.type]?.flying) continue;
                        const gx = Math.floor(z.screenX / CONFIG.gridSize);
                        const gy = Math.floor(z.screenY / CONFIG.gridSize);
                        if (gx === nx && gy === ny) { ok = false; break; }
                        if (!game.findPath(gx, gy)) { ok = false; break; }
                    }
                }
                if (!ok) { game.grid[nx][ny] = 0; continue; }
                this.x = nx; this.y = ny;
                game.updatePath();
                for (const z of zombies) z.recalcPath(game);
                game.floatingTexts.push({ x: nx * CONFIG.gridSize + CONFIG.gridSize / 2, y: ny * CONFIG.gridSize, text: '✦ teleporte!', color: '#9b59b6', life: 60 });
                moved = true;
                break;
            }
            if (!moved) game.grid[this.x][this.y] = 1;
        }

        const cx = this.x * CONFIG.gridSize + CONFIG.gridSize / 2;
        const cy = this.y * CONFIG.gridSize + CONFIG.gridSize / 2;
        const r2 = this.range * this.range;

        if (time - this.lastShot >= this.fireRate) {
            let target = null;
            let bestProgress = -1;
            for (const z of zombies) {
                if (z.health <= 0) continue;
                const dx = z.screenX - cx, dy = z.screenY - cy;
                if (dx * dx + dy * dy > r2) continue;
                if (z.pathIndex > bestProgress) { bestProgress = z.pathIndex; target = z; }
            }
            if (target) {
                if (ZOMBIE_STATS[target.type]?.freezesTowers && !target.iceArmorBroken) target.iceArmorBroken = true;
                target.applyDamage(this.damage, game);
                this.recoil = 6;
                if (window.SFX) SFX.play('magic');
                if (window.FX && FX._layer) FX.burst(Coords.px(target.screenX), 0.5, Coords.py(target.screenY), {
                    color: '#b050ff', count: 7, size: 0.1, speed: 0.3, up: 0.5, gravity: -0.3, life: 400
                });
            }
            this.lastShot = time;
        }

        if (!game) return;
        const maxLevel = getMaxLevel(game.round);
        if (this.level < maxLevel) return;

        if (this._ultimateTimer === undefined) this._ultimateTimer = 0;
        this._ultimateTimer -= dt;
        if (this._ultimateTimer > 0) return;
        this._ultimateTimer = 45000;

        for (const z of zombies) {
            z.slowTimer = 3000;
            z.speed = 0;
        }

        let teleported = 0;
        for (const z of zombies) {
            if (!z.path || z.path.length < 4) continue;
            if (z.pathIndex >= Math.floor(z.path.length * 0.30)) {
                z.pathIndex = Math.min(2, z.path.length - 1);
                const node = z.path[z.pathIndex];
                z.screenX = node.x * CONFIG.gridSize + CONFIG.gridSize / 2;
                z.screenY = node.y * CONFIG.gridSize + CONFIG.gridSize / 2;
                teleported++;
            }
        }

        if (game) {
            game.floatingTexts.push({ x: cx, y: cy - 35, text: '✦ ULTIMATE! ✦', color: '#c39bd3', life: 100 });
            if (teleported > 0) {
                game.floatingTexts.push({ x: cx, y: cy - 55, text: `↺ ${teleported} teletransportados`, color: '#9b59b6', life: 100 });
            }
        }
    }

    findChainTarget(zombies, fromZ, exclude, range) {
        let best = null, bestDist = Infinity;
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
        const cx = this.x * CONFIG.gridSize + CONFIG.gridSize / 2;
        const cy = this.y * CONFIG.gridSize + CONFIG.gridSize / 2;
        let best = null, bestProgress = -1;
        for (const z of zombies) {
            if (z.health <= 0) continue;
            if (stats.ignoresFlying && ZOMBIE_STATS[z.type].flying) continue;
            const dx = cx - z.screenX, dy = cy - z.screenY;
            if (dx * dx + dy * dy > this.range * this.range) continue;
            if (z.pathIndex > bestProgress) { bestProgress = z.pathIndex; best = z; }
        }
        return best;
    }

    // ---------- indicadores 3D (golden/hyper/level) ----------
    refreshIndicators() {
        const p = this.parts;
        if (!p) return;
        // remove indicadores antigos
        if (this.indicators) this.model.remove(this.indicators);
        const g = new THREE.Group();
        g.position.y = 0.95;
        if (this.golden) {
            const ring = mesh(GeomFactory.tor(0.4, 0.03, 20, 8), MatFactory.glow('#f1c40f', 0.9));
            ring.rotation.x = -Math.PI / 2; g.add(ring);
        }
        if (this.hyper) {
            const ring = mesh(GeomFactory.tor(0.44, 0.03, 20, 8), MatFactory.glow('#9b59b6', 0.9));
            ring.rotation.x = -Math.PI / 2; g.add(ring);
        }
        // estrelas de nível (octaedros dourados flutuando)
        for (let i = 0; i < this.level; i++) {
            const st = mesh(GeomFactory.octa(0.05), MatFactory.glow('#f1c40f'));
            st.position.set((i - (this.level - 1) / 2) * 0.13, 0.18, 0);
            g.add(st);
        }
        this.model.add(g);
        this.indicators = g;
        // escala extra
        const sc = 1 + Math.min(this.level, 8) * 0.05;
        this.model.scale.setScalar(sc);
    }

    setFrozenVisual(frozen) {
        this._frozenVis = !!frozen;
        if (this._iceVisual) { this.model.remove(this._iceVisual); this._iceVisual = null; }
        if (!frozen) return;
        const ice = sphAt(0.4, 0, 0.45, 0, MatFactory.mat('#87cefa', { transparent: true, opacity: 0.45 }));
        this.model.add(ice);
        this._iceVisual = ice;
    }

    dispose() {
        if (this.model) this._world().remove(this.model);
    }
}
