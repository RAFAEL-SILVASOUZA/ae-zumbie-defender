/**
 * Sistema de coordenadas: grade lógica (px) -> mundo 3D.
 *
 * No jogo original, tudo vive em "px" lógicos: screenX = x*gridSize + gridSize/2.
 * Mantemos essa lógica EXATAMENTE igual nas entidades (alcance, splash, A*,
 * velocidade). Aqui só convertemos para as posições 3D na hora de renderizar.
 *
 * Convenção do mundo:
 *   eixo X 3D  = eixo x da grade (coluna)
 *   eixo Z 3D  = eixo y da grade (linha)
 *   eixo Y 3D  = altura acima do chão
 *
 * O centro do tabuleiro fica na origem (0,0,0) para facilitar a câmera.
 * CONFIG.worldScale faz 1 célula (50px) == 1 unidade 3D.
 */
const Coords = {
    offX: 0,
    offZ: 0,

    // Recalcula os deslocamentos quando cols/rows mudam (relayout).
    recenter() {
        this.offX = (CONFIG.cols * CONFIG.gridSize) / 2 * CONFIG.worldScale;
        this.offZ = (CONFIG.rows * CONFIG.gridSize) / 2 * CONFIG.worldScale;
    },

    // screenX (px lógico) -> mundo X
    px(px) { return px * CONFIG.worldScale - this.offX; },
    // screenY (px lógico) -> mundo Z
    py(py) { return py * CONFIG.worldScale - this.offZ; },

    // centro de uma célula (col x, linha y) -> mundo (x,z)
    cellCX(cx) { return (cx * CONFIG.gridSize + CONFIG.gridSize / 2) * CONFIG.worldScale - this.offX; },
    cellCY(cy) { return (cy * CONFIG.gridSize + CONFIG.gridSize / 2) * CONFIG.worldScale - this.offZ; },

    // magnitude escalar (raio, distância) de px lógicos -> unidades 3D
    len(px) { return px * CONFIG.worldScale; }
};
