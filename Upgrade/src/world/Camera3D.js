/**
 * Camera orbitável com enquadramento automático do tabuleiro.
 * - No desktop: dá para girar arrastando com o botão direito / Alt+arrastar
 *   e aproximar com o scroll, sempre sem perder o foco no campo.
 * - No celular: por padrão a câmera fica fixa e enquadra tudo, para não
 *   conflitar com o toque de posicionar torres (que é o gesto principal).
 * O enquadramento ("fit") é recalculado em todo relayout para caber o mapa
 * inteiro, tanto em retrato (celular) quanto em paisagem (desktop).
 */
class Camera3D {
    // Dispositivo de toque (celular/tablet): usa ponteiro grosseiro ou
    // múltiplos pontos de toque, mesmo tamanho de tela.
    static isTouchDevice() {
        if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return true;
        return (navigator.maxTouchPoints || 0) > 0;
    }

    constructor(camera, dom) {
        this.camera = camera;
        this.dom = dom;

        // ângulos orbitais (radianos). O padrão é desktop; no celular aplica-
        // se um perfil mais "de cima" (phi menor) para as células ficarem
        // mais quadradas e fáceis de tocar.
        this.theta = -Math.PI / 2;   // azimute: encara o campo de frente
        this.phi = 0.62;             // inclinação a partir do topo
        this.minPhi = 0.28;
        this.maxPhi = 1.15;

        this.isTouch = Camera3D.isTouchDevice();
        if (this.isTouch) {
            // Em celular paisagem, um ângulo um pouco mais de cima que o
            // desktop mantém as células tocáveis sem achatar o cenário. O
            // campo já não vira faixa achatada (ver configureLayout), então
            // este phi é suficiente e agrada mais que o top-down puro.
            this.phi = 0.60;
            this.minPhi = 0.30;
            this.maxPhi = 1.10;
        }

        this.radius = 16;            // ajustado por fit()
        this.fitRadius = 16;
        this.minRadiusFactor = 0.6;
        this.maxRadiusFactor = 1.7;
        this.userZoom = 1;           // NUNCA deixe undefined: pinça divide por k e vira NaN

        this.target = new THREE.Vector3(0, 0, 0);
        this._dragging = false;
        this._px = 0; this._py = 0;

        this._bind();
    }

    // Enquadra todo o tabuleiro (largura/altura em unidades 3D) de forma EXATA,
    // testando os 4 cantos do retângulo no plano do chão. Garante que o mapa
    // preencha a área disponível em qualquer proporção de tela.
    fit(w, h) {
        const halfW = w / 2, halfH = h / 2;
        const aspect = this.camera.aspect || 1;
        const fov = THREE.MathUtils.degToRad(this.camera.fov);
        const tanF = Math.tan(fov / 2);
        const margin = 1.04; // folga mínima: o mapa fica grande

        const sinP = Math.sin(this.phi), cosP = Math.cos(this.phi);
        // base da câmera
        const u = new THREE.Vector3(sinP * Math.cos(this.theta), cosP, sinP * Math.sin(this.theta)); // direção (origem->câmera)
        const f = u.clone().negate();                       // forward (câmera->origem)
        const up0 = new THREE.Vector3(0, 1, 0);
        const right = new THREE.Vector3().crossVectors(f, up0).normalize();
        const up = new THREE.Vector3().crossVectors(right, f).normalize();

        const corners = [
            [-halfW, -halfH], [halfW, -halfH], [halfW, halfH], [-halfW, halfH]
        ];
        let rNeed = 0;
        for (const [cx, cz] of corners) {
            const c = new THREE.Vector3(cx, 0, cz);
            const alongC = c.dot(u);                 // projeção do canto na direção da câmera
            const latX = Math.abs(c.dot(right));
            const latY = Math.abs(c.dot(up));
            // precisa de r >= along + lateral/(tan*axis)
            const need = alongC + Math.max(latX / (tanF * aspect), latY / tanF);
            if (need > rNeed) rNeed = need;
        }
        this.fitRadius = rNeed * margin;
        this.radius = this.fitRadius * this.userZoom;
        this.apply();
    }

    apply() {
        const r = THREE.MathUtils.clamp(this.radius,
            this.fitRadius * this.minRadiusFactor,
            this.fitRadius * this.maxRadiusFactor);
        const sinP = Math.sin(this.phi), cosP = Math.cos(this.phi);
        this.camera.position.set(
            this.target.x + r * sinP * Math.cos(this.theta),
            this.target.y + r * cosP,
            this.target.z + r * sinP * Math.sin(this.theta)
        );
        this.camera.lookAt(this.target);
    }

    // volta ao enquadramento padrão (zoom 1x); usado pelo botão da tela
    resetZoom() {
        this.userZoom = 1;
        const world = window.World;
        if (world) this.fit(world.boardW, world.boardH);
        else { this.radius = this.fitRadius; this.apply(); }
    }

    _bind() {
        const d = this.dom;
        d.addEventListener('contextmenu', e => e.preventDefault());

        d.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.userZoom = THREE.MathUtils.clamp(
                (this.userZoom || 1) * (e.deltaY > 0 ? 1.1 : 0.9),
                this.minRadiusFactor, this.maxRadiusFactor);
            this.radius = this.fitRadius * this.userZoom;
            this.apply();
        }, { passive: false });

        // ---------- pinch-zoom + órbita com 2 dedos (celular/tablet) ----------
        this._pointers = new Map();
        this._pinch = null;
        d.addEventListener('pointerdown', (e) => {
            this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (this._pointers.size >= 2) {
                const pts = [...this._pointers.values()];
                this._pinch = {
                    dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
                    midX: (pts[0].x + pts[1].x) / 2,
                    midY: (pts[0].y + pts[1].y) / 2,
                    zoom0: this.userZoom
                };
                this._dragging = false; // solta a órbita de mouse
            }
        });
        d.addEventListener('pointermove', (e) => {
            if (!this._pointers.has(e.pointerId)) return;
            this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (this._pointers.size < 2 || !this._pinch) return;
            const pts = [...this._pointers.values()];
            const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
            const midX = (pts[0].x + pts[1].x) / 2;
            const midY = (pts[0].y + pts[1].y) / 2;
            // zoom proporcional à variação da distância entre os dedos
            const k = this._pinch.dist > 0 ? dist / this._pinch.dist : 1;
            this.userZoom = THREE.MathUtils.clamp(this._pinch.zoom0 / k,
                this.minRadiusFactor, this.maxRadiusFactor);
            this.radius = this.fitRadius * this.userZoom;
            // órbita com o movimento do ponto médio
            const dx = midX - this._pinch.midX, dy = midY - this._pinch.midY;
            this._pinch.midX = midX; this._pinch.midY = midY;
            this.theta += dx * 0.004;
            this.phi = THREE.MathUtils.clamp(this.phi - dy * 0.004, this.minPhi, this.maxPhi);
            const world = window.World;
            if (world) this.fit(world.boardW, world.boardH);
            this.apply();
            e.preventDefault();
        });
        const endPinch = (e) => {
            this._pointers.delete(e.pointerId);
            if (this._pointers.size < 2) this._pinch = null;
        };
        d.addEventListener('pointerup', endPinch);
        d.addEventListener('pointercancel', endPinch);
        d.addEventListener('pointerleave', endPinch);

        d.addEventListener('pointerdown', (e) => {
            // só orbita com botão direito ou com a tecla Alt (não conflita
            // com o toque/esquerdo usado para posicionar e selecionar)
            if (e.button === 2 || e.altKey) {
                this._dragging = true;
                this._px = e.clientX; this._py = e.clientY;
                d.setPointerCapture && d.setPointerCapture(e.pointerId);
            }
        });
        d.addEventListener('pointermove', (e) => {
            if (!this._dragging) return;
            const dx = e.clientX - this._px, dy = e.clientY - this._py;
            this._px = e.clientX; this._py = e.clientY;
            this.theta += dx * 0.005;
            this.phi = THREE.MathUtils.clamp(this.phi - dy * 0.005, this.minPhi, this.maxPhi);
            // re-fit respeita a nova inclinação
            const world = window.World;
            if (world) this.fit(world.boardW, world.boardH);
            this.apply();
        });
        const stop = () => { this._dragging = false; };
        d.addEventListener('pointerup', stop);
        d.addEventListener('pointercancel', stop);
        d.addEventListener('pointerleave', stop);
    }
}
