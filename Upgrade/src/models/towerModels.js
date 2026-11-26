/**
 * Modelos 3D das torres — versão orgânica.
 *
 * Substitui as caixas por pedestais de madeira arredondados, corpos em
 * cápsulas/cilindros com detalhes (correias, presilhas, bobinas) e um sprite
 * de "muzzle flash" no cano (parts.flash, acionado por Tower ao atirar).
 *
 * Todo modelo é construído em uma "célula" de 1 unidade de lado, com a base
 * no y=0 (o chão) e centrado em x=0,z=0. O Tower.js posiciona e escala.
 *
 * Convenção do cano: o grupo `parts.turret` gira em Y (mirar) e o cano aponta
 * para +X local. `parts.flash` é o clarão de disparo (sprite).
 */
const TowerModels = {
    // pedestal de madeira arredondado (comum a quase todas as torres)
    _pedestal(r = 0.4) {
        const g = new THREE.Group();
        const wood = MatFactory.mat('#8b5a2b', { flatShading: false });
        const woodDark = MatFactory.mat(shade('#8b5a2b', -0.3));
        const drum = mesh(GeomFactory.cyl(r, r * 1.12, 0.18, 12), wood);
        drum.position.y = 0.09;
        g.add(drum);
        const top = mesh(GeomFactory.cyl(r * 0.96, r * 0.96, 0.04, 12), woodDark);
        top.position.y = 0.19;
        g.add(top);
        const rope = mesh(GeomFactory.tor(r * 1.02, 0.022, 14, 6), MatFactory.mat('#a77c4a'));
        rope.rotation.x = Math.PI / 2;
        rope.position.y = 0.05;
        g.add(rope);
        return g;
    },

    _flashSprite(color = '#fff3c0') {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({
            map: MatFactory.dotTex(), transparent: true,
            color: new THREE.Color(color),
            depthWrite: false, blending: THREE.AdditiveBlending
        }));
        s.visible = false;
        return s;
    },

    create(type) {
        const parts = {};
        const g = new THREE.Group();
        g.add(Models.shadow(0.42));

        switch (type) {
            case 'spike': {
                const drum = mesh(GeomFactory.cyl(0.36, 0.42, 0.18, 10), MatFactory.mat('#8b5a2b'));
                drum.position.y = 0.09; g.add(drum);
                for (let i = 0; i < 5; i++) {
                    const a = (i / 5) * Math.PI * 2;
                    const sp = mesh(GeomFactory.cone(0.09, 0.55, 7), MatFactory.mat('#9ca3a8'));
                    sp.position.set(Math.cos(a) * 0.2, 0.42, Math.sin(a) * 0.2);
                    sp.rotation.z = -Math.cos(a) * 0.2;
                    sp.rotation.x = Math.sin(a) * 0.2;
                    g.add(sp);
                }
                const dome = sphAt(0.1, 0, 0.24, 0, MatFactory.mat('#b8bfc4'));
                g.add(dome);
                break;
            }
            case 'pistol': {
                g.add(TowerModels._pedestal(0.36));
                const mount = sphAt(0.16, 0, 0.26, 0, MatFactory.mat('#7f8c8d'));
                g.add(mount);
                const turret = new THREE.Group(); turret.position.y = 0.34;
                const grip = mesh(GeomFactory.cap(0.07, 0.16, 2, 8), MatFactory.mat('#34495e'));
                grip.rotation.z = Math.PI / 2; grip.position.set(-0.02, -0.02, 0); turret.add(grip);
                const barrel = mesh(GeomFactory.cyl(0.05, 0.055, 0.5, 10), MatFactory.mat('#34495e'));
                barrel.rotation.z = Math.PI / 2; barrel.position.x = 0.32;
                turret.add(barrel);
                const tip = sphAt(0.07, 0.56, 0, 0, MatFactory.mat('#1c1c1c'));
                turret.add(tip);
                const flash = TowerModels._flashSprite('#ffd88a');
                flash.position.set(0.66, 0, 0); flash.scale.set(0.4, 0.4, 1);
                turret.add(flash); parts.flash = flash;
                g.add(turret); parts.turret = turret;
                break;
            }
            case 'machinegun': {
                g.add(TowerModels._pedestal(0.4));
                const housing = mesh(GeomFactory.cap(0.17, 0.2, 3, 10), MatFactory.mat('#5d6e7a'));
                housing.rotation.z = Math.PI / 2;
                housing.position.y = 0.36;
                housing.scale.set(1.15, 1, 0.8);
                g.add(housing);
                const turret = new THREE.Group(); turret.position.y = 0.36;
                for (const dz of [-0.09, 0.09]) {
                    const b = mesh(GeomFactory.cyl(0.045, 0.045, 0.52, 8), MatFactory.mat('#34495e'));
                    b.rotation.z = Math.PI / 2; b.position.set(0.32, 0.0, dz);
                    turret.add(b);
                    const tip = sphAt(0.05, 0.58, 0, dz, MatFactory.mat('#1c1c1c'));
                    turret.add(tip);
                }
                // correia de munição dourada
                const belt = mesh(GeomFactory.cap(0.03, 0.3, 2, 6), MatFactory.mat('#f1c40f', { emissive: '#5a4a00' }));
                belt.rotation.z = Math.PI / 2;
                belt.position.set(-0.06, 0.12, 0.24);
                turret.add(belt);
                const flash = TowerModels._flashSprite('#ffd88a');
                flash.position.set(0.66, 0, 0); flash.scale.set(0.45, 0.45, 1);
                turret.add(flash); parts.flash = flash;
                g.add(turret); parts.turret = turret;
                break;
            }
            case 'poison': {
                g.add(TowerModels._pedestal(0.36));
                const tank = mesh(GeomFactory.cyl(0.22, 0.26, 0.5, 12), MatFactory.mat('#7ed321'));
                tank.position.y = 0.44; g.add(tank);
                const dome = sphAt(0.22, 0, 0.69, 0, MatFactory.mat('#7ed321'));
                dome.scale.set(1, 0.5, 1); g.add(dome);
                const stripe = mesh(GeomFactory.cyl(0.245, 0.245, 0.1, 12), MatFactory.mat('#2c1810'));
                stripe.position.y = 0.42; g.add(stripe);
                const symbol = sphAt(0.07, 0, 0.42, 0.255, MatFactory.glow('#d6ff9a'));
                g.add(symbol);
                const nozzle = new THREE.Group(); nozzle.position.y = 0.42;
                const np = mesh(GeomFactory.cyl(0.045, 0.07, 0.34, 8), MatFactory.mat('#5a8f1c'));
                np.rotation.z = Math.PI / 2; np.position.x = 0.26; nozzle.add(np);
                const flash = TowerModels._flashSprite('#b6ff66');
                flash.position.set(0.48, 0, 0); flash.scale.set(0.4, 0.4, 1);
                nozzle.add(flash); parts.flash = flash;
                g.add(nozzle); parts.turret = nozzle;
                break;
            }
            case 'radar': {
                g.add(TowerModels._pedestal(0.32));
                const pole = mesh(GeomFactory.cyl(0.05, 0.08, 0.4, 8), MatFactory.mat('#5d6e7a'));
                pole.position.y = 0.38; g.add(pole);
                const dish = new THREE.Group(); dish.position.y = 0.62;
                const bowl = mesh(new THREE.SphereGeometry(0.28, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), MatFactory.mat('#ecf0f1', { side: THREE.DoubleSide }));
                bowl.rotation.x = Math.PI; bowl.position.y = 0.02;
                dish.add(bowl);
                const feed = sphAt(0.06, 0, 0.02, 0, MatFactory.mat('#c0392b', { emissive: '#601010' }));
                dish.add(feed);
                const flash = TowerModels._flashSprite('#ff8888');
                flash.position.set(0, 0.06, 0.1); flash.scale.set(0.5, 0.5, 1);
                dish.add(flash); parts.flash = flash;
                g.add(dish); parts.turret = dish;
                break;
            }
            case 'robot': {
                g.add(TowerModels._pedestal(0.38));
                // corpo cápsula
                const body = mesh(GeomFactory.cap(0.15, 0.2, 3, 10), MatFactory.mat('#95a5a6'));
                body.position.y = 0.38; body.scale.set(1, 1.1, 0.85);
                g.add(body);
                // cabeça de cúpula com visor
                const head = sphAt(0.13, 0, 0.66, 0, MatFactory.mat('#bdc3c7'));
                head.scale.set(1, 0.85, 0.95);
                g.add(head);
                const visor = mesh(GeomFactory.cyl(0.09, 0.09, 0.1, 10), MatFactory.mat('#2c1810'));
                visor.rotation.x = Math.PI / 2;
                visor.position.set(0, 0.66, 0.1);
                g.add(visor);
                g.add(sphAt(0.035, 0, 0.4, 0.15, MatFactory.mat('#27ae60', { emissive: '#27ae60', emissiveIntensity: 1 })));
                const antenna = mesh(GeomFactory.cyl(0.01, 0.01, 0.16, 6), MatFactory.mat('#333333'));
                antenna.position.set(0, 0.86, 0); g.add(antenna);
                g.add(sphAt(0.03, 0, 0.96, 0, MatFactory.mat('#f1c40f', { emissive: '#f1c40f' })));
                const arm = new THREE.Group(); arm.position.set(0, 0.4, 0);
                const shoulder = sphAt(0.08, 0.0, 0, 0, MatFactory.mat('#7f8c8d'));
                arm.add(shoulder);
                const cannon = mesh(GeomFactory.cyl(0.06, 0.08, 0.42, 10), MatFactory.mat('#34495e'));
                cannon.rotation.z = Math.PI / 2; cannon.position.x = 0.28; arm.add(cannon);
                const tip = sphAt(0.06, 0.5, 0, 0, MatFactory.mat('#1c1c1c'));
                arm.add(tip);
                const flash = TowerModels._flashSprite('#a8ff9a');
                flash.position.set(0.6, 0, 0); flash.scale.set(0.42, 0.42, 1);
                arm.add(flash); parts.flash = flash;
                g.add(arm); parts.turret = arm;
                break;
            }
            case 'rocket': {
                g.add(TowerModels._pedestal(0.4));
                const tube = new THREE.Group(); tube.position.y = 0.38;
                const body = mesh(GeomFactory.cyl(0.14, 0.15, 0.62, 12), MatFactory.mat('#3a3a3a'));
                body.rotation.z = Math.PI / 2; tube.add(body);
                const band = mesh(GeomFactory.cyl(0.155, 0.155, 0.08, 12), MatFactory.mat('#c0392b'));
                band.rotation.z = Math.PI / 2; band.position.x = 0.12; tube.add(band);
                const tip = mesh(GeomFactory.cone(0.1, 0.2, 10), MatFactory.mat('#c0392b'));
                tip.rotation.z = -Math.PI / 2; tip.position.x = 0.4; tube.add(tip);
                const flash = TowerModels._flashSprite('#ff9a5a');
                flash.position.set(0.58, 0, 0); flash.scale.set(0.5, 0.5, 1);
                tube.add(flash); parts.flash = flash;
                g.add(tube); parts.turret = tube;
                break;
            }
            case 'tesla': {
                g.add(TowerModels._pedestal(0.36));
                const column = mesh(GeomFactory.cyl(0.1, 0.14, 0.42, 10), MatFactory.mat('#5d6e7a'));
                column.position.y = 0.38; g.add(column);
                // bobinas de Tesla ao longo da coluna
                for (const y of [0.28, 0.44]) {
                    const coil = mesh(GeomFactory.tor(0.13, 0.018, 12, 6), MatFactory.mat('#c0392b', { emissive: '#501010' }));
                    coil.rotation.x = Math.PI / 2; coil.position.y = y;
                    g.add(coil);
                }
                const orb = sphAt(0.2, 0, 0.72, 0, MatFactory.mat('#bdc3c7', { emissive: '#7ec8ff', emissiveIntensity: 0.6 }));
                g.add(orb); parts.orb = orb;
                const flash = TowerModels._flashSprite('#aee8ff');
                flash.position.set(0, 0.74, 0); flash.scale.set(0.55, 0.55, 1);
                g.add(flash); parts.flash = flash;
                const glow = new THREE.Sprite(MatFactory.spriteTex('#7ec8ff'));
                glow.scale.set(0.9, 0.9, 1); glow.position.set(0, 0.72, 0);
                g.add(glow); parts.glow = glow;
                break;
            }
            case 'radioactive': {
                g.add(TowerModels._pedestal(0.34));
                const hub = mesh(GeomFactory.cyl(0.08, 0.1, 0.14, 10), MatFactory.mat('#5d6e7a'));
                hub.position.y = 0.26; g.add(hub);
                const disc = new THREE.Group(); disc.position.y = 0.4;
                const yellow = mesh(GeomFactory.cyl(0.34, 0.34, 0.08, 24), MatFactory.mat('#f5d900'));
                disc.add(yellow);
                for (let i = 0; i < 3; i++) {
                    const a = (i * Math.PI * 2) / 3;
                    const blade = mesh(GeomFactory.cyl(0.01, 0.14, 0.28, 4), MatFactory.mat('#1a1a1a'));
                    blade.rotation.x = Math.PI / 2;
                    blade.position.set(Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2);
                    blade.rotation.y = -a;
                    disc.add(blade);
                }
                g.add(disc); parts.disc = disc;
                const glow = new THREE.Sprite(MatFactory.spriteTex('#f5d900'));
                glow.scale.set(0.8, 0.8, 1); glow.position.set(0, 0.4, 0);
                g.add(glow); parts.glow = glow;
                break;
            }
            case 'laser': {
                // dois postes arredondados com bobinas de energia
                const mkPost = (z) => {
                    const p = new THREE.Group();
                    const base = mesh(GeomFactory.cyl(0.14, 0.18, 0.16, 10), MatFactory.mat('#5a3a1a'));
                    base.position.y = 0.08; p.add(base);
                    const post = mesh(GeomFactory.cyl(0.06, 0.08, 1.1, 8), MatFactory.mat('#4a2f14'));
                    post.position.y = 0.6; p.add(post);
                    for (const y of [0.4, 0.65, 0.9]) {
                        const r = mesh(GeomFactory.tor(0.09, 0.014, 10, 6), MatFactory.glow('#ff4444'));
                        r.position.y = y; p.add(r);
                    }
                    p.position.set(0, 0, z);
                    return p;
                };
                g.add(mkPost(-0.3)); g.add(mkPost(0.3));
                const field = mesh(GeomFactory.plane(0.6, 1.2), MatFactory.glow('rgba(255,60,60,0.35)'));
                field.rotation.y = Math.PI / 2;
                field.position.set(0, 0.6, 0);
                field.scale.set(1, 1, 1);
                g.add(field); parts.field = field;
                for (const z of [-0.3, 0.3]) {
                    g.add(sphAt(0.05, 0, 1.1, z, MatFactory.glow('#ff4444')));
                }
                break;
            }
            case 'mago': {
                // base de pedra
                const rock = mesh(GeomFactory.cyl(0.3, 0.36, 0.12, 9), MatFactory.mat('#6a6a72'));
                rock.position.y = 0.06; g.add(rock);
                const robe = mesh(GeomFactory.cone(0.28, 0.56, 10), MatFactory.mat('#6c3483'));
                robe.position.y = 0.32; g.add(robe);
                const belly = sphAt(0.14, 0, 0.44, 0, MatFactory.mat('#7d4296'));
                belly.scale.set(1, 0.9, 1); g.add(belly);
                g.add(sphAt(0.14, 0, 0.64, 0.02, MatFactory.mat('#f5cba7')));
                // chapéu pontudo
                const hat = mesh(GeomFactory.cone(0.17, 0.42, 10), MatFactory.mat('#4a0080'));
                hat.position.y = 0.98; g.add(hat);
                hat.rotation.z = 0.12;
                const brim = mesh(GeomFactory.tor(0.16, 0.025, 14, 8), MatFactory.mat('#4a0080'));
                brim.rotation.x = Math.PI / 2;
                brim.position.y = 0.76; g.add(brim);
                // cajado com cristal
                const staff = new THREE.Group(); staff.position.set(0.22, 0.5, 0.05);
                const stick = mesh(GeomFactory.cyl(0.014, 0.02, 0.7, 6), MatFactory.mat('#8b4513'));
                stick.position.y = 0.1; staff.add(stick);
                const crystal = mesh(GeomFactory.octa(0.07), MatFactory.mat('#b050ff', { emissive: '#b050ff', emissiveIntensity: 1 }));
                crystal.position.y = 0.5; staff.add(crystal);
                staff.rotation.z = -0.15;
                g.add(staff);
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
                // corpo do cavalo: barril em cápsula + pescoço + cabeça
                const horseMat = MatFactory.mat('#6b4423');
                const horseDark = MatFactory.mat(shade('#6b4423', -0.3));
                const barrel = mesh(GeomFactory.cap(0.13, 0.3, 3, 10), horseMat);
                barrel.rotation.z = Math.PI / 2;
                barrel.position.y = 0.36;
                barrel.scale.set(1, 1.15, 0.85);
                g.add(barrel);
                const neck = mesh(GeomFactory.capTop(0.07, 0.22, 7, 3), horseMat);
                neck.position.set(0.26, 0.44, 0);
                neck.rotation.z = -0.9;   // pescoço sobe para a frente
                g.add(neck);
                const hHead = sphAt(0.09, 0.4, 0.62, 0, horseMat);
                hHead.scale.set(1.6, 0.8, 0.7);
                g.add(hHead);
                const muzzle = sphAt(0.05, 0.5, 0.58, 0, horseDark);
                muzzle.scale.set(1.4, 0.7, 0.7);
                g.add(muzzle);
                // orelhas
                for (const sz of [-0.05, 0.05]) {
                    const ear = mesh(GeomFactory.cone(0.025, 0.07, 5), horseDark);
                    ear.position.set(0.36, 0.7, sz);
                    ear.rotation.z = -0.4;
                    g.add(ear);
                }
                // cauda
                const tail = mesh(GeomFactory.capTop(0.03, 0.2, 6, 3), horseDark);
                tail.position.set(-0.32, 0.44, 0);
                tail.rotation.z = 2.4;
                g.add(tail);
                // pernas com pivô no quadril (para o trote)
                const legGeo = GeomFactory.capTop(0.035, 0.24, 6, 3);
                const hoofMat = horseDark;
                const legDefs = [[-0.2, -0.09], [-0.2, 0.09], [0.18, -0.09], [0.18, 0.09]];
                for (const [sx, sz] of legDefs) {
                    const leg = new THREE.Group();
                    leg.position.set(sx, 0.28, sz);
                    leg.add(mesh(legGeo, hoofMat));
                    const hoof = mesh(GeomFactory.cyl(0.04, 0.045, 0.05, 7), MatFactory.mat('#2c1810'));
                    hoof.position.set(0, -(0.24 + 0.035), 0);
                    leg.add(hoof);
                    g.add(leg);
                    parts._legs = (parts._legs || []).concat(leg);
                }
                // cavaleiro: torso cápsula + elmo com pluma
                const torsoK = mesh(GeomFactory.cap(0.09, 0.14, 3, 8), MatFactory.mat('#bdc3c7'));
                torsoK.position.set(-0.02, 0.62, 0);
                torsoK.scale.set(1, 1, 0.8);
                g.add(torsoK);
                const helm = sphAt(0.08, -0.02, 0.8, 0, MatFactory.mat('#95a5a6'));
                helm.scale.set(1, 0.9, 0.95);
                g.add(helm);
                const plume = mesh(GeomFactory.cone(0.035, 0.12, 6), MatFactory.mat('#c0392b'));
                plume.position.set(-0.04, 0.9, 0);
                plume.rotation.z = -0.5;
                g.add(plume);
                const sword = new THREE.Group(); sword.position.set(0.1, 0.66, 0.05);
                const blade = mesh(GeomFactory.cap(0.02, 0.32, 2, 7), MatFactory.mat('#ecf0f1', { emissive: '#555555' }));
                blade.scale.set(0.7, 1, 1);
                blade.position.y = 0.2;
                sword.add(blade);
                const guard = mesh(GeomFactory.tor(0.06, 0.015, 10, 6), MatFactory.mat('#f1c40f'));
                guard.rotation.x = Math.PI / 2;
                guard.position.y = 0.02;
                sword.add(guard);
                g.add(sword); parts.sword = sword;
                break;
            }
            case 'drone': {
                const rotorGroup = new THREE.Group(); rotorGroup.position.y = 0.44; g.add(rotorGroup); parts.rotors = rotorGroup;
                const armMat = MatFactory.mat('#34495e');
                for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
                    const arm = mesh(GeomFactory.cap(0.015, 0.28, 2, 6), armMat);
                    arm.rotation.z = Math.PI / 2;
                    arm.rotation.y = Math.PI / 4 * -sz * sx; // aponta para o canto
                    const d = Math.SQRT1_2;
                    arm.position.set(sx * 0.11, 0, sz * 0.11);
                    arm.rotation.y = Math.atan2(sz, sx) * -1;
                    rotorGroup.add(arm);
                    const hub = mesh(GeomFactory.cyl(0.11, 0.11, 0.02, 12), MatFactory.glow('#5d6d7e', 0.5));
                    hub.position.set(sx * 0.24, 0, sz * 0.24); rotorGroup.add(hub);
                    const blade = mesh(GeomFactory.cap(0.012, 0.22, 2, 6), MatFactory.mat('#78909c', { transparent: true, opacity: 0.55 }));
                    blade.scale.set(1, 0.4, 1.4);
                    blade.rotation.z = Math.PI / 2;
                    blade.position.set(sx * 0.24, 0.015, sz * 0.24);
                    blade.rotation.y = Math.atan2(sz, sx) * -1 + Math.PI / 2;
                    blade.userData.spin = (sx * sz > 0) ? 1 : -1;
                    rotorGroup.add(blade);
                    parts._blades = (parts._blades || []).concat(blade);
                }
                // corpo: cápsula + olho cyclope
                const body = mesh(GeomFactory.cap(0.1, 0.12, 3, 10), MatFactory.mat('#2c3e50'));
                body.rotation.z = Math.PI / 2;
                body.position.y = 0.4;
                g.add(body);
                const eye = sphAt(0.045, 0, 0.4, 0.12, MatFactory.glow('#3498db'));
                g.add(eye);
                const pupil = sphAt(0.02, 0, 0.4, 0.15, MatFactory.mat('#fff'));
                g.add(pupil);
                // gancho de captura
                const hook = mesh(GeomFactory.tor(0.06, 0.012, 8, 6), MatFactory.mat('#5d6d7e'));
                hook.position.y = 0.3;
                g.add(hook);
                parts.sensor = hook;
                break;
            }
        }
        return { group: g, parts };
    }
};
