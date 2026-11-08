/**
 * Configurações globais do jogo
 */

const CONFIG = {
    gridSize: 50,
    cols: 16,
    rows: 10,
    startMoney: 50,
    startHealth: 20,
    sellRefundFactor: 0.5,
    pauseBetweenRounds: 4500,
    roundBonus: 28,
    baseSpeed: 0.035,
    speedPerRound: 0.0015,
    maxRoundSpeedBonus: 0.04,
    upgradeCostFactors: [0.7, 1.0, 1.5, 2.0, 2.8, 3.8, 5.2, 7.0, 9.5, 13.0],
    hyperCost: 10000,
    droneMaxAbductions: 12
};

function getMaxLevel(round) {
    if (round <= 10) return 3;
    if (round <= 20) return 4;
    if (round <= 30) return 5;
    if (round <= 40) return 6;
    if (round <= 50) return 7;
    if (round <= 60) return 8;
    if (round <= 70) return 9;
    return 10;
}

const COLORS = {
    paperLight: '#e8d5a8',
    paperDark: '#c9a87a',
    grid: 'rgba(91, 47, 18, 0.07)',
    ink: '#2c1810'
};
