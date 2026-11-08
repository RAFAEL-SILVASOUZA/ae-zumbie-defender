/**
 * Modelos 3D das torres. Substituem os sprites 2D do jogo original por
 * malhas melhores, mantendo cores/reconhecimento e a lógica intacta.
 *
 * Todo modelo é construído em uma "célula" de 1 unidade de lado, com a base
 * no y=0 (o chão) e centrado em x=0,z=0. O Tower.js posiciona e escala.
 *
 * Retornamos um objeto { group, parts } onde `parts` expõe o que precisa
 * animar (cano que gira, hélices, núcleo pulsando, etc.).
 */
const TowerModels = {
    _base(mat) {
        // pedestal de madeira comum a quase todas as torres
        const g = new THREE.Group();
        const base = boxAt(0.78, 0.16, 0.78, 0, 0.08, 0, MatFactory.mat('#8b5a2b', { flatShading: true }));
        g.add(base);
        return g;
    },

    create(type) {
        const parts = {};
        const g = new THREE.Group();
        g.add(Models.shadow(0.42));

        switch (type) {
            case 'spike': {
                g.add(boxAt(0.7, 0.2, 0.7, 0, 0.1, 0, MatFactory.mat('#8b5a2b', { flatShading: true })));
                for (let i = 0; i < 5; i++) {
                    const a = (i / 5) * Math.PI * 2;
                    const sp = mesh(GeomFactory.cone(0.09, 0.5, 6), MatFactory.mat('#9ca3a8', { flatShading: true }));
                    sp.position.set(Math.cos(a) * 0.22, 0.4, Math.sin(a) * 0.22);
                    sp.rotation.z = -Math.cos(a) * 0.18;
                    sp.rotation.x = Math.sin(a) * 0.18;
                    g.add(sp);
                }
                break;
            }
            case 'pistol': {
                g.add(boxAt(0.7, 0.16, 0.7, 0, 0.08, 0, MatFactory.mat('#8b5a2b', { flatShading: true })));
                g.add(sphAt(0.26, 0, 0.3, 0, MatFactory.mat('#7f8c8d', { flatShading: true })));
                const turret = new THREE.Group(); turret.position.y = 0.3;
                const barrel = mesh(GeomFactory.cyl(0.06, 0.06, 0.5, 10), MatFactory.mat('#34495e', { flatShading: true }));
                barrel.rotation.z = Math.PI / 2; barrel.position.x = 0.3;
                turret.add(barrel);
                const tip = sphAt(0.07, 0.52, 0, 0, MatFactory.mat('#1c1c1c'));
                turret.add(tip);
                g.add(turret); parts.turret = turret;
                break;
            }
            case 'machinegun': {
                g.add(boxAt(0.76, 0.16, 0.76, 0, 0.08, 0, MatFactory.mat('#8b5a2b', { flatShading: true })));
                g.add(boxAt(0.5, 0.34, 0.5, 0, 0.33, 0, MatFactory.mat('#5d6e7a', { flatShading: true })));
                const turret = new THREE.Group(); turret.position.y = 0.36;
                for (const dz of [-0.09, 0.09]) {
                    const b = mesh(GeomFactory.cyl(0.05, 0.05, 0.52, 8), MatFactory.mat('#34495e', { flatShading: true }));
                    b.rotation.z = Math.PI / 2; b.position.set(0.3, 0.0, dz);
                    turret.add(b);
                }
                // correia de munição dourada
                const belt = boxAt(0.4, 0.08, 0.06, -0.05, 0.1, 0.26, MatFactory.mat('#f1c40f', { emissive: '#5a4a00' }));
                turret.add(belt);
                g.add(turret); parts.turret = turret;
                break;
            }
            case 'poison': {
                g.add(boxAt(0.7, 0.16, 0.7, 0, 0.08, 0, MatFactory.mat('#8b5a2b', { flatShading: true })));
                const tank = mesh(GeomFactory.cyl(0.24, 0.26, 0.5, 12), MatFactory.mat('#7ed321', { flatShading: true }));
                tank.position.y = 0.42; g.add(tank);
                const stripe = mesh(GeomFactory.cyl(0.245, 0.245, 0.1, 12), MatFactory.mat('#2c1810'));
                stripe.position.y = 0.4; g.add(stripe);
                const nozzle = new THREE.Group(); nozzle.position.y = 0.42;
                const np = mesh(GeomFactory.cyl(0.05, 0.07, 0.34, 8), MatFactory.mat('#5a8f1c', { flatShading: true }));
                np.rotation.z = Math.PI / 2; np.position.x = 0.22; nozzle.add(np);
                g.add(nozzle); parts.turret = nozzle;
                break;
            }
            case 'radar': {
                g.add(boxAt(0.64, 0.16, 0.64, 0, 0.08, 0, MatFactory.mat('#8b5a2b', { flatShading: true })));
                const pole = mesh(GeomFactory.cyl(0.05, 0.07, 0.4, 8), MatFactory.mat('#5d6e7a', { flatShading: true }));
                pole.position.y = 0.35; g.add(pole);
                const dish = new THREE.Group(); dish.position.y = 0.6;
                const bowl = mesh(new THREE.SphereGeometry(0.28, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), MatFactory.mat('#ecf0f1', { flatShading: true, side: THREE.DoubleSide }));
                bowl.rotation.x = Math.PI; bowl.position.y = 0.02;
                dish.add(bowl);
                const feed = sphAt(0.06, 0, 0.02, 0, MatFactory.mat('#c0392b', { emissive: '#601010' }));
                dish.add(feed);
                g.add(dish); parts.turret = dish;
                break;
            }
            case 'robot': {
                g.add(boxAt(0.76, 0.14, 0.76, 0, 0.07, 0, MatFactory.mat('#8b5a2b', { flatShading: true })));
                g.add(boxAt(0.42, 0.34, 0.34, 0, 0.32, 0, MatFactory.mat('#95a5a6', { flatShading: true })));
                g.add(boxAt(0.3, 0.24, 0.28, 0, 0.62, 0, MatFactory.mat('#bdc3c7', { flatShading: true })));
                g.add(sphAt(0.04, -0.07, 0.63, 0.15, MatFactory.mat('#c0392b', { emissive: '#c0392b', emissiveIntensity: 1 })));
                g.add(sphAt(0.04, 0.07, 0.63, 0.15, MatFactory.mat('#c0392b', { emissive: '#c0392b', emissiveIntensity: 1 })));
                g.add(sphAt(0.05, 0, 0.34, 0.18, MatFactory.mat('#27ae60', { emissive: '#27ae60', emissiveIntensity: 1 })));
                const antenna = mesh(GeomFactory.cyl(0.01, 0.01, 0.16, 6), MatFactory.mat('#333333'));
                antenna.position.set(0, 0.82, 0); g.add(antenna);
                g.add(sphAt(0.03, 0, 0.92, 0, MatFactory.mat('#f1c40f', { emissive: '#f1c40f' })));
                const arm = new THREE.Group(); arm.position.set(0, 0.36, 0);
                const cannon = mesh(GeomFactory.cyl(0.07, 0.08, 0.4, 10), MatFactory.mat('#34495e', { flatShading: true }));
                cannon.rotation.z = Math.PI / 2; cannon.position.x = 0.24; arm.add(cannon);
                g.add(arm); parts.turret = arm;
                break;
            }
            case 'rocket': {
                g.add(boxAt(0.78, 0.16, 0.78, 0, 0.08, 0, MatFactory.mat('#8b5a2b', { flatShading: true })));
                const tube = new THREE.Group(); tube.position.y = 0.36;
                const body = mesh(GeomFactory.cyl(0.15, 0.15, 0.6, 12), MatFactory.mat('#3a3a3a', { flatShading: true }));
                body.rotation.z = Math.PI / 2; tube.add(body);
                const tip = mesh(GeomFactory.cone(0.1, 0.2, 10), MatFactory.mat('#c0392b', { flatShading: true }));
                tip.rotation.z = -Math.PI / 2; tip.position.x = 0.36; tube.add(tip);
                g.add(tube); parts.turret = tube;
                break;
            }
            case 'tesla': {
                g.add(boxAt(0.7, 0.16, 0.7, 0, 0.08, 0, MatFactory.mat('#8b5a2b', { flatShading: true })));
                const column = mesh(GeomFactory.cyl(0.12, 0.14, 0.4, 10), MatFactory.mat('#5d6e7a', { flatShading: true }));
                column.position.y = 0.34; g.add(column);
                const orb = sphAt(0.22, 0, 0.66, 0, MatFactory.mat('#bdc3c7', { emissive: '#7ec8ff', emissiveIntensity: 0.6 }));
                g.add(orb); parts.orb = orb;
                const glow = new THREE.Sprite(MatFactory.spriteTex('#7ec8ff'));
                glow.scale.set(0.9, 0.9, 1); glow.position.set(0, 0.66, 0);
                g.add(glow); parts.glow = glow;
                break;
            }
            case 'radioactive': {
                g.add(boxAt(0.7, 0.14, 0.7, 0, 0.07, 0, MatFactory.mat('#8b5a2b', { flatShading: true })));
                const disc = new THREE.Group(); disc.position.y = 0.4;
                const yellow = mesh(GeomFactory.cyl(0.34, 0.34, 0.08, 24), MatFactory.mat('#f5d900', { flatShading: true }));
                disc.add(yellow);
                for (let i = 0; i < 3; i++) {
                    const a = (i * Math.PI * 2) / 3;
                    const blade = boxAt(0.26, 0.09, 0.16, Math.cos(a) * 0.16, 0, Math.sin(a) * 0.16, MatFactory.mat('#1a1a1a'));
                    blade.rotation.y = -a; disc.add(blade);
                }
                g.add(disc); parts.disc = disc;
                const glow = new THREE.Sprite(MatFactory.spriteTex('#f5d900'));
                glow.scale.set(0.8, 0.8, 1); glow.position.set(0, 0.4, 0);
                g.add(glow); parts.glow = glow;
                break;
            }
            case 'laser': {
                g.add(boxAt(0.86, 0.14, 0.2, 0, 0.07, -0.3, MatFactory.mat('#5a3a1a', { flatShading: true })));
                g.add(boxAt(0.86, 0.14, 0.2, 0, 0.07, 0.3, MatFactory.mat('#5a3a1a', { flatShading: true })));
                const field = boxAt(0.8, 1.2, 0.7, 0, 0.66, 0, MatFactory.glow('rgba(255,60,60,1)', 0.35));
                g.add(field); parts.field = field;
                for (const z of [-0.3, 0.3]) {
                    for (const x of [-0.3, -0.1, 0.1, 0.3]) {
                        g.add(sphAt(0.04, x, 0.16, z, MatFactory.glow('#ff4444')));
                    }
                }
                break;
            }
            case 'mago': {
                const robe = mesh(GeomFactory.cone(0.28, 0.5, 10), MatFactory.mat('#6c3483', { flatShading: true }));
                robe.position.y = 0.28; g.add(robe);
                g.add(sphAt(0.15, 0, 0.6, 0, MatFactory.mat('#f5cba7')));
                const hat = mesh(GeomFactory.cone(0.18, 0.42, 10), MatFactory.mat('#4a0080', { flatShading: true }));
                hat.position.y = 0.92; g.add(hat);
                g.add(mesh(new THREE.TorusGeometry(0.19, 0.03, 6, 16), MatFactory.mat('#4a0080')));
                // orbes elementais
                const orbs = new THREE.Group(); orbs.position.y = 0.5; g.add(orbs); parts.orbs = orbs;
                const cols = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#ecf0f1'];
                parts._orbList = cols.map((c, i) => {
                    const o = sphAt(0.06, 0, 0, 0, MatFactory.glow(c));
                    orbs.add(o); return o;
                });
                const glow = new THREE.Sprite(MatFactory.spriteTex('#b050ff'));
                glow.scale.set(1.1, 0.5, 1); glow.position.set(0, 0.05, 0);
                g.add(glow); parts.groundGlow = glow;
                break;
            }
            case 'knight': {
                // corpo do cavalo
                const horse = boxAt(0.56, 0.26, 0.26, 0, 0.34, 0, MatFactory.mat('#6b4423', { flatShading: true }));
                g.add(horse);
                const neck = boxAt(0.16, 0.26, 0.14, 0.28, 0.5, 0, MatFactory.mat('#6b4423', { flatShading: true }));
                neck.rotation.z = -0.5; g.add(neck);
                g.add(sphAt(0.1, 0.36, 0.6, 0, MatFactory.mat('#6b4423')));
                for (const [sx, sz] of [[-0.22, -0.1], [-0.22, 0.1], [0.2, -0.1], [0.2, 0.1]]) {
                    const leg = boxAt(0.08, 0.34, 0.08, sx, 0.17, sz, MatFactory.mat('#5a3819', { flatShading: true }));
                    g.add(leg); parts._legs = (parts._legs || []).concat(leg);
                }
                // cavaleiro
                g.add(boxAt(0.18, 0.22, 0.2, -0.02, 0.6, 0, MatFactory.mat('#bdc3c7', { flatShading: true })));
                g.add(sphAt(0.1, -0.02, 0.78, 0, MatFactory.mat('#95a5a6')));
                const sword = new THREE.Group(); sword.position.set(0.12, 0.62, 0.05);
                const blade = boxAt(0.04, 0.36, 0.02, 0, 0.18, 0, MatFactory.mat('#ecf0f1', { emissive: '#555555' }));
                sword.add(blade);
                sword.add(boxAt(0.1, 0.03, 0.03, 0, 0, 0, MatFactory.mat('#f1c40f')));
                g.add(sword); parts.sword = sword;
                break;
            }
            case 'drone': {
                const rotorGroup = new THREE.Group(); rotorGroup.position.y = 0.44; g.add(rotorGroup); parts.rotors = rotorGroup;
                const armMat = MatFactory.mat('#34495e', { flatShading: true });
                for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
                    const arm = boxAt(0.28, 0.03, 0.03, sx * 0.13, 0, sz * 0.13, armMat);
                    arm.rotation.y = -Math.atan2(sz, sx); rotorGroup.add(arm);
                    const hub = mesh(GeomFactory.cyl(0.12, 0.12, 0.02, 12), MatFactory.glow('#5d6d7e', 0.5));
                    hub.position.set(sx * 0.24, 0, sz * 0.24); rotorGroup.add(hub);
                    const blade = boxAt(0.24, 0.012, 0.03, sx * 0.24, 0.01, sz * 0.24, MatFactory.mat('#78909c', { transparent: true, opacity: 0.55 }));
                    blade.name = `blade_${sx}_${sz}`;
                    blade.userData.spin = (sx * sz > 0) ? 1 : -1;
                    rotorGroup.add(blade);
                    parts._blades = (parts._blades || []).concat(blade);
                }
                g.add(boxAt(0.2, 0.12, 0.2, 0, 0.4, 0, MatFactory.mat('#2c3e50', { flatShading: true })));
                g.add(sphAt(0.04, 0, 0.4, 0.11, MatFactory.glow('#3498db')));
                g.add(sphAt(0.02, 0, 0.4, 0.12, MatFactory.mat('#fff')));
                // gancho de captura
                g.add(mesh(GeomFactory.tor(0.06, 0.012, 8, 6), MatFactory.mat('#5d6d7e')).translateY(0.3));
                parts.sensor = g.children[g.children.length - 2];
                break;
            }
        }
        return { group: g, parts };
    }
};
