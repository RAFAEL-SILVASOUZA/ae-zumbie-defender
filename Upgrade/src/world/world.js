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

        // base de "papel" levemente elevada com borda (efeito de tabuleiro)
        const padMat = MatFactory.mat('#e8d5a8', { flatShading: false });
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
