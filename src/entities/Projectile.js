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