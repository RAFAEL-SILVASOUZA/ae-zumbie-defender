// AE Zombie Defender 3D - Entry Point
document.addEventListener('DOMContentLoaded', () => {
    configureLayout();
    const game = new Game();
    renderHelpContent();

    // desenha os ícones da loja (mesmo desenho 2D das torres, como no original)
    renderShopThumbnails();
    setInterval(renderShopThumbnails, 80);

    const fit = () => game.relayout();
    requestAnimationFrame(() => {
        fit();
        requestAnimationFrame(fit);
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);

    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', () => {
        fit();
        setTimeout(fit, 200);
    });

    if (window.ResizeObserver) {
        const ro = new ResizeObserver(fit);
        const frame = document.querySelector('.canvas-frame');
        if (frame) ro.observe(frame);
    }

    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', fit);
    }

    window.addEventListener('pageshow', () => {
        fit();
        [150, 400, 900, 1800].forEach(ms => setTimeout(fit, ms));
    });
});
