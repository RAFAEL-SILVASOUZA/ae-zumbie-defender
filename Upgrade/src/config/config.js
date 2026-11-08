/**
 * Configurações globais do jogo (versão 3D)
 * Os números de mecânica são IDÊNTICOS ao jogo 2D original.
 * gridSize continua em "px" lógicos internos para preservar todas as
 * distâncias (alcance, splash, cleave, velocidades). A conversão para o
 * mundo 3D é feita só na renderização (ver Coords.js / worldScale).
 */

const CONFIG = {
    gridSize: 50,            // unidade lógica interna (px) — NÃO mexer
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
    droneMaxAbductions: 12,

    // Escala visual: quantas unidades 3D vale cada "px" lógico.
    // 1 célula (50px) = 1 unidade 3D. Mantém alcance/splash coerentes.
    // (usa o literal 50 porque, dentro do próprio objeto, CONFIG ainda não
    //  terminou de inicializar — referência a CONFIG aqui daria TDZ)
    worldScale: 1 / 50
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
