// Funções utilitárias de desenho (escopo global)

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

function drawLightning(ctx, p1, p2) {
    const dx = p2.x - p1.x, dy = p2.y - p1.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return;
    const segments = Math.max(3, Math.floor(dist / 14));
    const perpX = -dy / dist;
    const perpY = dx / dist;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    for (let i = 1; i < segments; i++) {
        const t = i / segments;
        const baseX = p1.x + dx * t;
        const baseY = p1.y + dy * t;
        const offset = (Math.random() - 0.5) * Math.min(14, dist * 0.18);
        ctx.lineTo(baseX + perpX * offset, baseY + perpY * offset);
    }
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
}
