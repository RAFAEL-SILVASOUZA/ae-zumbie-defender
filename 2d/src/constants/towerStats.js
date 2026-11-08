/**
 * Estatísticas das torres
 */

const TOWER_STATS = {
    spike:      { range: 1.5, damage: 6,  fireRate: 1300, cost: 5,   ignoresFlying: true, damageType: 'physical', label: 'Espinhos' },
    pistol:     { range: 2.5, damage: 9,  fireRate: 800,  cost: 10,  damageType: 'physical', label: 'Pistola' },
    machinegun: { range: 3.0, damage: 11, fireRate: 380,  cost: 30,  damageType: 'physical', label: 'Metralhadora' },
    poison:     { range: 2.5, damage: 4,  fireRate: 700,  cost: 40,  slowFactor: 0.55, slowMs: 1400, damageType: 'poison', label: 'Veneno' },
    radar:      { range: 7.0, damage: 60, fireRate: 1500, cost: 100, damageType: 'energy', label: 'Radar' },
    robot:      { range: 3.5, damage: 22, fireRate: 550,  cost: 120, damageType: 'physical', label: 'Robô' },
    rocket:     { range: 4.0, damage: 30, fireRate: 1300, cost: 150, splashRadius: 1.3, damageType: 'explosive', label: 'Foguete' },
    tesla:      { range: 4.0, damage: 80,  fireRate: 1100, cost: 200, chains: 3, chainRange: 2.5, chainFalloff: 0.65, damageType: 'energy', label: 'Tesla' },
    radioactive: { range: 2.5, damage: 100, fireRate: 2500, cost: 250, damageType: 'energy', label: 'Radioativa' },
    knight:     { range: 99,  damage: 100, fireRate: 500,  cost: 500,  damageType: 'holy', label: 'Cavaleiro', mobile: true, moveSpeed: 0.13, cleaveFactor: 0.5, cleaveRange: 0.9 },
    drone:      { range: 99,  damage: 0,   fireRate: 0,    cost: 750,  damageType: 'none', label: 'Drone', mobile: true, isDrone: true, moveSpeed: 0.22 },
    laser:      { range: 0.6, damage: 200, fireRate: 800,  cost: 1000, damageType: 'energy', label: 'Parede Laser', unlockRound: 70 },
    mago:       { range: 5,   damage: 45,  fireRate: 650,  cost: 50,   damageType: 'magic',  label: 'Mago',         isWizard: true, unlockRound: 60 }
};
