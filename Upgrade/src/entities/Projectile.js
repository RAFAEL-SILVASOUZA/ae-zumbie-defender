/**
 * Projectile (versão 3D).
 * update() e onHit() são IDÊNTICOS ao Projectile.js 2D (velocidades, splash,
 * veneno que quebra gelo, cadeia da tesla, disco radioativo). A renderização
 * passa a ser meshes: esfera do tiro, raio (LineSegments) da tesla, esfera
 * expandindo da explosão e anel giratório do radioativo.
 *
 * As posições lógicas (x,y em px) continuam as mesmas; o mundo 3D é derivado.
 */
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
        this.chainPoints = null;
        this.lifetimeMs = null;
        this.radioactiveDisk = null;
        this._build();
    }

    _world() { return window.World; }

    _color() {
        switch (this.type) {
            case 'spike': return '#9ca3a8';
            case 'pistol': return '#34495e';
            case 'machinegun': return '#34495e';
            case 'poison': return '#7ed321';
            case 'radar': return '#c0392b';
            case 'robot': return '#27ae60';
            case 'rocket': return '#c0392b';
            default: return '#34495e';
        }
    }

    _radius() {
        switch (this.type) {
            case 'spike': return 0.06;
            case 'poison': return 0.1;
            case 'rocket': return 0.1;
            case 'machinegun': return 0.05;
            case 'radar': return 0.07;
            default: return 0.07;
        }
    }

    _build() {
        // tesla e radioativo recebem seus dados especiais logo DEPOIS do
        // construtor (em fireTesla/fireRadioactive). Por isso o visual 3D
        // deles é criado sob demanda no update() (ver _buildChain/_buildDisk).
        if (this.type === 'tesla' || this.type === 'radioactive') { this.obj = null; return; }
        const W = this._world();
        // projétil comum: esfera emissiva
        this.obj = mesh(GeomFactory.sph(this._radius()), MatFactory.glow(this._color()));
        this.obj.position.set(Coords.px(this.x), 0.45, Coords.py(this.y));
        W.add(this.obj);
        // foguete com rastro
        if (this.type === 'rocket') {
            const trail = new THREE.Sprite(MatFactory.spriteTex('#f1c40f'));
            trail.scale.set(0.3, 0.3, 1);
            trail.position.set(Coords.px(this.x), 0.45, Coords.py(this.y));
            W.add(trail);
            this.trail = trail;
        }
    }

    _buildChain() {
        if (this.lineGeo) return;
        this.lineGeo = new THREE.BufferGeometry();
        this.lineMat = new THREE.LineBasicMaterial({ color: 0x7ec8ff, transparent: true, opacity: 1 });
        this.obj = new THREE.Line(this.lineGeo, this.lineMat);
        this.obj.frustumCulled = false;
        this._world().add(this.obj);
    }
    _buildDisk() {
        if (this.obj) return;
        const r = Coords.len(this.radioactiveDisk.r);
        const geo = GeomFactory._get(`ringshot:${r.toFixed(2)}`, () => new THREE.RingGeometry(r * 0.2, r, 32));
        const mat = new THREE.MeshBasicMaterial({ color: 0xf5d900, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false });
        this.obj = new THREE.Mesh(geo, mat);
        this.obj.rotation.x = -Math.PI / 2;
        this.obj.position.set(Coords.px(this.x), 0.12, Coords.py(this.y));
        this.obj.renderOrder = 5;
        this._world().add(this.obj);
    }

    update(zombies, dt, game) {
        if (this.chainPoints) {
            this._buildChain();
            this.lifeMs += dt;
            this._updateChain();
            if (this.lifeMs >= this.lifetimeMs) this.dead = true;
            return;
        }
        if (this.radioactiveDisk) {
            this._buildDisk();
            this.lifeMs += dt;
            const a = 1 - (this.lifeMs / this.radioactiveDisk.maxLife);
            if (this.obj) this.obj.material.opacity = Math.max(0, a * 0.4);
            if (this.obj) this.obj.rotation.z += dt * 0.004;
            if (this.lifeMs >= this.radioactiveDisk.maxLife) this.dead = true;
            return;
        }
        if (this.explosion) {
            this.explosion.r += dt * 0.55;
            this._updateExplosion();
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
        if (this.obj && !this.explosion) {
            this.obj.position.set(Coords.px(this.x), 0.45, Coords.py(this.y));
        }
        if (this.trail) {
            this.trail.position.set(Coords.px(this.x), 0.45, Coords.py(this.y));
        }
    }

    onHit(zombies, game) {
        const damageType = TOWER_STATS[this.type]?.damageType;
        if (this.type === 'rocket') {
            const radius = TOWER_STATS.rocket.splashRadius * CONFIG.gridSize;
            for (const z of zombies) {
                const ddx = z.screenX - this.x, ddy = z.screenY - this.y;
                if (ddx * ddx + ddy * ddy <= radius * radius) {
                    const zStats = ZOMBIE_STATS[z.type];
                    if (zStats?.immuneTo?.includes(damageType)) {
                        if (game) game.floatingTexts.push({ x: z.screenX, y: z.screenY - 18, text: 'imune!', color: '#aaa', life: 40 });
                    } else {
                        z.applyDamage(this.damage, game);
                    }
                }
            }
            this.explosion = { r: 0, max: radius };
            if (this.obj) this._world().remove(this.obj);
            if (this.trail) this._world().remove(this.trail);
            this.trail = null;
            this.obj = null;
            this._buildExplosion();
        } else if (this.type === 'poison') {
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

    _buildExplosion() {
        const geo = GeomFactory.sph(1);
        this.expObj = mesh(geo, new THREE.MeshBasicMaterial({ color: 0xe67e22, transparent: true, opacity: 0.9, depthWrite: false }));
        this.expObj.position.set(Coords.px(this.x), 0.35, Coords.py(this.y));
        this._world().add(this.expObj);
    }
    _updateExplosion() {
        if (!this.expObj) return;
        const a = 1 - (this.explosion.r / this.explosion.max);
        const s = Coords.len(this.explosion.r);
        this.expObj.scale.setScalar(s);
        this.expObj.material.opacity = Math.max(0, a * 0.9);
    }
    _updateChain() {
        const pts = this.chainPoints;
        const arr = [];
        for (const p of pts) arr.push(Coords.px(p.x), 0.5, Coords.py(p.y));
        this.lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
        this.lineGeo.attributes.position.needsUpdate = true;
        const a = 1 - (this.lifeMs / this.lifetimeMs);
        this.lineMat.opacity = Math.max(0, a);
    }

    dispose() {
        const W = this._world();
        if (this.obj) W.remove(this.obj);
        if (this.trail) W.remove(this.trail);
        if (this.expObj) W.remove(this.expObj);
        if (this.lineGeo) this.lineGeo.dispose();
        if (this.lineMat) this.lineMat.dispose();
    }
}
