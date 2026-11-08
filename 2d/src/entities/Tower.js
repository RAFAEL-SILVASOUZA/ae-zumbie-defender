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

        if (this.type === 'mago') {
            this.updateMago(time, dt, zombies, game);
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

    updateMago(time, dt, zombies, game) {
        // teleporta para célula aleatória a cada 10 s
        if (this._moveTimer === undefined) this._moveTimer = 10000;
        this._moveTimer -= dt;
        if (this._moveTimer <= 0 && game) {
            this._moveTimer = 10000;
            // libera célula atual
            game.grid[this.x][this.y] = 0;
            // tenta até 30 células aleatórias
            let moved = false;
            for (let attempt = 0; attempt < 30; attempt++) {
                const nx = Math.floor(Math.random() * CONFIG.cols);
                const ny = Math.floor(Math.random() * CONFIG.rows);
                if (game.grid[nx][ny] !== 0) continue;
                if (nx === game.start.x && ny === game.start.y) continue;
                if (nx === game.end.x   && ny === game.end.y)   continue;
                // verifica se não bloqueia o caminho
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
                // move
                this.x = nx;
                this.y = ny;
                game.updatePath();
                for (const z of zombies) z.recalcPath(game);
                game.floatingTexts.push({ x: nx * CONFIG.gridSize + CONFIG.gridSize/2, y: ny * CONFIG.gridSize, text: '✦ teleporte!', color: '#9b59b6', life: 60 });
                moved = true;
                break;
            }
            if (!moved) game.grid[this.x][this.y] = 1; // restaura se não achou lugar
        }

        const cx = this.x * CONFIG.gridSize + CONFIG.gridSize / 2;
        const cy = this.y * CONFIG.gridSize + CONFIG.gridSize / 2;
        const r2 = this.range * this.range;

        // ataca UM zumbi por vez (o mais avançado no caminho), ignora imunidades
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
                if (ZOMBIE_STATS[target.type]?.freezesTowers && !target.iceArmorBroken) {
                    target.iceArmorBroken = true;
                }
                target.applyDamage(this.damage, game);
                this.recoil = 6;
            }
            this.lastShot = time;
        }

        // ── ULTIMATE: apenas no nível máximo ──
        if (!game) return;
        const maxLevel = getMaxLevel(game.round);
        if (this.level < maxLevel) return;

        if (this._ultimateTimer === undefined) this._ultimateTimer = 0;
        this._ultimateTimer -= dt;
        if (this._ultimateTimer > 0) return;
        this._ultimateTimer = 45000; // 45 s de cooldown

        // 1) Para TODOS os zombies por 3 s (ignora slowImmune)
        for (const z of zombies) {
            z.slowTimer = 3000;
            z.speed = 0;
        }

        // 2) Teleporta zombies nos últimos 70% do caminho de volta ao início
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
            case 'mago':       this.drawMago(ctx); break;
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

        // bandeira no ponto de partida do cavaleiro
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

    drawMago(ctx) {
        const t = performance.now() * 0.001;
        const bob = Math.sin(t * 1.8) * 4; // flutua para cima e para baixo

        // aura mágica pulsante no chão
        const auraR = 22 + Math.sin(t * 2.5) * 4;
        const grad = ctx.createRadialGradient(0, 8, 2, 0, 8, auraR);
        grad.addColorStop(0, 'rgba(180, 80, 255, 0.55)');
        grad.addColorStop(1, 'rgba(100, 0, 200, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.ellipse(0, 8, auraR, auraR * 0.4, 0, 0, Math.PI * 2); ctx.fill();

        ctx.save();
        ctx.translate(0, bob);

        // ── orbs elementais orbitando ──
        const elements = [
            { color: '#e74c3c', r: 3 },   // fogo
            { color: '#3498db', r: 3 },   // gelo
            { color: '#2ecc71', r: 3 },   // veneno
            { color: '#f1c40f', r: 3 },   // raio
            { color: '#ecf0f1', r: 3 },   // sagrado
        ];
        const orbR = 19;
        elements.forEach((el, i) => {
            const angle = t * 1.6 + (i / elements.length) * Math.PI * 2;
            const ox = Math.cos(angle) * orbR;
            const oy = Math.sin(angle) * orbR * 0.45;
            ctx.fillStyle = el.color;
            ctx.shadowColor = el.color;
            ctx.shadowBlur = 8;
            ctx.beginPath(); ctx.arc(ox, oy, el.r, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;
        });

        // ── manto / robe ──
        ctx.fillStyle = '#4a0080';
        ctx.strokeStyle = '#9b59b6';
        ctx.lineWidth = 1.5;
        // base larga do manto
        ctx.beginPath();
        ctx.moveTo(-10, 2);
        ctx.lineTo(-13, 16);
        ctx.lineTo(13, 16);
        ctx.lineTo(10, 2);
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        // corpo
        ctx.fillStyle = '#6c3483';
        ctx.strokeStyle = '#9b59b6';
        roundRect(ctx, -8, -10, 16, 14, 3);
        ctx.fill(); ctx.stroke();

        // braço com cajado
        ctx.fillStyle = '#6c3483';
        ctx.fillRect(8, -8, 5, 10);
        // cajado
        ctx.strokeStyle = '#8b4513';
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(12, -8); ctx.lineTo(14, -24); ctx.stroke();
        // cristal no topo do cajado
        const crystalGlow = 0.6 + 0.4 * Math.sin(t * 4);
        ctx.fillStyle = `rgba(180, 80, 255, ${crystalGlow})`;
        ctx.strokeStyle = '#e8d5ff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(14, -29); ctx.lineTo(11, -24); ctx.lineTo(17, -24);
        ctx.closePath(); ctx.fill(); ctx.stroke();

        // braço esquerdo
        ctx.fillStyle = '#6c3483';
        ctx.fillRect(-13, -8, 5, 8);

        // cabeça
        ctx.fillStyle = '#f5cba7';
        ctx.strokeStyle = '#d4a574';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(0, -16, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

        // chapéu de mago
        ctx.fillStyle = '#4a0080';
        ctx.strokeStyle = '#9b59b6';
        ctx.lineWidth = 1.5;
        // aba
        ctx.beginPath(); ctx.ellipse(0, -22, 12, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        // cone
        ctx.beginPath();
        ctx.moveTo(-7, -22); ctx.lineTo(0, -38); ctx.lineTo(7, -22);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        // estrela no chapéu
        ctx.fillStyle = '#f1c40f';
        ctx.font = '7px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('★', 0, -28);

        // olhos
        ctx.fillStyle = '#9b59b6';
        ctx.beginPath(); ctx.arc(-3, -17, 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(3, -17, 2, 0, Math.PI * 2); ctx.fill();

        ctx.restore();

        // anel de teleporte quando ultimate pronto (timer <= 0)
        if (this._ultimateTimer !== undefined && this._ultimateTimer <= 0) {
            const ringR = 26 + Math.sin(t * 6) * 3;
            ctx.strokeStyle = `rgba(155, 89, 182, ${0.5 + 0.5 * Math.sin(t * 8)})`;
            ctx.lineWidth = 3;
            ctx.setLineDash([6, 4]);
            ctx.beginPath(); ctx.arc(0, 4 + bob, ringR, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);
        }
    }

}