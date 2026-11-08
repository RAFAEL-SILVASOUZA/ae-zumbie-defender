/**
 * towerIcons.js
 *
 * Ícones/miniaturas 2D fiéis às armas do jogo original. No jogo 2D, tanto a
 * loja quanto os cards da aba "Armas" desenham cada torre com o MESMO código
 * que aparece no tabuleiro (renderShopThumbnails -> tower.draw). Este módulo
 * porta exatamente esse desenho (código 2D do game.js original, cores,
 * contornos e animações) para que o ícone da loja seja idêntico ao 2D.
 *
 * O modelo 3D (towerModels.js) mantém a mesma paleta e silhueta, então loja
 * e tabuleiro continuam consistentes.
 *
 * Não usa TOWER_STATS nem Tower: o desenho é independente, assim pode ser
 * chamado antes de qualquer outra coisa.
 */

// ---------- utilidades de desenho (idênticas ao game.js) ----------
function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function inkStroke(ctx, w = 2) {
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = w;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
}

// ---------- miniatura da torre (loja e cards de armas) ----------
function renderTowerIcon(ctx, type, opts) {
    opts = opts || {};
    const angle = opts.angle !== undefined ? opts.angle : -Math.PI / 7;
    const recoil = 0;
    // cavaleiro/drone animam com o tempo para parecer vivo, como no jogo
    const phase = (performance.now() * 0.004);
    const fake = {
        type: type,
        angle: angle,
        recoil: recoil,
        gallopPhase: phase,
        swingTime: 0,
        rotorSpin: phase,
        carrying: false,
    };
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.save();
    ctx.translate(ctx.canvas.width / 2, ctx.canvas.height * 0.56);
    _drawTowerIcon(ctx, fake);
    ctx.restore();
}

function _drawTowerIcon(ctx, t) {
    switch (t.type) {
        case 'spike':       _spike(ctx); break;
        case 'pistol':      _pistol(ctx, t); break;
        case 'machinegun':  _machinegun(ctx, t); break;
        case 'poison':      _poison(ctx, t); break;
        case 'radar':       _radar(ctx, t); break;
        case 'robot':       _robot(ctx, t); break;
        case 'rocket':      _rocket(ctx, t); break;
        case 'tesla':       _tesla(ctx, t); break;
        case 'radioactive': _radioactive(ctx, t); break;
        case 'knight':      _knight(ctx, t); break;
        case 'drone':       _drone(ctx, t); break;
        case 'laser':       _laserWall(ctx, t); break;
        case 'mago':        _mago(ctx, t); break;
    }
}

// ---------- miniaturas da loja (equivalente ao renderShopThumbnails do 2D) ----------
function renderShopThumbnails() {
    document.querySelectorAll('.shop-item').forEach(el => {
        const type = el.dataset.type;
        const canvas = el.querySelector('canvas.icon');
        if (!canvas || !type) return;
        renderTowerIcon(canvas.getContext('2d'), type, { angle: -Math.PI / 7 });
    });
}

// ---------- miniaturas dos cards de armas na ajuda (equivalente ao 2D) ----------
function renderHelpWeaponIcons() {
    document.querySelectorAll('#help-weapons-grid canvas[data-tower]').forEach(canvas => {
        renderTowerIcon(canvas.getContext('2d'), canvas.dataset.tower, { angle: -Math.PI / 6 });
    });
}
function _spike(ctx) {
    inkStroke(ctx, 2);
    ctx.fillStyle = '#8b5a2b';
    roundRect(ctx, -14, 6, 28, 12, 5);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#9ca3a8';
    for (let i = 0; i < 4; i++) {
        const sx = -10 + i * 7;
        ctx.beginPath();
        ctx.moveTo(sx - 3, 6);
        ctx.lineTo(sx, -12);
        ctx.lineTo(sx + 3, 6);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = '#dde1e3';
    for (let i = 0; i < 4; i++) {
        const sx = -10 + i * 7;
        ctx.beginPath();
        ctx.moveTo(sx - 1, -4);
        ctx.lineTo(sx, -12);
        ctx.lineTo(sx + 1, -4);
        ctx.closePath();
        ctx.fill();
    }
}

function _pistol(ctx, t) {
    inkStroke(ctx, 2);
    ctx.fillStyle = '#8b5a2b';
    roundRect(ctx, -13, 8, 26, 11, 3);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#7f8c8d';
    ctx.beginPath();
    ctx.arc(0, -2, 10, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#34495e';
    ctx.beginPath();
    ctx.arc(-5, -4, 1.3, 0, Math.PI * 2);
    ctx.arc(5, -4, 1.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.rotate(t.angle);
    ctx.translate(-t.recoil, 0);
    ctx.fillStyle = '#34495e';
    roundRect(ctx, 4, -2.5, 14, 5, 1.5);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#1c1c1c';
    ctx.beginPath();
    ctx.arc(18, 0, 1.5, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.restore();
}

function _machinegun(ctx, t) {
    inkStroke(ctx, 2);
    ctx.fillStyle = '#8b5a2b';
    roundRect(ctx, -14, 8, 28, 11, 3);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#5d6e7a';
    roundRect(ctx, -10, -8, 20, 16, 3);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f1c40f';
    for (let i = -8; i < 9; i += 4) {
        ctx.beginPath();
        ctx.arc(i, 6, 1.2, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.save();
    ctx.rotate(t.angle);
    ctx.translate(-t.recoil, 0);
    ctx.fillStyle = '#34495e';
    roundRect(ctx, 2, -5, 16, 3, 1);
    ctx.fill(); ctx.stroke();
    roundRect(ctx, 2, 2, 16, 3, 1);
    ctx.fill(); ctx.stroke();
    ctx.restore();
}

function _poison(ctx, t) {
    inkStroke(ctx, 2);
    ctx.fillStyle = '#8b5a2b';
    roundRect(ctx, -13, 9, 26, 10, 3);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#7ed321';
    roundRect(ctx, -10, -10, 20, 22, 4);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2c1810';
    roundRect(ctx, -10, -2, 20, 4, 1);
    ctx.fill();
    ctx.fillStyle = '#f1c40f';
    ctx.font = "bold 8px 'Bangers', cursive";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('☣', 0, 0);
    const tnow = performance.now() * 0.003;
    ctx.fillStyle = 'rgba(126, 211, 33, 0.85)';
    ctx.beginPath();
    ctx.arc(-5, -10 - (Math.sin(tnow) * 3 + 3), 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(4, -10 - (Math.cos(tnow * 1.3) * 2 + 4), 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.rotate(t.angle);
    ctx.translate(-t.recoil, 0);
    ctx.fillStyle = '#5a8f1c';
    roundRect(ctx, 4, -2.5, 12, 5, 1);
    ctx.fill(); ctx.stroke();
    ctx.restore();
}

function _radar(ctx, t) {
    inkStroke(ctx, 2);
    ctx.fillStyle = '#8b5a2b';
    roundRect(ctx, -12, 10, 24, 9, 3);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#5d6e7a';
    roundRect(ctx, -2, -2, 4, 14, 1);
    ctx.fill(); ctx.stroke();
    ctx.save();
    ctx.rotate(t.angle - Math.PI / 2);
    ctx.translate(0, -10);
    ctx.fillStyle = '#ecf0f1';
    ctx.beginPath();
    ctx.arc(0, 0, 11, Math.PI, 0);
    ctx.lineTo(8, 2);
    ctx.lineTo(-8, 2);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-6, -2); ctx.lineTo(6, -2);
    ctx.moveTo(-4, -6); ctx.lineTo(4, -6);
    ctx.stroke();
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.arc(0, -1, 2.5, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.restore();
}

function _robot(ctx, t) {
    inkStroke(ctx, 2);
    ctx.fillStyle = '#8b5a2b';
    roundRect(ctx, -14, 11, 28, 8, 3);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#95a5a6';
    roundRect(ctx, -10, -4, 20, 16, 4);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#bdc3c7';
    roundRect(ctx, -7, -14, 14, 10, 3);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.arc(-3, -9, 1.6, 0, Math.PI * 2);
    ctx.arc(3, -9, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-3, -9, 0.6, 0, Math.PI * 2);
    ctx.arc(3, -9, 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(0, -19);
    ctx.stroke();
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.arc(0, -20, 1.8, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#27ae60';
    ctx.beginPath();
    ctx.arc(0, 4, 2.5, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.save();
    ctx.rotate(t.angle);
    ctx.translate(-t.recoil, 0);
    ctx.fillStyle = '#34495e';
    roundRect(ctx, 6, -3.5, 14, 7, 2);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#1c1c1c';
    ctx.beginPath();
    ctx.arc(20, 0, 2, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.restore();
}

function _rocket(ctx, t) {
    inkStroke(ctx, 2);
    ctx.fillStyle = '#8b5a2b';
    roundRect(ctx, -14, 10, 28, 9, 3);
    ctx.fill(); ctx.stroke();
    ctx.save();
    ctx.rotate(t.angle);
    ctx.translate(-t.recoil, 0);
    ctx.fillStyle = '#3a3a3a';
    roundRect(ctx, -8, -7, 24, 14, 4);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.moveTo(8, -4);
    ctx.lineTo(15, 0);
    ctx.lineTo(8, 4);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2c1810';
    roundRect(ctx, -10, -3, 4, 6, 1);
    ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#c0392b';
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1;
    for (let i = 0; i < 2; i++) {
        const ry = 13 + i * 3;
        ctx.beginPath();
        ctx.moveTo(-9, ry);
        ctx.lineTo(-12, ry + 1.5);
        ctx.lineTo(-9, ry + 3);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
    }
}

function _tesla(ctx) {
    inkStroke(ctx, 2);
    ctx.fillStyle = '#8b5a2b';
    roundRect(ctx, -13, 11, 26, 8, 3);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#5d6e7a';
    roundRect(ctx, -5, -3, 10, 14, 2);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2c1810';
    ctx.beginPath();
    ctx.arc(-2.5, 1, 0.8, 0, Math.PI * 2);
    ctx.arc(2.5, 1, 0.8, 0, Math.PI * 2);
    ctx.arc(-2.5, 7, 0.8, 0, Math.PI * 2);
    ctx.arc(2.5, 7, 0.8, 0, Math.PI * 2);
    ctx.fill();
    const tnow = performance.now() * 0.012;
    const glow = ctx.createRadialGradient(0, -10, 2, 0, -10, 16);
    glow.addColorStop(0, 'rgba(180, 230, 255, 0.85)');
    glow.addColorStop(0.5, 'rgba(126, 200, 255, 0.4)');
    glow.addColorStop(1, 'rgba(126, 200, 255, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, -10, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#bdc3c7';
    ctx.beginPath();
    ctx.arc(0, -10, 8, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ecf0f1';
    ctx.beginPath();
    ctx.arc(-2.5, -12, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7ec8ff';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 4; i++) {
        const a = tnow + (i * Math.PI / 2);
        const sx = Math.cos(a) * 8;
        const sy = -10 + Math.sin(a) * 8;
        const ex = sx + Math.cos(a) * (5 + Math.sin(tnow * 3 + i) * 2);
        const ey = sy + Math.sin(a) * (5 + Math.sin(tnow * 3 + i) * 2);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        const mx = (sx + ex) / 2 + (Math.random() - 0.5) * 4;
        const my = (sy + ey) / 2 + (Math.random() - 0.5) * 4;
        ctx.lineTo(mx, my);
        ctx.lineTo(ex, ey);
        ctx.stroke();
    }
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(0, -10, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-3, -16); ctx.lineTo(-4, -19);
    ctx.moveTo(3, -16); ctx.lineTo(4, -19);
    ctx.moveTo(0, -18); ctx.lineTo(0, -21);
    ctx.stroke();
}

function _radioactive(ctx) {
    inkStroke(ctx, 2);
    const tnow = performance.now() * 0.003;
    ctx.fillStyle = '#8b5a2b';
    roundRect(ctx, -13, 11, 26, 8, 3);
    ctx.fill(); ctx.stroke();
    ctx.save();
    ctx.translate(0, 0);
    ctx.rotate(tnow);
    const discR = 16;
    const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, discR);
    grad.addColorStop(0, '#f5d900');
    grad.addColorStop(0.7, '#e8c400');
    grad.addColorStop(1, '#c9a800');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, discR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    const bladeColor = '#1a1a1a';
    ctx.fillStyle = bladeColor;
    for (let i = 0; i < 3; i++) {
        const ang = (i * Math.PI * 2) / 3 - Math.PI / 2;
        ctx.save();
        ctx.rotate(ang);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, discR * 0.72, -0.52, 0.52);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(0, 0, discR * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f5d900';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, discR * 0.12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
}

function _knight(ctx, t) {
    inkStroke(ctx, 1.7);
    const gallop = Math.sin(t.gallopPhase * 8) * 1.8;
    const gallop2 = Math.cos(t.gallopPhase * 8) * 1.8;
    ctx.fillStyle = '#5a3819';
    roundRect(ctx, -11, 8, 3, 7 - gallop, 1);
    ctx.fill(); ctx.stroke();
    roundRect(ctx, -7, 8, 3, 7 + gallop, 1);
    ctx.fill(); ctx.stroke();
    roundRect(ctx, 5, 8, 3, 7 + gallop2, 1);
    ctx.fill(); ctx.stroke();
    roundRect(ctx, 9, 8, 3, 7 - gallop2, 1);
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-13, -1);
    ctx.quadraticCurveTo(-19, 1, -18, 7);
    ctx.stroke();
    ctx.fillStyle = '#6b4423';
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.7;
    roundRect(ctx, -13, -3, 26, 12, 5);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#6b4423';
    ctx.beginPath();
    ctx.moveTo(10, -3);
    ctx.lineTo(17, -9);
    ctx.lineTo(21, -8);
    ctx.lineTo(21, -3);
    ctx.lineTo(19, 1);
    ctx.lineTo(13, 3);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#3a2510';
    ctx.beginPath();
    ctx.moveTo(10, -3);
    ctx.lineTo(12, -6);
    ctx.lineTo(14, -4);
    ctx.lineTo(16, -7);
    ctx.lineTo(18, -4);
    ctx.lineTo(19, -7);
    ctx.lineTo(20, -4);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(19, -5, 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#a52a2a';
    roundRect(ctx, -8, -6, 14, 4, 1);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#bdc3c7';
    roundRect(ctx, -5, -15, 12, 11, 2.5);
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#7f8c8d';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-5, -10); ctx.lineTo(7, -10);
    ctx.stroke();
    ctx.fillStyle = '#f1c40f';
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(1, -13);
    ctx.lineTo(3, -10);
    ctx.lineTo(1, -6);
    ctx.lineTo(-1, -10);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#95a5a6';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(1, -19, 5, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-2, -20, 6, 1.6);
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.moveTo(1, -23);
    ctx.quadraticCurveTo(5, -29, 7, -25);
    ctx.quadraticCurveTo(4, -22, 1, -23);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2980b9';
    ctx.beginPath();
    ctx.moveTo(-4, -8);
    ctx.lineTo(-10, -6);
    ctx.lineTo(-10, 1);
    ctx.lineTo(-5, 5);
    ctx.lineTo(-4, -8);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-7, -6); ctx.lineTo(-7, 3);
    ctx.moveTo(-10, -2); ctx.lineTo(-4, -2);
    ctx.stroke();
    const swingProgress = t.swingTime > 0 ? t.swingTime / 220 : 0;
    const swingAngle = swingProgress > 0 ? Math.sin((1 - swingProgress) * Math.PI) * 1.1 : 0;
    ctx.save();
    ctx.translate(7, -10);
    ctx.rotate(-Math.PI / 4 - swingAngle);
    ctx.fillStyle = '#ecf0f1';
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.lineTo(2, -4);
    ctx.lineTo(2, -18);
    ctx.lineTo(0, -20);
    ctx.lineTo(-2, -18);
    ctx.lineTo(-2, -4);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0.5, -17); ctx.lineTo(0.5, -6);
    ctx.stroke();
    ctx.fillStyle = '#f1c40f';
    ctx.strokeStyle = COLORS.ink;
    ctx.lineWidth = 1.2;
    roundRect(ctx, -4, -3, 8, 2, 0.5);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#5a4010';
    ctx.fillRect(-1, -1, 2, 4);
    ctx.strokeRect(-1, -1, 2, 4);
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.arc(0, 4, 1.6, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.restore();
}

function _drone(ctx, t) {
    const spin = t.rotorSpin || 0;
    const bob = Math.sin(spin * 5) * 1.2;
    ctx.save();
    ctx.translate(0, bob);
    const arm = 14;
    const rotors = [[1, 1], [-1, 1], [1, -1], [-1, -1]];
    ctx.strokeStyle = '#34495e';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (const [sx, sy] of rotors) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(sx * arm, sy * arm * 0.7);
        ctx.stroke();
    }
    for (const [sx, sy] of rotors) {
        const hx = sx * arm, hy = sy * arm * 0.7;
        ctx.fillStyle = 'rgba(120, 144, 156, 0.28)';
        ctx.beginPath(); ctx.arc(hx, hy, 7, 0, Math.PI * 2); ctx.fill();
        inkStroke(ctx, 1.3);
        ctx.fillStyle = '#5d6d7e';
        ctx.beginPath(); ctx.arc(hx, hy, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.save();
        ctx.translate(hx, hy);
        ctx.rotate(spin * (sx * sy > 0 ? 1 : -1));
        ctx.strokeStyle = 'rgba(44, 24, 16, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(7, 0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(0, 7); ctx.stroke();
        ctx.restore();
    }
    inkStroke(ctx, 1.8);
    ctx.fillStyle = '#2c3e50';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-8, -6.5, 16, 13, 3);
    else ctx.rect(-8, -6.5, 16, 13);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = t.carrying ? '#2ecc71' : '#3498db';
    ctx.beginPath(); ctx.arc(0, 0, 3.2, 0, Math.PI * 2); ctx.fill();
    inkStroke(ctx, 1); ctx.stroke();
    ctx.strokeStyle = '#5d6d7e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 6); ctx.lineTo(0, 10);
    ctx.moveTo(-3.5, 13); ctx.quadraticCurveTo(0, 9, 3.5, 13);
    ctx.stroke();
    ctx.restore();
}

function _laserWall(ctx, t) {
    const tnow = performance.now() * 0.002;
    inkStroke(ctx, 2);
    ctx.fillStyle = '#5a3a1a';
    roundRect(ctx, -16, -22, 32, 7, 3);
    ctx.fill(); ctx.stroke();
    roundRect(ctx, -16, 12, 32, 7, 3);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ff4444';
    for (const xn of [-10, -3, 4, 11]) {
        ctx.beginPath(); ctx.arc(xn, -18, 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(xn, 15, 2, 0, Math.PI * 2); ctx.fill();
    }
    const flicker = 0.7 + 0.3 * Math.sin(tnow * 5);
    const alpha = Math.min(1, flicker);
    for (const xb of [-10, -3, 4, 11]) {
        ctx.strokeStyle = `rgba(255, 60, 60, ${alpha * 0.4})`;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(xb, -15); ctx.lineTo(xb, 12);
        ctx.stroke();
        ctx.strokeStyle = `rgba(255, 230, 230, ${alpha})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(xb, -15); ctx.lineTo(xb, 12);
        ctx.stroke();
    }
}

function _mago(ctx, t) {
    const tnow = performance.now() * 0.001;
    const bob = Math.sin(tnow * 1.8) * 4;
    const auraR = 22 + Math.sin(tnow * 2.5) * 4;
    const grad = ctx.createRadialGradient(0, 8, 2, 0, 8, auraR);
    grad.addColorStop(0, 'rgba(180, 80, 255, 0.55)');
    grad.addColorStop(1, 'rgba(100, 0, 200, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.ellipse(0, 8, auraR, auraR * 0.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.translate(0, bob);
    const elements = [
        { color: '#e74c3c', r: 3 },
        { color: '#3498db', r: 3 },
        { color: '#2ecc71', r: 3 },
        { color: '#f1c40f', r: 3 },
        { color: '#ecf0f1', r: 3 },
    ];
    const orbR = 19;
    elements.forEach((el, i) => {
        const angle = tnow * 1.6 + (i / elements.length) * Math.PI * 2;
        const ox = Math.cos(angle) * orbR;
        const oy = Math.sin(angle) * orbR * 0.45;
        ctx.fillStyle = el.color;
        ctx.shadowColor = el.color;
        ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(ox, oy, el.r, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
    });
    ctx.fillStyle = '#4a0080';
    ctx.strokeStyle = '#9b59b6';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-10, 2);
    ctx.lineTo(-13, 16);
    ctx.lineTo(13, 16);
    ctx.lineTo(10, 2);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#6c3483';
    ctx.strokeStyle = '#9b59b6';
    roundRect(ctx, -8, -10, 16, 14, 3);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#6c3483';
    ctx.fillRect(8, -8, 5, 10);
    ctx.strokeStyle = '#8b4513';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(12, -8); ctx.lineTo(14, -24); ctx.stroke();
    const crystalGlow = 0.6 + 0.4 * Math.sin(tnow * 4);
    ctx.fillStyle = `rgba(180, 80, 255, ${crystalGlow})`;
    ctx.strokeStyle = '#e8d5ff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(14, -29); ctx.lineTo(11, -24); ctx.lineTo(17, -24);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#6c3483';
    ctx.fillRect(-13, -8, 5, 8);
    ctx.fillStyle = '#f5cba7';
    ctx.strokeStyle = '#d4a574';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, -16, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#4a0080';
    ctx.strokeStyle = '#9b59b6';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(0, -22, 12, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-7, -22); ctx.lineTo(0, -38); ctx.lineTo(7, -22);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f1c40f';
    ctx.font = '7px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('★', 0, -28);
    ctx.fillStyle = '#9b59b6';
    ctx.beginPath(); ctx.arc(-3, -17, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(3, -17, 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
}
