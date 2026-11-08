/**
 * Modelos 3D dos zumbis. Partem da paleta original (body/head de cada tipo)
 * e constroem bonecos humanoides com variações por traço: chifres, coroa,
 * asas, costelas de esqueleto, cauda/cabeça de beb, armadura de gelo,
 * mochila TNT do bombista, bolhas do venenoso, transparência do fantasma.
 */
const ZombieModels = {
    create(type) {
        const stats = ZOMBIE_STATS[type];
        const g = new THREE.Group();
        const s = stats.size;                 // escala por tipo
        const bodyMat = MatFactory.matUncached(stats.body, { flatShading: true });
        const headMat = MatFactory.matUncached(stats.head, { flatShading: true });
        g.userData.bodyMat = bodyMat;
        g.userData.headMat = headMat;
        g.userData.transparent = !!stats.ghost;

        if (stats.ghost) { bodyMat.transparent = true; bodyMat.opacity = 0.62; headMat.transparent = true; headMat.opacity = 0.62; }
        const legMat = MatFactory.mat(stats.skeletal ? '#f0ebd8' : '#2c1810', { flatShading: true });

        g.add(Models.shadow(0.3 * s));

        // corpo (torso) em escala de tipo
        const torso = boxAt(0.26 * s, 0.34 * s, 0.18 * s, 0, 0.34 * s, 0, bodyMat);
        if (stats.bigHead) torso.scale.y = 0.8;
        g.add(torso);

        // pernas com pivô no quadril (para animar caminhada)
        const legL = new THREE.Group(); const legR = new THREE.Group();
        legL.position.set(-0.07 * s, 0.18 * s, 0); legR.position.set(0.07 * s, 0.18 * s, 0);
        const lm = boxAt(0.09 * s, 0.2 * s, 0.09 * s, 0, -0.1 * s, 0, legMat);
        const rm = boxAt(0.09 * s, 0.2 * s, 0.09 * s, 0, -0.1 * s, 0, legMat);
        legL.add(lm); legR.add(rm); g.add(legL); g.add(legR);

        // braços com pivô no ombro
        const armL = new THREE.Group(); const armR = new THREE.Group();
        armL.position.set(-0.17 * s, 0.44 * s, 0); armR.position.set(0.17 * s, 0.44 * s, 0);
        armL.add(boxAt(0.08 * s, 0.24 * s, 0.08 * s, 0, -0.12 * s, 0, bodyMat));
        armR.add(boxAt(0.08 * s, 0.24 * s, 0.08 * s, 0, -0.12 * s, 0, bodyMat));
        g.add(armL); g.add(armR);

        // cabeça
        const hr = (stats.bigHead ? 0.17 : 0.13) * s;
        const head = sphAt(hr, 0, 0.62 * s + hr, 0, headMat);
        g.add(head);

        // olhos
        const eyeMat = stats.skeletal || stats.ghost ? MatFactory.mat('#0a0a0a') : MatFactory.mat('#ffffff');
        g.add(sphAt(hr * 0.16, -hr * 0.34, 0.62 * s + hr, hr * 0.82, eyeMat));
        g.add(sphAt(hr * 0.16, hr * 0.34, 0.62 * s + hr, hr * 0.82, eyeMat));
        if (!stats.skeletal && !stats.ghost) {
            g.add(sphAt(hr * 0.08, -hr * 0.34, 0.62 * s + hr, hr * 0.94, MatFactory.mat('#000000')));
            g.add(sphAt(hr * 0.08, hr * 0.34, 0.62 * s + hr, hr * 0.94, MatFactory.mat('#000000')));
        }

        const parts = { torso, head, legL, legR, armL, armR, extras: [] };

        // esqueleto: costelas (barras no torso)
        if (stats.skeletal) {
            for (let i = 0; i < 3; i++) {
                const bar = boxAt(0.24 * s, 0.015 * s, 0.19 * s, 0, 0.28 * s + i * 0.05 * s, 0, MatFactory.mat('#b7b0a0'));
                g.add(bar);
            }
        }

        // gelo: cristais + casca translúcida
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

        // bombista: mochila TNT
        if (stats.bomb) {
            const pack = boxAt(0.2 * s, 0.2 * s, 0.12 * s, 0, 0.36 * s, -0.14 * s, MatFactory.mat('#2c1810', { flatShading: true }));
            g.add(pack);
            const fuse = mesh(GeomFactory.cyl(0.01, 0.01, 0.1, 6), MatFactory.mat('#f1c40f', { emissive: '#f1c40f' }));
            fuse.position.set(0.02, 0.5 * s, -0.14 * s); g.add(fuse);
            g.add(sphAt(0.03 * s, 0.02, 0.56 * s, -0.14 * s, MatFactory.glow('#f1c40f')));
        }

        // venenoso: bolhas orbitando (animadas por código)
        if (stats.poisonous) {
            const bubbles = new THREE.Group(); g.add(bubbles); parts.bubbles = bubbles;
            for (let i = 0; i < 3; i++) {
                const b = sphAt(0.03 * s, 0, 0, 0, MatFactory.glow('#7ed321', 0.7));
                b.userData.phase = i * 2;
                bubbles.add(b);
            }
        }

        // voador: asas
        if (stats.flying) {
            const wingMat = MatFactory.mat('#cfd8d0', { transparent: true, opacity: 0.75, side: THREE.DoubleSide });
            const wl = boxAt(0.28 * s, 0.02, 0.16 * s, -0.24 * s, 0.46 * s, 0, wingMat);
            const wr = boxAt(0.28 * s, 0.02, 0.16 * s, 0.24 * s, 0.46 * s, 0, wingMat);
            g.add(wl); g.add(wr); parts.wingL = wl; parts.wingR = wr;
        }

        // chifres (tank, king)
        if (stats.horns) {
            const hornMat = MatFactory.mat('#2c1810', { flatShading: true });
            for (const sx of [-1, 1]) {
                const horn = mesh(GeomFactory.cone(0.03 * s, 0.14 * s, 6), hornMat);
                horn.position.set(sx * hr * 0.7, 0.62 * s + hr * 1.5, 0);
                horn.rotation.z = -sx * 0.4;
                g.add(horn);
            }
        }

        // coroa (king)
        if (stats.crown) {
            const crown = new THREE.Group(); crown.position.y = 0.62 * s + hr * 1.7; g.add(crown);
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
