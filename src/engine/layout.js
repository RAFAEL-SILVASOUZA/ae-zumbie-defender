// Funções de layout, shop e help overlay (escopo global)

// Choose cols/rows so the canvas's aspect matches the available frame area.
// gridSize stays fixed at 50 (so all sprite art keeps its pixel size); CSS
// scaling via fitCanvas handles the final display size.
function configureLayout() {
    const container = document.getElementById('game-container');
    const hud = document.getElementById('hud');
    const shop = document.getElementById('shop');
    const hint = document.getElementById('hint');

    container.getBoundingClientRect(); // force layout

    const cW = container.clientWidth;
    const cH = container.clientHeight;
    const hintH = (hint && getComputedStyle(hint).display !== 'none') ? hint.offsetHeight : 0;
    const uiH = hud.offsetHeight + shop.offsetHeight + hintH;

    const frameW = cW;
    const frameH = Math.max(140, cH - uiH);
    const frameAspect = frameW / frameH;

    const rows = Math.max(8, Math.min(12, Math.round(frameH / 55)));
    const cols = Math.max(12, Math.min(28, Math.round(rows * frameAspect)));

    CONFIG.cols = cols;
    CONFIG.rows = rows;
    // CONFIG.gridSize stays at 50
}

function fitCanvas() {
    const frame = document.querySelector('.canvas-frame');
    const canvas = document.getElementById('gameCanvas');
    if (!frame || !canvas || !canvas.width || !canvas.height) return;

    const frameW = frame.clientWidth;
    const frameH = frame.clientHeight;
    if (!frameW || !frameH) return;

    const canvasAspect = canvas.width / canvas.height;
    const frameAspect = frameW / frameH;

    let cssW, cssH;
    if (canvasAspect > frameAspect) {
        cssW = frameW;
        cssH = Math.round(frameW / canvasAspect);
    } else {
        cssH = frameH;
        cssW = Math.round(frameH * canvasAspect);
    }

    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
}

function renderShopThumbnails() {
    document.querySelectorAll('.shop-item').forEach(el => {
        const type = el.dataset.type;
        const canvas = el.querySelector('canvas.icon');
        if (!canvas || !type || !TOWER_STATS[type]) return;
        const ctx = canvas.getContext('2d');
        const tower = new Tower(0, 0, type);
        tower.angle = -Math.PI / 7;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        tower.draw(ctx);
    });
}

// ========== HELP OVERLAY CONTENT ==========
function renderHelpContent() {
    renderMonstersTab();
    renderWeaponsTab();
    renderStrategyTab();
    setupHelpTabs();
}

function renderMonstersTab() {
    const grid = document.getElementById('help-monsters-grid');
    if (!grid) return;

    const entries = Object.entries(ZOMBIE_STATS).filter(([_, s]) => s.weight > 0 || s.isBoss);
    grid.innerHTML = entries.map(([type, stats]) => {
        const badges = [];
        if (stats.immuneTo) {
            stats.immuneTo.forEach(dmg => {
                badges.push(`<span class="card-badge immune">Imune: ${dmg}</span>`);
            });
        }
        if (stats.slowImmune) badges.push(`<span class="card-badge immune">Imune: Slow</span>`);
        if (stats.flying) badges.push(`<span class="card-badge special">Voador</span>`);
        if (stats.isBoss) badges.push(`<span class="card-badge boss">BOSS</span>`);
        if (stats.freezesTowers) badges.push(`<span class="card-badge special">Congela Torres</span>`);
        if (stats.poisonous) badges.push(`<span class="card-badge special">Venenoso</span>`);
        if (stats.bomb) badges.push(`<span class="card-badge special">Explosivo</span>`);

        return `
            <div class="help-card">
                <canvas width="80" height="80" data-monster="${type}"></canvas>
                <h3>${stats.label}</h3>
                <div class="card-stats">
                    <div class="stat-row"><span>HP</span> <strong>${stats.hpMult}x</strong></div>
                    <div class="stat-row"><span>Vel.</span> <strong>${stats.speedMult}x</strong></div>
                    <div class="stat-row"><span>Round</span> <strong>${stats.unlockRound}+</strong></div>
                </div>
                <div class="card-badges">${badges.join('')}</div>
            </div>
        `;
    }).join('');

    // Draw monsters
    grid.querySelectorAll('canvas').forEach(canvas => {
        const type = canvas.dataset.monster;
        const ctx = canvas.getContext('2d');
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const zombie = new Zombie([{x:0,y:0},{x:1,y:0}], 1, type);
        zombie.screenX = cx;
        zombie.screenY = cy;
        zombie.draw(ctx);
    });
}

function renderWeaponsTab() {
    const grid = document.getElementById('help-weapons-grid');
    if (!grid) return;

    const entries = Object.entries(TOWER_STATS);
    grid.innerHTML = entries.map(([type, stats]) => {
        const dps = stats.isDrone ? '—' : (stats.damage / (stats.fireRate / 1000)).toFixed(1);
        const rangeGrid = stats.mobile ? '∞' : (stats.range).toFixed(1);

        let specialText = '';
        if (stats.ignoresFlying) specialText = 'Ignora voadores';
        if (stats.splashRadius) specialText = `Área: ${stats.splashRadius.toFixed(1)}`;
        if (stats.chains) specialText = `Cadeia: ${stats.chains}`;
        if (stats.damageType === 'poison') specialText = 'Slow + Dano contínuo';
        if (stats.mobile) specialText = 'Persegue zumbis · Cleave · Holy';
        if (stats.isDrone) specialText = 'Captura voadores e leva ao início';
        if (type === 'laser') specialText = 'Queima tudo que atravessa · Lv6: Plasma';

        return `
            <div class="help-card">
                <canvas width="80" height="80" data-tower="${type}"></canvas>
                <h3>${stats.label}</h3>
                <div class="card-stats">
                    <div class="stat-row"><span>Dano</span> <strong>${stats.damage}</strong></div>
                    <div class="stat-row"><span>DPS</span> <strong>${dps}</strong></div>
                    <div class="stat-row"><span>Alcance</span> <strong>${rangeGrid}</strong></div>
                    <div class="stat-row"><span>Custo</span> <strong>$${stats.cost}</strong></div>
                </div>
                ${specialText ? `<div class="card-special">${specialText}</div>` : ''}
            </div>
        `;
    }).join('');

    // Draw towers
    grid.querySelectorAll('canvas').forEach(canvas => {
        const type = canvas.dataset.tower;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Center tower in 80x80 canvas: x * gridSize + gridSize/2 = 40 → x = 0.3
        const tower = new Tower(0.3, 0.3, type);
        tower.angle = -Math.PI / 6;
        tower.draw(ctx);
    });
}

function renderStrategyTab() {
    const container = document.getElementById('help-strategy-content');
    if (!container) return;

    const monsters = Object.entries(ZOMBIE_STATS).filter(([_, s]) => s.weight > 0 || s.isBoss);
    const weapons = Object.keys(TOWER_STATS);

    // Build cards HTML
    let cardsHtml = '';
    monsters.forEach(([mType, mStats]) => {
        // Rate all weapons and sort: best (3) → good (2) → regular (1) → bad (≤0)
        const rated = weapons.map(wType => ({
            type: wType,
            rating: rateWeaponVsMonster(wType, mType)
        }));
        rated.sort((a, b) => b.rating - a.rating);

        let rowsHtml = '';
        rated.forEach(({ type: wType, rating }) => {
            let cls = 'regular';
            if (rating === 3) cls = 'best';
            else if (rating === 2) cls = 'good';
            else if (rating <= 0) cls = 'bad';

            const tip = getStrategyTip(wType, mType);
            const showTip = (rating === 3 || rating <= 0) && tip;

            rowsHtml += `
                <div class="weapon-row ${cls}">
                    <canvas class="weapon-icon" data-type="${wType}" width="28" height="28"></canvas>
                    <span>${TOWER_STATS[wType].label}</span>
                    ${showTip ? `<span class="tip">${tip}</span>` : ''}
                </div>`;
        });

        cardsHtml += `
            <div class="strategy-card" data-monster="${mType}">
                <div class="strategy-card-header">
                    <canvas class="monster-preview" width="64" height="64"></canvas>
                    <span class="monster-label">${mStats.label}</span>
                </div>
                <div class="strategy-card-body">
                    ${rowsHtml}
                </div>
            </div>`;
    });

    container.innerHTML = `<div class="strategy-cards-grid">${cardsHtml}</div>`;

    // Draw monster previews
    container.querySelectorAll('.strategy-card').forEach(card => {
        const mType = card.dataset.monster;
        const canvas = card.querySelector('.monster-preview');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const zombie = new Zombie([{x:0,y:0},{x:1,y:0}], 1, mType);
        zombie.screenX = canvas.width / 2;
        zombie.screenY = canvas.height / 2;
        zombie.draw(ctx);
    });

    // Draw weapon icons
    container.querySelectorAll('.weapon-icon').forEach(canvas => {
        const type = canvas.dataset.type;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const tower = new Tower(-0.22, -0.22, type);
        tower.angle = -Math.PI / 6;
        tower.draw(ctx);
    });
}

function rateWeaponVsMonster(weaponType, monsterType) {
    const wStats = TOWER_STATS[weaponType];
    const mStats = ZOMBIE_STATS[monsterType];
    const dmgType = wStats.damageType;

    // Imune = muito ruim
    if (mStats.immuneTo && mStats.immuneTo.includes(dmgType)) return -1;

    // Cavaleiro: dano holy ignora todas as imunidades + cleave + persegue
    if (weaponType === 'knight') return 3;

    // Drone: captura apenas voadores
    if (weaponType === 'drone') return mStats.flying ? 3 : 0;

    let rating = 2; // bom por padrão

    // Voadores: espinhos inúteis
    if (mStats.flying && weaponType === 'spike') return 0;

    // Zumbi de gelo: veneno é excelente (quebra armadura)
    if (mStats.freezesTowers && weaponType === 'poison') return 3;

    // Tesla é excelente contra grupos (e voadores vêm em bando)
    if (weaponType === 'tesla' && mStats.flying) return 3;

    // Radar alto dano bom contra tanques
    if (mStats.hpMult >= 2 && weaponType === 'radar') return 3;

    // Foguete área bom contra voadores em bando
    if (mStats.flying && weaponType === 'rocket') return 3;

    // Radioativa área circular excelente contra aglomerações
    if (weaponType === 'radioactive') rating = 3;

    // Metralhadora boa contra rápidos (dps alto)
    if (mStats.speedMult >= 1.5 && weaponType === 'machinegun') rating = 3;

    return rating;
}

function getStrategyTip(weaponType, monsterType) {
    const mStats = ZOMBIE_STATS[monsterType];
    const wStats = TOWER_STATS[weaponType];

    if (mStats.immuneTo && mStats.immuneTo.includes(wStats.damageType)) {
        return `Imune a ${wStats.damageType}!`;
    }
    if (mStats.flying && weaponType === 'spike') {
        return 'Espinhos não atingem voadores!';
    }
    if (mStats.freezesTowers && weaponType === 'poison') {
        return 'Veneno quebra a armadura de gelo!';
    }
    if (weaponType === 'tesla' && mStats.flying) {
        return 'Tesla atinge múltiplos voadores de uma vez!';
    }
    if (mStats.hpMult >= 2 && weaponType === 'radar') {
        return 'Alto dano do Radar derrete tanques!';
    }
    if (weaponType === 'knight') {
        return 'Cavaleiro persegue e ignora imunidades!';
    }
    return '';
}

function setupHelpTabs() {
    const tabs = document.querySelectorAll('.help-tab');
    const contents = document.querySelectorAll('.help-tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;

            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            contents.forEach(c => {
                c.classList.toggle('active', c.dataset.content === targetTab);
            });
        });
    });
}