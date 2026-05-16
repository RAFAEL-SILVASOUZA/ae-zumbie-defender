// AE Zombie Defender - Entry Point
// Inicializa o jogo após todos os módulos serem carregados

document.addEventListener('DOMContentLoaded', () => {
    configureLayout();
    new Game();
    renderShopThumbnails();
    renderHelpContent();
    setInterval(renderShopThumbnails, 80);

    // Fit immediately, then again after layout settles (fonts may still be loading)
    requestAnimationFrame(() => {
        fitCanvas();
        requestAnimationFrame(fitCanvas);
    });
    document.fonts.ready.then(fitCanvas);

    window.addEventListener('resize', fitCanvas);
    window.addEventListener('orientationchange', () => {
        fitCanvas();
        setTimeout(fitCanvas, 200);
    });

    // Watch for container size changes (e.g. virtual keyboard, font reflow)
    const _ro = new ResizeObserver(fitCanvas);
    _ro.observe(document.querySelector('.canvas-frame'));

    // iOS PWA (atalho na tela inicial): o viewport real só se estabiliza
    // alguns frames depois do load. visualViewport é mais confiável que
    // window resize nesse contexto.
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', fitCanvas);
    }

    // pageshow dispara quando o app abre do atalho iOS (inclusive via cache).
    // A cascata de timeouts garante que ao menos uma chamada aconteça depois
    // que o iOS terminar de calcular as safe-area insets e o layout final.
    window.addEventListener('pageshow', () => {
        fitCanvas();
        [150, 400, 900, 1800].forEach(ms => setTimeout(fitCanvas, ms));
    });
});
