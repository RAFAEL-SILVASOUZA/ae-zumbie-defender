/**
 * Estatísticas dos zumbis
 */

const ZOMBIE_STATS = {
    normal:   { hpMult: 1.0,  speedMult: 1.0, body: '#6b8e3a', head: '#94b54a', size: 1.0,  unlockRound: 1,  weight: 100, label: 'Normal' },
    tank:     { hpMult: 2.6,  speedMult: 0.7, body: '#3a5d20', head: '#5b8a35', size: 1.3,  unlockRound: 2,  weight: 22,  horns: true, label: 'Tanque' },
    fast:     { hpMult: 0.55, speedMult: 1.7, body: '#a3cf52', head: '#c5e578', size: 0.78, unlockRound: 3,  weight: 28,  label: 'Rápido' },
    flying:   { hpMult: 0.85, speedMult: 1.2, body: '#7fa850', head: '#a3cf52', size: 0.95, unlockRound: 4,  weight: 16,  flying: true, label: 'Voador' },
    skeleton: { hpMult: 0.75, speedMult: 1.05, body: '#d8d2c0', head: '#f0ebd8', size: 0.95, unlockRound: 5,  weight: 22,  skeletal: true, slowImmune: true, immuneTo: ['physical'], label: 'Esqueleto' },
    ghost:    { hpMult: 0.5,  speedMult: 1.0, body: '#e3e8e1', head: '#f6f8f3', size: 1.0,  unlockRound: 6,  weight: 18,  ghost: true, dodgeChance: 0.45, immuneTo: ['physical'], label: 'Fantasma' },
    poison:   { hpMult: 1.0,  speedMult: 0.95, body: '#7a4f8a', head: '#a578b3', size: 1.0,  unlockRound: 7,  weight: 16,  poisonous: true, label: 'Venenoso' },
    bomber:   { hpMult: 0.7,  speedMult: 0.9, body: '#a14431', head: '#c4654f', size: 1.0,  unlockRound: 8,  weight: 14,  bomb: true, label: 'Bombista' },
    ice:      { hpMult: 1.6,  speedMult: 0.85, body: '#5d8db0', head: '#85b3d4', size: 1.4, unlockRound: 9,  weight: 14,  frosty: true, slowImmune: true, freezesTowers: true, label: 'Gelo' },
    baby:     { hpMult: 0.30, speedMult: 1.9, body: '#b5da70', head: '#d4ec9f', size: 0.55, unlockRound: 10, weight: 26,  bigHead: true, label: 'Bebê' },
    king:     { hpMult: 11,   speedMult: 0.55, body: '#4a6e25', head: '#6b8e3a', size: 1.55, unlockRound: 12, weight: 0,   isBoss: true, horns: true, crown: true, label: 'Rei Zumbi' }
};
