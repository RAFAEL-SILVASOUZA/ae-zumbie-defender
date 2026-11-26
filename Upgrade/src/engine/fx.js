/**
 * FX — partículas e efeitos 3D leves, com pool (nada é alocado por frame
 * além do estritamente necessário). Tudo em coordenadas de MUNDO (converta
 * com Coords.px/py do lado de quem chama).
 *
 * API:
 *   FX.burst(x, y, z, opts)      — rajada de partículas (goo, poeira, fagulhas)
 *   FX.ring(x, y, z, color, r)   — anel que expande (explosões, ondas)
 *   FX.flash(x, y, z, color, s)  — clarão único curto
 *   FX.update(dtMs)              — chame 1x por frame
 */
const FX = {
    _layer: null,
    _pool: [],
    _live: [],
    _rings: [],
    _softTex: null,

    init(layer) {
        this._layer = layer;
        this._softTex = MatFactory.dotTex(); // textura de bolha suave compartilhada
    },

    _makeParticle() {
        const mat = new THREE.SpriteMaterial({
            map: this._softTex, transparent: true, opacity: 1,
            depthWrite: false, blending: THREE.AdditiveBlending
        });
        const s = new THREE.Sprite(mat);
        s.visible = false;
        this._layer.add(s);
        return s;
    },

    /**
     * Rajada de partículas.
     * opts: color, count, size, spread (raio inicial), speed, up, gravity,
     *       drag, life (ms), grow (multiplicador de escala ao longo da vida),
     *       blending ('add' | 'normal')
     */
    burst(x, y, z, opts) {
        if (!this._layer) return;
        const o = opts || {};
        const count = Math.min(o.count || 6, 14);
        for (let i = 0; i < count; i++) {
            const p = this._pool.pop() || this._makeParticle();
            const a = Math.random() * Math.PI * 2;
            const r = Math.random() * (o.spread || 0.2);
            const spd = (o.speed || 0.35) * (0.5 + Math.random() * 0.8);
            const up = (o.up != null ? o.up : 0.6);
            p.position.set(x + Math.cos(a) * r, y + Math.random() * 0.1, z + Math.sin(a) * r);
            p.userData.vel = new THREE.Vector3(Math.cos(a) * spd, up * spd * 2.2, Math.sin(a) * spd);
            p.userData.life = 0;
            p.userData.maxLife = (o.life || 400) * (0.7 + Math.random() * 0.6);
            p.userData.grow = o.grow != null ? o.grow : 1.4;
            p.userData.gravity = o.gravity != null ? o.gravity : 2.0;
            p.userData.drag = o.drag != null ? o.drag : 1.5;
            const size = (o.size || 0.08) * (0.7 + Math.random() * 0.6);
            p.scale.set(size, size, 1);
            p.userData.size = size;
            p.material.color.set(o.color || '#ffffff');
            p.material.blending = o.blending === 'normal' ? THREE.NormalBlending : THREE.AdditiveBlending;
            p.material.opacity = 1;
            p.visible = true;
            this._live.push(p);
        }
    },

    /** Anel expansivo no plano do chão (raio final em unidades 3D). */
    ring(x, y, z, color, rFinal, lifeMs) {
        if (!this._layer) return;
        const geo = GeomFactory._get('ringFx', () => new THREE.RingGeometry(0.62, 1, 28));
        const mat = new THREE.MeshBasicMaterial({
            color, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false
        });
        const m = new THREE.Mesh(geo, mat);
        m.position.set(x, y, z);
        m.rotation.x = -Math.PI / 2;
        m.renderOrder = 5;
        this._layer.add(m);
        this._rings.push({ m, t: 0, life: lifeMs || 500, r: rFinal });
    },

    /** Clarão único (muzzle flash, impacto). */
    flash(x, y, z, color, size, lifeMs) {
        this.burst(x, y, z, {
            color, count: 1, size: size || 0.28, speed: 0.001, up: 0,
            gravity: 0, drag: 0, life: lifeMs || 90, grow: 1.8
        });
    },

    update(dtMs) {
        // partículas
        for (let i = this._live.length - 1; i >= 0; i--) {
            const p = this._live[i];
            const d = p.userData;
            d.life += dtMs;
            if (d.life >= d.maxLife) {
                p.visible = false;
                this._live.splice(i, 1);
                if (this._pool.length < 160) this._pool.push(p);
                continue;
            }
            const k = d.life / d.maxLife;
            const v = d.vel;
            // integração simples com gravidade e arrasto
            v.y -= d.gravity * dtMs * 0.001;
            const damp = Math.max(0, 1 - d.drag * dtMs * 0.001);
            v.multiplyScalar(damp);
            p.position.addScaledVector(v, dtMs * 0.001);
            const sc = d.size * (1 + (d.grow - 1) * k);
            p.scale.set(sc, sc, 1);
            p.material.opacity = Math.max(0, 1 - k * k);
        }
        // anéis
        for (let i = this._rings.length - 1; i >= 0; i--) {
            const r = this._rings[i];
            r.t += dtMs;
            const k = r.t / r.life;
            if (k >= 1) {
                this._layer.remove(r.m);
                r.m.material.dispose();
                this._rings.splice(i, 1);
                continue;
            }
            const sc = Math.max(0.001, r.r * (0.15 + 0.85 * k));
            r.m.scale.set(sc, sc, 1);
            r.m.material.opacity = 0.55 * (1 - k);
        }
    }
};
// scripts clássicos com `const` não criam propriedade em window — expõe
// explicitamente para os guards `window.FX` das entidades funcionarem
window.FX = FX;
