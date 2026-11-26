/**
 * Modelos 3D dos zumbis — versão orgânica.
 *
 * Em vez de caixas, o boneco é montado com cápsulas e esferas (membros
 * arredondados com pivô nas articulações), mandíbula, olhos fundos e a pose
 * clássica de zumbi (braços esticados para a frente). Variações por traço:
 * chifres, coroa, asas membranosas, costelas de esqueleto, cauda/cone de
 * fantasma, mochila TNT do bombista, bolhas do venenoso, casca de gelo,
 * transparência do fantasma.
 *
 * Todo modelo é construído em uma "célula" de 1 unidade, com a base no y=0.
 * Zombie.js posiciona, anima (caminhada, balanço, morte) e escala por tipo.
 */
const ZombieModels = {
    create(type) {
        const stats = ZOMBIE_STATS[type];
        const g = new THREE.Group();
        const s = stats.size;

        const bodyMat = MatFactory.matUncached(stats.body, {});
        const headMat = MatFactory.matUncached(stats.head, {});
        g.userData.bodyMat = bodyMat;
        g.userData.headMat = headMat;
        g.userData.transparent = !!stats.ghost;
        if (stats.ghost) {
            bodyMat.transparent = true; bodyMat.opacity = 0.6;
            headMat.transparent = true; headMat.opacity = 0.6;
        }
        const legMat = MatFactory.mat(stats.skeletal ? '#e8e4d4' : '#3a2a18');
        const darkMat = MatFactory.mat(shade(stats.body, -0.35));
        const eyeMat = stats.skeletal || stats.ghost ? MatFactory.mat('#0a0a0a') : MatFactory.mat('#ffffff');
        const pupilMat = MatFactory.mat('#000000');

        g.add(Models.shadow(0.3 * s));

        const hr = (stats.bigHead ? 0.17 : 0.13) * s;
        const hipY = 0.30 * s;
        const neckY = 0.54 * s;

        // ---------- pernas com pivô no quadril ----------
        const legL = new THREE.Group(); const legR = new THREE.Group();
        legL.position.set(-0.085 * s, hipY, 0); legR.position.set(0.085 * s, hipY, 0);
        if (!stats.ghost) {
            const legGeo = GeomFactory.capTop(0.055 * s, 0.24 * s);
            legL.add(mesh(legGeo, legMat));
            legR.add(mesh(legGeo, legMat));
            // pés (esferas achatadas)
            const footGeo = GeomFactory.sph(0.062 * s, 8, 6);
            for (const lg of [legL, legR]) {
                const foot = mesh(footGeo, darkMat);
                foot.scale.set(1.0, 0.6, 1.5);
                foot.position.set(0, -(0.24 * s + 0.055 * s), 0.03 * s);
                lg.add(foot);
            }
            g.add(legL); g.add(legR);
        }

        // ---------- quadril + torso (cápsula arredondada) ----------
        const hips = sphAt(0.095 * s, 0, hipY, 0, darkMat);
        hips.scale.set(1.1, 0.8, 0.9);
        g.add(hips);

        const torso = mesh(GeomFactory.cap(0.15 * s, 0.16 * s, 3, 9), bodyMat);
        torso.scale.set(1.08, 1, 0.78);
        torso.position.y = 0.42 * s;
        g.add(torso);

        // pescoço
        const neck = sphAt(0.06 * s, 0, neckY - 0.02 * s, 0.01 * s, darkMat);
        g.add(neck);

        // ---------- braços com pivô no ombro (pose de zumbi: esticados) ----------
        const armL = new THREE.Group(); const armR = new THREE.Group();
        armL.position.set(-0.185 * s, 0.49 * s, 0.02 * s);
        armR.position.set(0.185 * s, 0.49 * s, 0.02 * s);
        const armGeo = GeomFactory.capTop(0.048 * s, 0.24 * s);
        const handGeo = GeomFactory.sph(0.055 * s, 8, 6);
        for (const arm of [armL, armR]) {
            arm.add(mesh(armGeo, bodyMat));
            const hand = mesh(handGeo, darkMat);
            hand.scale.set(0.9, 0.9, 1.15);
            hand.position.set(0, -(0.24 * s + 0.055 * s), 0.015 * s);
            arm.add(hand);
        }
        g.add(armL); g.add(armR);

        // ---------- cabeça com mandíbula e olhos ----------
        const head = new THREE.Group();
        head.position.set(0, neckY, 0.02 * s);
        const skull = sphAt(hr, 0, hr * 0.95, 0, headMat);
        skull.scale.set(0.92, 0.94, 0.95);
        head.add(skull);
        const jaw = mesh(GeomFactory.sph(hr * 0.5, 8, 6), headMat);
        jaw.scale.set(0.85, 0.55, 1.1);
        jaw.position.set(0, hr * 0.35, hr * 0.55);
        head.add(jaw);
        for (const sx of [-1, 1]) {
            head.add(sphAt(hr * 0.16, sx * hr * 0.34, hr * 1.05, hr * 0.62, eyeMat));
            if (!stats.skeletal && !stats.ghost) {
                head.add(sphAt(hr * 0.09, sx * hr * 0.34, hr * 1.05, hr * 0.78, pupilMat));
            }
        }
        g.add(head);

        // fantasma: cauda esfarrapada no lugar de pernas
        if (stats.ghost) {
            const skirt = mesh(GeomFactory.cone(0.17 * s, 0.36 * s, 9), bodyMat);
            skirt.rotation.x = Math.PI;
            skirt.position.y = 0.34 * s;
            g.add(skirt);
        }

        const parts = { torso, head, legL, legR, armL, armR, headTopY: neckY + hr * 1.9, extras: [] };

        // ---------- esqueleto: costelas em anel ----------
        if (stats.skeletal) {
            const ribMat = MatFactory.mat('#efe9d6');
            for (let i = 0; i < 3; i++) {
                const rib = mesh(GeomFactory.tor(0.135 * s, 0.018 * s, 10, 6), ribMat);
                rib.rotation.x = Math.PI / 2;
                rib.position.y = 0.36 * s + i * 0.07 * s;
                rib.scale.set(1, 1, 0.85);
                g.add(rib);
            }
        }

        // ---------- gelo: casca translúcida + cristais ----------
        if (stats.frosty) {
            const shell = sphAt(0.22 * s, 0, 0.36 * s, 0, MatFactory.mat('#85b3d4', { transparent: true, opacity: 0.4 }));
            g.add(shell);
            for (let i = 0; i < 4; i++) {
                const a = (i / 4) * Math.PI * 2;
                const c = mesh(GeomFactory.octa(0.05 * s), MatFactory.mat('#e0f4ff', { emissive: '#85b3d4' }));
                c.position.set(Math.cos(a) * 0.16 * s, 0.36 * s + Math.sin(i) * 0.06, Math.sin(a) * 0.12 * s);
                g.add(c);
            }
            parts.iceShell = shell;
        }

        // ---------- bombista: mochila TNT nas costas ----------
        if (stats.bomb) {
            const pack = mesh(GeomFactory.cap(0.09 * s, 0.14 * s, 2, 8), MatFactory.mat('#5d3516'));
            pack.rotation.z = Math.PI / 2;   // deitado, atravessado nas costas
            pack.position.set(0, 0.44 * s, -0.17 * s);
            g.add(pack);
            const band = mesh(GeomFactory.cyl(0.095 * s, 0.095 * s, 0.03 * s, 8), MatFactory.mat('#c0392b'));
            band.rotation.z = Math.PI / 2;
            band.position.set(0.06 * s, 0.44 * s, -0.17 * s);
            g.add(band);
            const fuse = mesh(GeomFactory.cyl(0.012 * s, 0.012 * s, 0.12 * s, 5), MatFactory.mat('#f1c40f', { emissive: '#f1c40f' }));
            fuse.position.set(0.03 * s, 0.56 * s, -0.17 * s);
            fuse.rotation.z = 0.5;
            g.add(fuse);
            g.add(sphAt(0.028 * s, 0.06 * s, 0.58 * s, -0.16 * s, MatFactory.glow('#ffd900')));
        }

        // ---------- venenoso: bolhas orbitando ----------
        if (stats.poisonous) {
            const bubbles = new THREE.Group(); g.add(bubbles); parts.bubbles = bubbles;
            for (let i = 0; i < 3; i++) {
                const b = sphAt(0.03 * s, 0, 0, 0, MatFactory.glow('#7ed321', 0.7));
                b.userData.phase = i * 2;
                bubbles.add(b);
            }
        }

        // ---------- voador: asas membranosas ----------
        if (stats.flying) {
            const wingMat = MatFactory.mat('#d8e6dc', { transparent: true, opacity: 0.72, side: THREE.DoubleSide });
            const mkWing = (sx) => {
                const w = new THREE.Group();
                w.position.set(sx * 0.10 * s, 0.52 * s, -0.02 * s);
                const m = mesh(GeomFactory.sph(0.30 * s, 9, 7), wingMat);
                m.scale.set(1.1, 0.18, 0.5);
                m.position.x = sx * 0.26 * s;
                w.add(m);
                g.add(w); return w;
            };
            parts.wingL = mkWing(-1); parts.wingR = mkWing(1);
        }

        // ---------- chifres (tank, king) ----------
        if (stats.horns) {
            const hornMat = MatFactory.mat('#e8d5b0');
            for (const sx of [-1, 1]) {
                const horn = mesh(GeomFactory.cone(0.03 * s, 0.14 * s, 6), hornMat);
                horn.position.set(sx * hr * 0.7, neckY + hr * 1.75, 0);
                horn.rotation.z = -sx * 0.45;
                g.add(horn);
            }
        }

        // ---------- coroa (king) ----------
        if (stats.crown) {
            const crown = new THREE.Group(); crown.position.y = neckY + hr * 1.95; g.add(crown);
            crown.add(mesh(GeomFactory.cyl(hr * 0.7, hr * 0.8, 0.08 * s, 8), MatFactory.mat('#f1c40f', { emissive: '#7a5c00' })));
            for (let i = 0; i < 5; i++) {
                const a = (i / 5) * Math.PI * 2;
                const spike = mesh(GeomFactory.cone(0.02 * s, 0.1 * s, 4), MatFactory.mat('#f1c40f', { emissive: '#7a5c00' }));
                spike.position.set(Math.cos(a) * hr * 0.6, 0.08 * s, Math.sin(a) * hr * 0.6);
                crown.add(spike);
            }
            g.add(sphAt(0.03 * s, 0, crown.position.y, hr * 0.9, MatFactory.mat('#c0392b', { emissive: '#c0392b' })));
        }

        return { group: g, parts };
    }
};
