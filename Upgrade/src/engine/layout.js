/**
 * Layout / proporção do campo (versão 3D).
 *
 * Mantemos configureLayout() do original: escolhe cols/rows de modo que a
 * proporção do campo combine com a área disponível. No 3D o canvas ocupa toda
 * a moldura e a câmera (Camera3D.fit) enquadra o tabuleiro — então gridSize e
 * worldScale continuam fixos; só cols/rows mudam conforme a tela.
 */
function configureLayout() {
    const container = document.getElementById('game-container');
    const hud = document.getElementById('hud');
    const shop = document.getElementById('shop');
    const hint = document.getElementById('hint');

    container.getBoundingClientRect(); // força layout

    const cW = container.clientWidth;
    const cH = container.clientHeight;
    const hintH = (hint && getComputedStyle(hint).display !== 'none') ? hint.offsetHeight : 0;
    const uiH = hud.offsetHeight + shop.offsetHeight + hintH;

    const frameW = cW;
    const frameH = Math.max(140, cH - uiH);
    const frameAspect = frameW / frameH;

    const rows = Math.max(8, Math.min(12, Math.round(frameH / 55)));
    // Limitamos a proporção do CAMPO (cols/rows) para o tabuleiro nunca virar
    // uma faixa achatada em telas muito largas (celular em paisagem). Um campo
    // mais "quadrado", como no desktop, mantém a profundidade e evita a
    // impressão de cenário deitado. Se sobrar largura, a câmera centraliza.
    const maxFieldAspect = 1.85;
    const effAspect = Math.min(frameAspect, maxFieldAspect);
    const cols = Math.max(12, Math.min(28, Math.round(rows * effAspect)));

    CONFIG.cols = cols;
    CONFIG.rows = rows;
}
