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

        // zumbi de gelo congela torres ao passar (cavaleiros, parede laser e mago são imunes)
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