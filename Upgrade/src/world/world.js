/**
 * World3D: constrói a cena three.js (renderer, luzes, chão de "papel",
 * grade e um céu ambiente). Também expõe helpers para o overlay 3D que
 * substitui os desenhos de canvas 2D (hover da célula, barra de vida, textos).
 *
 * A renderização usa MeshLambert + luz hemisférica/direcional (barato e
 * suave o suficiente para celular). Sombras projetadas ficam desligadas por
 * padrão por performance; cada entidade usa uma sombra falsa (elipse).
 */
class World3D {
    constructor(canvas) {
        this.canvas = canvas;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.setClearColor(0x1c0e06, 1);

        this.scene = new THREE.Scene();
        // névoa só no fundo distante, para não escurecer o tabuleiro
        this.scene.fog = new THREE.Fog(0x1c0e06, 60, 140);

        this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
        this.scene.add(this.camera);

        this.boardW = CONFIG.cols;
        this.boardH = CONFIG.rows;

        this._buildLights();
        this._buildGround();
        this._buildDecor();

        // camada de entidades (torres, zumbis, projéteis)
        this.entityLayer = new THREE.Group();
        this.scene.add(this.entityLayer);

        // camada de efeitos (hover, ranges, textos 3D)
        this.fxLayer = new THREE.Group();
        this.scene.add(this.fxLayer);

        window.World = this;
    }

    _buildLights() {
        const hemi = new THREE.HemisphereLight(0xfff3e0, 0x6b4a2a, 0.9);
        this.scene.add(hemi);
        const dir = new THREE.DirectionalLight(0xffffff, 0.85);
        dir.position.set(4, 10, 6);
        this.scene.add(dir);
        const fill = new THREE.DirectionalLight(0xffd9a0, 0.25);
        fill.position.set(-6, 4, -4);
        this.scene.add(fill);
    }

    _buildGround() {
        this.groundGroup = new THREE.Group();
        this.scene.add(this.groundGroup);
        this._rebuildGround();
    }

    // Reconstrói o tabuleiro quando cols/rows mudam (relayout pré-partida).
    _rebuildGround() {
        // limpa geometria anterior
        for (let i = this.groundGroup.children.length - 1; i >= 0; i--) {
            this.groundGroup.remove(this.groundGroup.children[i]);
        }
        const cols = CONFIG.cols, rows = CONFIG.rows, gs = CONFIG.gridSize;
        Coords.recenter(); // garante origem centralizada independentemente da ordem
        // extensão total do tabuleiro em unidades 3D: cols*célula, onde
        // 1 célula (gridSize px) = 1 unidade (worldScale = 1/gridSize)
        this.boardW = cols * gs * CONFIG.worldScale;
        this.boardH = rows * gs * CONFIG.worldScale;

        // base de "papel" levemente elevada com borda (efeito de tabuleiro),
        // com microtextura (ruído + pontinhos) para não ficar chapado
        const gtex = World3D._groundTex();
        gtex.repeat.set(this.boardW / 4, this.boardH / 4);
        const padMat = new THREE.MeshLambertMaterial({ color: new THREE.Color('#e8d5a8'), map: gtex });
        const pad = mesh(GeomFactory.plane(this.boardW, this.boardH), padMat);
        pad.rotation.x = -Math.PI / 2;
        pad.position.y = 0;
        this.groundGroup.add(pad);

        // moldura de madeira ao redor do campo
        const frameMat = MatFactory.mat('#5a2f10', { flatShading: true });
        const t = 0.25, halfX = this.boardW / 2, halfZ = this.boardH / 2;
        const mk = (w, d, x, z) => {
            const m = boxAt(w, 0.3, d, x, 0.15, z, frameMat);
            this.groundGroup.add(m);
        };
        mk(this.boardW + t * 2, t, 0, -halfZ - t / 2);
        mk(this.boardW + t * 2, t, 0, halfZ + t / 2);
        mk(t, this.boardH, -halfX - t / 2, 0);
        mk(t, this.boardH, halfX + t / 2, 0);

        // linhas da grade (LineSegments) na cor original, discretas
        const pts = [];
        for (let x = 0; x <= cols; x++) {
            const wx = x * gs * CONFIG.worldScale - Coords.offX;
            pts.push(wx, 0.02, -halfZ, wx, 0.02, halfZ);
        }
        for (let y = 0; y <= rows; y++) {
            const wz = y * gs * CONFIG.worldScale - Coords.offZ;
            pts.push(-halfX, 0.02, wz, halfX, 0.02, wz);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
        const gridMat = new THREE.LineBasicMaterial({ color: 0x5b2f12, transparent: true, opacity: 0.18 });
        this.groundGroup.add(new THREE.LineSegments(geo, gridMat));

        // marcador do spawn e do fim
        this._addPortal(Coords.cellCX(0), Coords.cellCY(Math.floor(rows / 2)), '#4a7a20', 'spawn');
        this._addPortal(Coords.cellCX(cols - 1), Coords.cellCY(Math.floor(rows / 2)), '#8b1a1a', 'end');

        // vegetação/pedras decorativas ao redor do tabuleiro
        this._buildScatter();
    }

    // microtextura do chão (ruído + pontinhos de grade), memoizada
    static _groundTex() {
        if (World3D.__gtex) return World3D.__gtex;
        const c = document.createElement('canvas'); c.width = c.height = 256;
        const g = c.getContext('2d');
        g.fillStyle = '#e8d5a8'; g.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 700; i++) {
            const s = 1 + Math.random() * 2.5;
            g.fillStyle = Math.random() < 0.5 ? 'rgba(91,47,18,0.06)' : 'rgba(255,255,255,0.10)';
            g.fillRect(Math.random() * 256, Math.random() * 256, s, s);
        }
        // pontinho nas interseções (como uma cotação de tabuleiro)
        g.fillStyle = 'rgba(91,47,18,0.16)';
        for (const cx of [0, 128, 256]) for (const cy of [0, 128, 256]) {
            g.fillRect(cx - 1, cy - 1, 3, 3);
        }
        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        World3D.__gtex = tex;
        return tex;
    }

    // árvores, pedras e capim fora do campo, determinísticos (seed fixo)
    _buildScatter() {
        const halfX = this.boardW / 2 + 0.25, halfZ = this.boardH / 2 + 0.25;
        const rng = World3D._seed(7);
        const leafMat = MatFactory.mat('#3f7a2e');
        const leafMat2 = MatFactory.mat('#4f8f3a');
        const trunkMat = MatFactory.mat('#5a3a1a');
        const rockMat = MatFactory.mat('#8a8378');
        const grassMat = MatFactory.mat('#6f9e4a');
        const inBoard = (x, z) => Math.abs(x) < halfX + 0.5 && Math.abs(z) < halfZ + 0.5;
        const inside = (x, z) => Math.abs(x) < halfX - 0.6 && Math.abs(z) < halfZ - 0.6;
        let guard = 0;
        let placed = 0;
        while (placed < 26 && guard++ < 300) {
            const x = (rng() * 2 - 1) * (halfX + 4.5);
            const z = (rng() * 2 - 1) * (halfZ + 4.5);
            if (inside(x, z)) continue;           // dentro do tabuleiro: não
            if (inBoard(x, z)) continue;          // na borda do tabuleiro: não
            const t = rng();
            let obj;
            if (t < 0.32) {
                // árvore: tronco + 2 copas em cone
                obj = new THREE.Group();
                const trunk = mesh(GeomFactory.cyl(0.05, 0.08, 0.35, 6), trunkMat);
                trunk.position.y = 0.18; obj.add(trunk);
                const c1 = mesh(GeomFactory.cone(0.34, 0.6, 7), rng() < 0.5 ? leafMat : leafMat2);
                c1.position.y = 0.68; obj.add(c1);
                const c2 = mesh(GeomFactory.cone(0.22, 0.4, 7), leafMat2);
                c2.position.y = 1.05; obj.add(c2);
                obj.scale.setScalar(0.7 + rng() * 0.6);
            } else if (t < 0.62) {
                // pedra
                obj = mesh(GeomFactory.icosa(0.14 + rng() * 0.2, 0), rockMat);
                obj.scale.y = 0.6 + rng() * 0.3;
                obj.rotation.y = rng() * Math.PI;
                const wrap = new THREE.Group(); wrap.add(obj);
                obj = wrap;
            } else {
                // capim: 3 folhas finas
                obj = new THREE.Group();
                for (let i = 0; i < 3; i++) {
                    const b = mesh(GeomFactory.cone(0.02, 0.16 + rng() * 0.14, 4), grassMat);
                    b.position.set((rng() - 0.5) * 0.1, 0.09, (rng() - 0.5) * 0.1);
                    b.rotation.z = (rng() - 0.5) * 0.5;
                    obj.add(b);
                }
            }
            obj.position.set(x, 0, z);
            this.groundGroup.add(obj);
            placed++;
        }
    }

    // PRNG determinístico (mulberry32) para o cenário não piscar no relayout
    static _seed(a) {
        return function () {
            a |= 0; a = (a + 0x6D2B79F5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    _addPortal(wx, wz, color, id) {
        const g = new THREE.Group();
        g.position.set(wx, 0, wz);
        const ring = mesh(GeomFactory.tor(0.34, 0.03, 24, 8), MatFactory.glow(color, 0.6));
        ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04;
        g.add(ring);
        g.userData.id = id;
        this.groundGroup.add(g);
    }

    _buildDecor() {
        // "mesa" escura que segura o tabuleiro, dando profundidade
        const table = mesh(GeomFactory.plane(this.boardW + 6, this.boardH + 6), MatFactory.mat('#241008'));
        table.rotation.x = -Math.PI / 2;
        table.position.y = -0.2;
        this.scene.add(table);
    }

    resize() {
        const w = this.canvas.clientWidth || window.innerWidth;
        const h = this.canvas.clientHeight || window.innerHeight;
        this.renderer.setSize(w, h, false);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
    }

    layout() {
        Coords.recenter();
        this._rebuildGround();
        this.resize();
        if (window.game && window.game.camera3d) {
            window.game.camera3d.fit(this.boardW, this.boardH);
        }
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }

    add(obj) { if (obj) this.entityLayer.add(obj); }
    remove(obj) {
        if (!obj) return;
        if (obj.parent) obj.parent.remove(obj);
    }
}
