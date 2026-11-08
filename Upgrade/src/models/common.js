/**
 * Fábrica de recursos 3D compartilhados.
 * Para rodar bem no celular, TODAS as geometrias e materiais são memoizados
 * (uma instância de geometria/mesma cor é reutilizada por todos os modelos).
 */
const MatFactory = {
    _cache: new Map(),
    // material fosco barato (Lambert) com suporte a emissive
    mat(hex, opts = {}) {
        const key = `l:${hex}:${opts.emissive || ''}:${opts.emissiveIntensity || 0}:${opts.opacity != null ? opts.opacity : 1}:${opts.transparent ? 1 : 0}:${opts.flatShading ? 1 : 0}:${opts.side || 0}`;
        let m = this._cache.get(key);
        if (m) return m;
        m = new THREE.MeshLambertMaterial({
            color: new THREE.Color(hex),
            emissive: new THREE.Color(opts.emissive || '#000000'),
            emissiveIntensity: opts.emissiveIntensity != null ? opts.emissiveIntensity : 1,
            transparent: !!opts.transparent,
            opacity: opts.opacity != null ? opts.opacity : 1,
            flatShading: !!opts.flatShading,
            side: opts.side || THREE.FrontSide
        });
        this._cache.set(key, m);
        return m;
    },
    // material NÃO compartilhado (para cores que mudam por instância, ex.: tint de zumbi)
    matUncached(hex, opts = {}) {
        return new THREE.MeshLambertMaterial({
            color: new THREE.Color(hex),
            emissive: new THREE.Color(opts.emissive || '#000000'),
            emissiveIntensity: opts.emissiveIntensity != null ? opts.emissiveIntensity : 1,
            transparent: !!opts.transparent,
            opacity: opts.opacity != null ? opts.opacity : 1,
            flatShading: !!opts.flatShading,
            side: opts.side || THREE.FrontSide
        });
    },
    // material emissivo puro (sem receber luz) para raios/núcleos brilhantes
    glow(hex, opacity = 1) {
        const key = `g:${hex}:${opacity}`;
        let m = this._cache.get(key);
        if (m) return m;
        m = new THREE.MeshBasicMaterial({
            color: new THREE.Color(hex),
            transparent: opacity < 1,
            opacity: opacity,
            depthWrite: opacity >= 1
        });
        this._cache.set(key, m);
        return m;
    },
    spriteTex(hex) {
        const key = `s:${hex}`;
        let m = this._cache.get(key);
        if (m) return m;
        const c = document.createElement('canvas'); c.width = c.height = 64;
        const g = c.getContext('2d');
        const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        grd.addColorStop(0, hex);
        grd.addColorStop(0.4, hex);
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grd; g.beginPath(); g.arc(32, 32, 32, 0, Math.PI * 2); g.fill();
        const tex = new THREE.CanvasTexture(c);
        m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
        this._cache.set(key, m);
        return m;
    }
};

const GeomFactory = {
    _cache: new Map(),
    _get(key, make) {
        let g = this._cache.get(key);
        if (!g) { g = make(); this._cache.set(key, g); }
        return g;
    },
    box(w, h, d) { return this._get(`box:${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)); },
    sph(r, w = 12, h = 8) { return this._get(`sph:${r},${w},${h}`, () => new THREE.SphereGeometry(r, w, h)); },
    cyl(rt, rb, h, seg = 10) { return this._get(`cyl:${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)); },
    cone(r, h, seg = 10) { return this._get(`cone:${r},${h},${seg}`, () => new THREE.ConeGeometry(r, h, seg)); },
    cap(r, len) { return this._get(`cap:${r},${len}`, () => new THREE.CapsuleGeometry(r, len, 4, 8)); },
    tor(r, t, seg = 12, ti = 8) { return this._get(`tor:${r},${t}`, () => new THREE.TorusGeometry(r, t, ti, seg)); },
    ring(ri, ro, seg = 24) { return this._get(`ring:${ri},${ro}`, () => new THREE.RingGeometry(ri, ro, seg)); },
    plane(w, h) { return this._get(`plane:${w},${h}`, () => new THREE.PlaneGeometry(w, h)); },
    icosa(r, d = 0) { return this._get(`ico:${r},${d}`, () => new THREE.IcosahedronGeometry(r, d)); },
    octa(r) { return this._get(`octa:${r}`, () => new THREE.OctahedronGeometry(r)); }
};

// helpers de montagem
function mesh(geo, mat) {
    const m = new THREE.Mesh(geo, mat);
    return m;
}
// corpo: caixa posicionada pela base
function boxAt(w, h, d, x, y, z, mat) {
    const m = mesh(GeomFactory.box(w, h, d), mat);
    m.position.set(x, y, z);
    return m;
}
function sphAt(r, x, y, z, mat) {
    const m = mesh(GeomFactory.sph(r), mat);
    m.position.set(x, y, z);
    return m;
}
// sombra falsa: elipse plana escura no chão
function fakeShadow(radius) {
    const geo = GeomFactory._get(`shadow:${radius}`, () => new THREE.CircleGeometry(radius, 16));
    const key = `shadowmat:${radius}`;
    let mat = MatFactory._cache.get(key);
    if (!mat) {
        mat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.24, depthWrite: false });
        MatFactory._cache.set(key, mat);
    }
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.012;
    m.renderOrder = -1;
    return m;
}

const Models = {
    shadow: fakeShadow
};
